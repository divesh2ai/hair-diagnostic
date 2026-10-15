import { NextResponse } from 'next/server';
import { ArtifactType } from '@prisma/client';
import { generateAndStoreReports } from '@hairos/packages/pdf-engine';
import { signReportUrl } from '@hairos/packages/pdf-engine/storage';
import { getClinicContext, handleAuthError, isSuperAdmin } from '@/lib/auth';
import { verifyReviewToken } from '@/lib/reviewToken';
import { logLifecycleEvent } from '@/lib/observability/lifecycle';
import {
  evaluateClinicalReadinessForApproval,
  isHardBlocked,
} from '@shared/clinical-readiness/evaluator';
import type { Consultation } from '@shared/types/consultation';
import { prisma } from '@/lib/prisma';
import { approvedPdfPayload, findApprovedPdf, recordApprovedPdf } from '@/lib/reports/approvedPdf';

function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * Authorization for POST (report generation), mirroring the GET release gate's
 * caller model.
 *
 * Generation is a privileged write: it (re)creates the REPORT artifact, writes
 * an audit row, and returns the stored report locations. Before this guard the
 * handler ran all of that for anyone who could name an assessment id — no
 * session, no token, no clinic check — so a caller who knew (or guessed) an id
 * from another clinic could drive generation and read back the report's
 * storage locations. That is the same cross-clinic exposure the GET gate and
 * every /api/doctor and /api/consultation route already close; the POST was the
 * one hole left open.
 *
 * Two callers, and only two, may generate — exactly the GET gate's model minus
 * the super-admin peek having no meaning for a write it does not need:
 *   • CLINIC SESSION — an authenticated caller whose clinic OWNS the
 *     assessment (Super Admin excepted). Never a silent fall-back to a default
 *     clinic: a session with no clinic, or the wrong clinic, is refused.
 *   • PATIENT TOKEN  — a signed review token bound to THIS assessment id,
 *     supplied as `?t=` or `{ token }` in the body.
 *
 * Cross-clinic and unauthenticated callers are denied. The caller is resolved
 * BEFORE the assessment is looked up, so an unauthorized caller cannot use the
 * response code as an existence oracle: an anonymous caller (no session, no
 * token) and a token bound to a different assessment are both refused with the
 * SAME 401 whether or not the id exists, and neither triggers a lookup. The
 * only callers who can tell a real id from a missing one (404) are those
 * already entitled to that assessment — an owning-clinic session, a Super
 * Admin, or the holder of a token minted for exactly this id — which is the
 * same disclosure boundary the GET gate draws.
 */
type PdfPostCaller =
  | { kind: 'clinic'; clinicId: string }
  | { kind: 'super_admin' }
  | { kind: 'patient_token' };

