// POST /api/consultation/[assessmentId]/kit-substitution
//
// The ONLY way a kit substitution reaches a Consultation. Two actions:
//
//   SUBSTITUTE — replace an eligible canonical kit currently in the lineup
//                with its one approved budget alternative.
//   RESTORE    — put the original canonical kit back, from the snapshot the
//                substitution itself preserved.
//
// Deliberately its OWN endpoint, not folded into the generic treatmentPlan
// PATCH: the generic PATCH accepts an arbitrary doctor-edited lineup and has
// no way to tell "the doctor reordered kits" from "the doctor substituted
// one" — so it cannot enforce the one rule this feature exists for:
//
//   canonicalKitId + alternativeKitId must be the EXACT approved pair
//   (lib/commerce/budgetSubstitution.ts). Reject everything else.
//
// The price shown to the doctor and persisted here is ALWAYS resolved
// server-side from the governed price table — the request body carries only
// kit ids, never an amount, so there is no field for a client to submit an
// arbitrary price through.
//
// Persistence reuses the existing versioned consultation machinery: this
// route computes the next treatmentPlan.kitPhases and calls the SAME
// orchestrator.revise() the generic PATCH route uses, so a substitution is a
// new immutable ConsultationVersion exactly like any other doctor edit —
// nothing here bypasses optimistic concurrency, audit, or approval gating.

import { NextResponse } from "next/server";
import type { TreatmentPhase } from "@shared/types/consultation";
import { prisma } from "@/lib/prisma";
import { requireDoctorContext, assertDoctorInClinic } from "@/lib/auth";
import { makeOrchestrator, OrchestratorError } from "@hairos/packages/consultation-orchestrator";
import { newRequestId } from "@/lib/consultation/loadReview";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";
import { getKitInfo } from "@hairos/packages/registries/kits/info";
import {
  isApprovedSubstitutionPairForKitId,
  resolveSubstitutionPriceComparisonForKitId,
} from "@/lib/commerce/budgetSubstitution";

export const dynamic = "force-dynamic";

const orchestrator = makeOrchestrator(prisma);

type SubstitutionMeta = {
  substitution?: {
    type: "BUDGET";
    reason: "BUDGET_AFFORDABILITY";
    originalKitId: string;
    /** The complete pre-substitution phase, so Restore needs no further lookup and fabricates nothing. */
    originalPhase: TreatmentPhase;
    changedBy: string;
    changedAt: string;
    priceAtSubstitutionMinor: { canonical: number; alternative: number };
  };
  addedByDoctor?: boolean;
};

type EditedPhase = TreatmentPhase & { meta?: SubstitutionMeta; doctorEdited?: boolean };

function errorResponse(status: number, code: string, message: string, requestId: string) {
  return NextResponse.json({ error: code, message, requestId }, { status });
}

/** Strip a phase down to plain TreatmentPhase fields — no nested meta.substitution, no doctorEdited flag carried forward into a restore snapshot. */
function bareCopy(phase: EditedPhase): TreatmentPhase {
  const { meta: _meta, doctorEdited: _doctorEdited, ...rest } = phase;
  void _meta;
  void _doctorEdited;
  return rest as TreatmentPhase;
}