async function resolvePdfPostCaller(
  req: Request,
  bodyToken: string | null,
  assessmentId: string,
): Promise<PdfPostCaller | NextResponse> {
  try {
    const ctx = await getClinicContext();
    if (isSuperAdmin(ctx.role)) return { kind: 'super_admin' };
    // A clinic session authorizes only through its OWN clinic membership —
    // never a client-supplied id and never a default. A session that carries
    // no clinic is refused rather than falling through.
    if (!ctx.clinicId) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    return { kind: 'clinic', clinicId: ctx.clinicId };
  } catch (err) {
    const token = new URL(req.url).searchParams.get('t') ?? bodyToken;
    if (token) {
      const result = verifyReviewToken(token);
      // Bound to THIS assessment id, or nothing. A token for another
      // assessment is refused here, before the id is ever looked up.
      if (result.ok && result.assessmentId === assessmentId) {
        return { kind: 'patient_token' };
      }
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const resp = handleAuthError(err);
    if (resp) return resp;
    throw err;
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as
      | { assessmentId?: unknown; token?: unknown; contentVersion?: unknown }
      | null;
    const assessmentId =
      typeof body?.assessmentId === 'string' ? body.assessmentId : '';
    const bodyToken = typeof body?.token === 'string' ? body.token : null;

    if (!assessmentId) {
      return NextResponse.json({ error: 'Missing assessmentId' }, { status: 400 });
    }

    // Resolve + authorize the caller BEFORE any DB lookup, so no existence
    // signal leaks to an unauthorized caller. See resolvePdfPostCaller.
    const caller = await resolvePdfPostCaller(req, bodyToken, assessmentId);
    if (caller instanceof Response) return caller;

    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: { patient: true, clinic: true, reviewingDoctor: true },
    });

    if (!assessment) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
    }

    // A clinic session may generate only for its own clinic's assessment.
    // (Super Admin and a token bound to this id are already scoped.)
    if (caller.kind === 'clinic' && assessment.clinicId !== caller.clinicId) {
      return NextResponse.json({ error: 'Cross-clinic access denied' }, { status: 403 });
    }

    if (!assessment.patient || !assessment.clinic) {
      return NextResponse.json(
        { error: 'Assessment missing required patient or clinic' },
        { status: 422 }
      );
    }

    const consultation = await prisma.consultation.findUnique({
      where: { assessmentId }, include: { currentVersion: true },
    });
    const version = consultation?.currentVersion;
    if (body?.contentVersion !== undefined && body.contentVersion !== version?.contentVersion) {
      return NextResponse.json({ error: 'Consultation version changed' }, { status: 409 });
    }
    if (!version || version.approvalStatus !== 'APPROVED') {
      return NextResponse.json({ error: 'Consultation is not approved', code: 'not_approved' }, { status: 403 });
    }
    if (consultation.clinicId !== assessment.clinicId || consultation.patientId !== assessment.patientId) {
      return NextResponse.json({ error: 'Consultation identity mismatch' }, { status: 422 });
    }
    const readiness = evaluateClinicalReadinessForApproval(version.content as unknown as Consultation);
    if (isHardBlocked(readiness)) {
      return NextResponse.json({ error: 'readiness_blocked', blockingCodes: readiness.blockingCodes }, { status: 422 });
    }
    const subject = { id: assessmentId, clinicId: assessment.clinicId, patientId: assessment.patientId };
    const existing = await findApprovedPdf(subject, version);
    if (existing) return NextResponse.json({ success: true, patientPdfUrl: existing.storagePath,
      consultationVersionId: version.id, contentVersion: version.contentVersion });
    const payload = approvedPdfPayload(subject, version, assessment.clinic.name, assessment.reviewingDoctor?.name ?? 'Reviewing doctor');
    const reportUrls = await generateAndStoreReports(payload);
    const asset = await recordApprovedPdf(subject, consultation.id, version, reportUrls.patientPdfUrl);
    return NextResponse.json({ success: true, patientPdfUrl: asset.storagePath,
      consultationVersionId: version.id, contentVersion: version.contentVersion });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[pdf] Generation failed:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const assessmentId = searchParams.get('id');
  const requestedVersion = searchParams.get('contentVersion');
  const legacyReference = searchParams.get('legacy') === '1';
  if (requestedVersion !== null && (!/^[1-9][0-9]*$/.test(requestedVersion) || !Number.isSafeInteger(Number(requestedVersion)))) {
    return NextResponse.json({ error: 'Invalid contentVersion' }, { status: 400 });
  }
  const download = searchParams.get('download') === '1';

  if (!assessmentId) {
    return NextResponse.json({ error: 'Missing assessment id' }, { status: 400 });
  }

  // Release gate. Before this guard the endpoint would stream any patient's
  // PDF to anyone who knew the assessmentId. We now require:
  //   1. authenticated caller OR signed review token bound to this assessment,
  //   2. clinic callers belong to the assessment's clinic (or are Super Admin),
  //   3. the underlying Consultation is APPROVED — no draft / rejected /
  //      revision-requested content leaks to a patient share.
  //
  // Token branch: the patient's own /q/[clinicSlug]/preview page carries a
  // signed token minted at submit time; it lets them download once the
  // consultation is APPROVED without needing a clinic cookie.
  let ctx: Awaited<ReturnType<typeof getClinicContext>> | null = null;
  let audience: 'clinic' | 'super_admin' | 'patient_token';
  try {
    ctx = await getClinicContext();
    audience = isSuperAdmin(ctx.role) ? 'super_admin' : 'clinic';
  } catch (err) {
    const tokenParam = searchParams.get('t');
    if (tokenParam) {
      const tokenResult = verifyReviewToken(tokenParam);
      if (!tokenResult.ok || tokenResult.assessmentId !== assessmentId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      audience = 'patient_token';
    } else {
      const resp = handleAuthError(err);
      if (resp) return resp;
      throw err;
    }
  }

  const [report, assessment, consultation] = await Promise.all([
    prisma.aIArtifact.findUnique({
      where: {
        assessmentId_type: {
          assessmentId,
          type: ArtifactType.REPORT,
        },
      },
      select: { content: true },
    }),
    prisma.assessment.findUnique({
      where: { id: assessmentId },
      select: { patient: { select: { name: true } }, clinicId: true, patientId: true,
        clinic: { select: { name: true } }, reviewingDoctor: { select: { name: true } } },
    }),
    prisma.consultation.findUnique({
      where: { assessmentId },
      include: { currentVersion: true, ...(requestedVersion ? { versions: { where: { contentVersion: Number(requestedVersion) }, take: 1 } } : {}) },
    }),
  ]);

  // Historical legacy references were not version-bound. Retain their original
  // authorization gate; never label them as a particular approved version.
  if (legacyReference && audience === 'patient_token') {
    return NextResponse.json({ error: 'Clinic session required' }, { status: 403 });
  }

  if (!assessment) {
    logLifecycleEvent({
      event: 'pdf.release_denied',
      assessmentId,
      failureCode: 'not_found',
      audience,
    });
    return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
  }
  if (audience === 'clinic' && ctx && assessment.clinicId !== ctx.clinicId) {
    logLifecycleEvent({
      event: 'pdf.release_denied',
      assessmentId,
      clinicId: ctx.clinicId,
      failureCode: 'cross_clinic',
      audience: 'clinic',
    });
    return NextResponse.json({ error: 'Cross-clinic access denied' }, { status: 403 });
  }
  // First gate: the consultation must be APPROVED. An AI recommendation that
  // no doctor has signed is not a clinical document, and this endpoint streams
  // the full detailed report — so a draft, rejected or revision-requested
  // consultation is refused for every audience, patient token included.
  //
  // This gate and the readiness gate below were both disabled behind
  // "testing-phase relaxation" carve-outs while the doctor workflow was being
  // built. The tests that describe the intended behaviour were never relaxed:
  // tests/api/pdf-release-gate.test.ts still asserts 403 for PENDING_REVIEW
  // and for a missing consultation, and tests/api/pdf-readiness-gate.test.ts
  // still asserts 422 for a blocked or missing snapshot. Restoring the route
  // to what those tests already demand is the whole of this change.
  const selectedVersion = requestedVersion ? consultation?.versions?.[0] : consultation?.currentVersion;
  const approvalStatus = selectedVersion?.approvalStatus ?? null;
  if (approvalStatus !== 'APPROVED') {
    logLifecycleEvent({
      event: 'pdf.release_denied',
      assessmentId,
      clinicId: assessment.clinicId,
      failureCode: 'not_approved',
      audience,
    });
    return NextResponse.json(
      { error: 'Consultation is not approved', code: 'not_approved' },
      { status: 403 },
    );
  }
  // Second gate: even an APPROVED consultation must not release the PDF if
  // the persisted readiness snapshot no longer clears — historically the
  // orchestrator blocks unready approvals at write time, but a manual
  // migration or a future engine change could leave an APPROVED row whose
  // snapshot went stale. The evaluator fails closed for missing/malformed
  // snapshots so pre-D historical rows are refused here too.
  const consultationContent = selectedVersion?.content as
    | Consultation
    | null
    | undefined;
  // Same governance as the approval gate (see orchestrator.approve and
  // evaluator.isSoftAdvisoryOnly): only a HARD blocker refuses the report.
  // A reasoning-gap-only case is a soft advisory — it approves, and it must
  // render/deliver too, so it is NOT refused here. Grounding violations and
  // missing/malformed snapshots remain hard stops that fail closed.
  const readiness = evaluateClinicalReadinessForApproval(consultationContent ?? null);
  if (isHardBlocked(readiness)) {
    logLifecycleEvent({
      event: 'pdf.release_denied',
      assessmentId,
      clinicId: assessment.clinicId,
      failureCode: readiness.blockingCodes.includes('GROUNDING_VIOLATION_PRESENT')
        ? 'grounding_violation'
        : 'readiness_snapshot',
      audience,
    });
    return NextResponse.json(
      {
        error: 'readiness_blocked',
        code: 'readiness_blocked',
        message: readiness.doctorSummary,
        blockingCodes: readiness.blockingCodes,
        groundingViolationCount: readiness.groundingViolationCount,
        reasoningGapCount: readiness.reasoningGapCount,
      },
      { status: 422 },
    );
  }
  logLifecycleEvent({
    event: 'pdf.release_allowed',
    assessmentId,
    clinicId: assessment.clinicId,
    audience,
  });

  const content =
    report?.content && typeof report.content === 'object' && !Array.isArray(report.content)
      ? (report.content as Record<string, unknown>)
      : {};
  let patientPdfUrl = content.patientPdfUrl;
  if (legacyReference) {
    const legacy = await prisma.auditLog.findFirst({ where: { assessmentId, clinicId: assessment.clinicId,
      action: 'PDF_REFERENCE_PRESERVED' }, orderBy: { createdAt: 'asc' }, select: { metadata: true } });
    const metadata = legacy?.metadata as Record<string, unknown> | undefined;
    patientPdfUrl = metadata?.patientPdfUrl ?? patientPdfUrl;
  } else if (selectedVersion?.id) {
    const subject = { id: assessmentId, clinicId: assessment.clinicId, patientId: assessment.patientId };
    try {
      let asset = await findApprovedPdf(subject, selectedVersion);
      // Existing download links are GETs, including on the doctor dashboard.
      // Recover a missing approved PDF from that exact snapshot; never serve
      // the draft or a different version while waiting for a patient POST.
      if (!asset && consultation &&
          consultation.clinicId === assessment.clinicId && consultation.patientId === assessment.patientId) {
        const payload = approvedPdfPayload(subject, selectedVersion, assessment.clinic.name,
          assessment.reviewingDoctor?.name ?? 'Reviewing doctor');
        const generated = await generateAndStoreReports(payload);
        asset = await recordApprovedPdf(subject, consultation.id, selectedVersion, generated.patientPdfUrl);
      }
      patientPdfUrl = asset?.storagePath;
    } catch (error) {
      console.error('[pdf] Approved PDF retrieval failed:', error instanceof Error ? error.message : 'unknown');
      return NextResponse.json({ error: 'Failed to prepare approved PDF' }, { status: 500 });
    }
  }

  if (typeof patientPdfUrl !== 'string') {
    return NextResponse.json({ error: 'PDF not ready yet' }, { status: 202 });
  }

  // `clinical-reports` is a PRIVATE bucket, so the stored value is a
  // bucket-relative object path, not a fetchable URL — see pdf-engine/storage.
  // Sign it here, on a request that has already passed the release gate above.
  //
  // ── Rows written before the bucket was private ──────────────────────────────
  // Those hold a full `.../storage/v1/object/public/clinical-reports/<path>`
  // URL. Passing one through unchanged only works while the bucket is public —
  // the moment it is locked down, every historical report 400s. So recover the
  // object path out of the legacy URL and sign that instead. Anything else
  // absolute (an external host) is passed through as before.
  const fetchUrl = await resolveReportUrl(patientPdfUrl);

  if (!fetchUrl) {
    return NextResponse.json({ error: 'Failed to fetch PDF' }, { status: 502 });
  }

  const response = await fetch(fetchUrl);
  if (!response.ok || !response.body) {
    return NextResponse.json({ error: 'Failed to fetch PDF' }, { status: 502 });
  }

  const patientSlug = slugifyName(assessment?.patient?.name ?? '') || `hair-dossier-${assessmentId}`;
  const filename = `${patientSlug}.pdf`;

  const headers = new Headers(response.headers);
  headers.set('Content-Type', response.headers.get('content-type') ?? 'application/pdf');
  headers.set('Cache-Control', 'no-store');
  headers.set(
    'Content-Disposition',
    download ? `attachment; filename="${filename}"` : `inline; filename="${filename}"`
  );

  return new NextResponse(response.body, {
    status: 200,
    headers,
  });
}


/**
 * Turn whatever is stored in the REPORT artifact into a URL this server can
 * actually fetch, whichever era the row was written in.
 *
 *   • bucket-relative path            -> sign it (current writer)
 *   • legacy public storage URL       -> recover the path, sign that
 *   • any other absolute URL          -> pass through untouched
 *
 * The legacy branch is what lets `clinical-reports` be flipped from public to
 * private without orphaning every report generated before the change.
 */
async function resolveReportUrl(stored: string): Promise<string | null> {
  if (!/^https?:\/\//i.test(stored)) {
    return signReportUrl(stored, 300);
  }

  // `.../storage/v1/object/public/clinical-reports/<objectPath>`
  const legacy = stored.match(
    /\/storage\/v1\/object\/(?:public\/)?clinical-reports\/(.+)$/i,
  );
  if (legacy?.[1]) {
    const objectPath = decodeURIComponent(legacy[1]);
    const signed = await signReportUrl(objectPath, 300);
    // If signing fails the bucket may still be public — fall back to the
    // stored URL rather than denying a doctor a report we can plainly reach.
    return signed ?? stored;
  }

  return stored;
}