export async function POST(
  req: Request,
  ctxParam: { params: Promise<{ assessmentId: string }> },
) {
  const requestId = newRequestId();
  const authResult = await requireDoctorContext();
  if (authResult instanceof NextResponse) {
    const code = authResult.status === 401 ? "UNAUTHENTICATED" : "FORBIDDEN";
    return errorResponse(authResult.status, code, "Not authorised.", requestId);
  }
  const { doctor, authUserId, authRole, mode } = authResult;
  const { assessmentId } = await ctxParam.params;

  const target = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: { clinicId: true },
  });
  if (!target) return errorResponse(404, "ASSESSMENT_NOT_FOUND", "This assessment is no longer available.", requestId);
  if (assertDoctorInClinic(doctor, target.clinicId)) {
    return errorResponse(404, "ASSESSMENT_NOT_FOUND", "This assessment is no longer available.", requestId);
  }

  const body = (await req.json().catch(() => ({}))) as {
    action?: unknown;
    originalKitId?: unknown;
    alternativeKitId?: unknown;
    currentKitId?: unknown;
    expectedContentVersion?: unknown;
  };

  const ctx = { actorId: doctor.id, role: authRole, clinicId: doctor.clinicId };
  const expectedContentVersion =
    typeof body.expectedContentVersion === "number" ? body.expectedContentVersion : undefined;

  try {
    const current = await orchestrator.getOrCreateDetailed({ assessmentId, ctx });
    const phases = current.content.treatmentPlan.kitPhases as EditedPhase[];

    if (body.action === "SUBSTITUTE") {
      const originalKitId = typeof body.originalKitId === "string" ? body.originalKitId : "";
      const alternativeKitId = typeof body.alternativeKitId === "string" ? body.alternativeKitId : "";

      const index = phases.findIndex((p) => p.kitId === originalKitId);
      if (index === -1) {
        return errorResponse(
          400,
          "KIT_NOT_IN_LINEUP",
          "That kit is not in the current prescription — it may already have been changed.",
          requestId,
        );
      }

      // Fail closed: the pair must match the approved table EXACTLY, once
      // originalKitId (which may be the raw clinical spelling actually
      // stored on the phase — see budgetSubstitution.ts's header note) is
      // resolved to its canonical identity. No fuzzy match, no accepting an
      // alternative approved for a DIFFERENT canonical kit, no
      // client-declared "budget" swap to an arbitrary id.
      if (!isApprovedSubstitutionPairForKitId(originalKitId, alternativeKitId)) {
        return errorResponse(
          400,
          "SUBSTITUTION_NOT_APPROVED",
          "That is not an approved budget alternative for this kit.",
          requestId,
        );
      }

      const priceComparison = resolveSubstitutionPriceComparisonForKitId(originalKitId, alternativeKitId);
      if (!priceComparison || !priceComparison.bothPricesApproved) {
        // Should not be reachable given the reconciled price table, but the
        // rule stands even if a future edit removes an approved price: no
        // substitution may be applied — and therefore no price shown as
        // saved — without both sides having a governed, approved price.
        return errorResponse(
          409,
          "SUBSTITUTION_PRICE_NOT_APPROVED",
          "This alternative does not currently have an approved price.",
          requestId,
        );
      }

      const alternativeInfo = getKitInfo(alternativeKitId);
      if (!alternativeInfo) {
        return errorResponse(500, "ALTERNATIVE_KIT_UNREGISTERED", "This alternative kit is not registered.", requestId);
      }

      const originalPhase = phases[index]!;
      const changedAt = new Date().toISOString();
      const newPhase: EditedPhase = {
        ...bareCopy(originalPhase),
        kitId: alternativeKitId,
        displayName: alternativeInfo.displayName,
        whySelected: `Doctor-selected budget alternative to ${originalPhase.displayName}, for affordability.`,
        // Ingredient/mechanism content is not fabricated for a product this
        // registry has no dermatology-authored content for — see
        // src/packages/registries/kits/info.ts.
        keyIngredients: [],
        mechanismOfAction: [],
        formulationGroups: [],
        meta: {
          substitution: {
            type: "BUDGET",
            reason: "BUDGET_AFFORDABILITY",
            originalKitId,
            originalPhase: bareCopy(originalPhase),
            changedBy: doctor.id,
            changedAt,
            priceAtSubstitutionMinor: {
              canonical: priceComparison.canonicalPriceMinor!,
              alternative: priceComparison.alternativePriceMinor!,
            },
          },
        },
        doctorEdited: true,
      };

      const nextPhases = phases.slice();
      nextPhases[index] = newPhase;
      const nextTreatmentPlan = { ...current.content.treatmentPlan, kitPhases: nextPhases };

      const stored = await orchestrator.revise({
        assessmentId,
        ctx,
        edits: { treatmentPlan: nextTreatmentPlan },
        expectedContentVersion,
      });

      await writeAuditLog({
        action: "KIT_BUDGET_SUBSTITUTION_APPLIED",
        entityType: "Consultation",
        entityId: stored.consultationId,
        actorId: authUserId,
        actorRole: authRole,
        actorType: mode,
        assessmentId,
        metadata: {
          clinicId: doctor.clinicId,
          actingDoctorId: doctor.id,
          mode,
          contentVersion: stored.contentVersion,
          originalKitId,
          alternativeKitId,
          canonicalPriceMinor: priceComparison.canonicalPriceMinor,
          alternativePriceMinor: priceComparison.alternativePriceMinor,
          savingMinor: priceComparison.savingMinor,
        },
      }).catch((err) => console.error("[kit-substitution.substitute] audit failed", err));

      return NextResponse.json({ consultation: stored.content, contentVersion: stored.contentVersion });
    }

    if (body.action === "RESTORE") {
      const currentKitId = typeof body.currentKitId === "string" ? body.currentKitId : "";
      const index = phases.findIndex((p) => p.kitId === currentKitId);
      const substitution = index >= 0 ? phases[index]!.meta?.substitution : undefined;

      if (index === -1 || !substitution) {
        return errorResponse(
          400,
          "NOT_SUBSTITUTED",
          "That kit was not the result of a budget substitution.",
          requestId,
        );
      }

      const nextPhases = phases.slice();
      nextPhases[index] = substitution.originalPhase;
      const nextTreatmentPlan = { ...current.content.treatmentPlan, kitPhases: nextPhases };

      const stored = await orchestrator.revise({
        assessmentId,
        ctx,
        edits: { treatmentPlan: nextTreatmentPlan },
        expectedContentVersion,
      });

      await writeAuditLog({
        action: "KIT_BUDGET_SUBSTITUTION_RESTORED",
        entityType: "Consultation",
        entityId: stored.consultationId,
        actorId: authUserId,
        actorRole: authRole,
        actorType: mode,
        assessmentId,
        metadata: {
          clinicId: doctor.clinicId,
          actingDoctorId: doctor.id,
          mode,
          contentVersion: stored.contentVersion,
          restoredKitId: substitution.originalKitId,
          wasKitId: currentKitId,
        },
      }).catch((err) => console.error("[kit-substitution.restore] audit failed", err));

      return NextResponse.json({ consultation: stored.content, contentVersion: stored.contentVersion });
    }

    return errorResponse(400, "UNKNOWN_ACTION", "Unrecognised action.", requestId);
  } catch (err) {
    if (err instanceof OrchestratorError) {
      const status =
        err.code === "not_found" ? 404 : err.code === "forbidden" ? 403 : err.code === "not_composable" ? 422 : 409;
      return NextResponse.json({ error: err.code, message: err.message, requestId }, { status });
    }
    console.error(
      "[KIT_SUBSTITUTION_API_FAIL]",
      requestId,
      err instanceof Error ? `${err.name}: ${err.message}` : String(err),
    );
    return errorResponse(500, "KIT_SUBSTITUTION_FAILED", "We couldn't save this change. Please retry.", requestId);
  }
}
