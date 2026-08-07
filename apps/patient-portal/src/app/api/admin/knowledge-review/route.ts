import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertSuperAdmin, handleAuthError } from "@/lib/auth";

export const dynamic = "force-dynamic";

const TARGET_KITS = ["KIT_TE_GOLD", "KIT_GI_HEALTH_GOLD", "KIT_PRO_IMMUNE_GOLD", "KIT_INFLAMMATION_PHENOTYPE", "KIT_PRO_FACT_META_B", "KIT_PRO_FACT_META_B_PCOS", "KIT_PRO_FACT_META_B_THYROID", "KIT_PRO_FACT_META_B_MENOPAUSE"];
const ACTIONS = new Set(["APPROVE", "REJECT", "EDIT_NORMALIZED_VALUE", "APPROVE_ALIAS", "REJECT_ALIAS", "MERGE_DUPLICATE", "SELECT_CANONICAL_VALUE", "MARK_INCOMPLETE", "REQUEST_MEDICAL_REVIEW", "REQUEST_COMMERCIAL_REVIEW", "PUBLISH_APPROVED_ITEM", "RETIRE_PREVIOUS_VERSION", "ROLLBACK_PUBLICATION"]);
const json = (value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull => value === null || value === undefined ? Prisma.JsonNull : value as Prisma.InputJsonValue;

type GovernancePayload = {
  counts?: unknown;
  metaBIdentity?: unknown;
  conflictGroups?: Array<Record<string, unknown>>;
  missingValues?: Array<Record<string, unknown>>;
  claimReviewQueue?: Array<Record<string, unknown>>;
  decisionsRequired?: string[];
  remainingBlockersByKit?: Array<Record<string, unknown>>;
  safeForInternalRagTesting?: Array<Record<string, unknown>>;
  safeForPatientPublication?: Array<Record<string, unknown>>;
  mustRemainBlocked?: Array<Record<string, unknown>>;
};

async function preview() {
  const now = new Date();
  const [anonymousClaims, patientClaims, doctorClaims, facts] = await prisma.$transaction([
    prisma.knowledgeClaim.count({ where: { subjectId: { in: TARGET_KITS }, approvalStatus: "PUBLISHED_PATIENT", patientVisible: true, audience: { in: ["PATIENT", "DOCTOR_AND_PATIENT"] }, evidenceStatus: "SUPPORTED", AND: [{ OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: now } }] }, { OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }] }] } }),
    prisma.knowledgeClaim.count({ where: { subjectId: { in: TARGET_KITS }, approvalStatus: "PUBLISHED_PATIENT", patientVisible: true, audience: { in: ["PATIENT", "DOCTOR_AND_PATIENT"] }, evidenceStatus: "SUPPORTED" } }),
    prisma.knowledgeClaim.count({ where: { subjectId: { in: TARGET_KITS }, approvalStatus: { in: ["PUBLISHED_INTERNAL", "PUBLISHED_PATIENT"] }, audience: { in: ["DOCTOR", "DOCTOR_AND_PATIENT"] }, evidenceStatus: "SUPPORTED" } }),
    prisma.structuredFactRecord.count({ where: { entityId: { in: TARGET_KITS }, publicationStatus: "PUBLISHED", approvalStatus: "APPROVED", conflictStatus: "NONE", formulaError: null, requiresReview: false } }),
  ]);
  return { anonymousPatient: { claims: anonymousClaims, exactFacts: facts }, authenticatedPatient: { claims: patientClaims, exactFacts: facts }, doctor: { claims: doctorClaims, exactFacts: facts } };
}

function candidateRoots(): string[] {
  return [
    process.cwd(),
    path.resolve(process.cwd(), ".."),
    path.resolve(process.cwd(), "..", ".."),
    path.resolve(process.cwd(), "..", "..", ".."),
  ];
}

async function loadGovernance(): Promise<GovernancePayload | null> {
  for (const root of candidateRoots()) {
    const filePath = path.join(root, "outputs", "five-kit-real-ingestion", "governance-audit.json");
    try {
      const content = await readFile(filePath, "utf8");
      return JSON.parse(content) as GovernancePayload;
    } catch {
      // Try the next candidate root.
    }
  }
  return null;
}

function filterByKit(records: Array<Record<string, unknown>>, kit: string | null): Array<Record<string, unknown>> {
  if (!kit) return records;
  return records.filter((record) => {
    const recordKitId = typeof record.kitId === "string" ? record.kitId : null;
    const kitIds = Array.isArray(record.kitIds) ? record.kitIds.filter((item): item is string => typeof item === "string") : [];
    const entityId = typeof record.entityId === "string" ? record.entityId : "";
    return recordKitId === kit || kitIds.includes(kit) || entityId.startsWith(`${kit}:`);
  });
}

export async function GET(request: Request) {
  try {
    await assertSuperAdmin();
    const query = new URL(request.url).searchParams;
    const kit = query.get("kit");
    const status = query.get("status");
    const conflict = query.get("conflict");
    const formulaError = query.get("formulaError");
    const kits = await prisma.kit.findMany({ where: { canonicalId: { in: TARGET_KITS } }, select: { id: true } });
    const [facts, claims, conflicts, aliases, governance, visibility] = await Promise.all([
      prisma.structuredFactRecord.findMany({ where: { ...(kit ? { entityId: { contains: kit } } : {}), ...(status ? { approvalStatus: status } : {}), ...(conflict === "true" ? { conflictStatus: { not: "NONE" } } : {}), ...(formulaError === "true" ? { formulaError: { not: null } } : {}) }, take: 250, orderBy: [{ entityId: "asc" }, { field: "asc" }] }),
      prisma.knowledgeClaim.findMany({ where: { subjectId: kit ? kit : { in: TARGET_KITS }, ...(status ? { approvalStatus: status as never } : {}) }, take: 250, orderBy: [{ subjectId: "asc" }, { claimType: "asc" }] }),
      prisma.knowledgeConflict.findMany({ where: { ...(kit ? { entity: { contains: kit } } : {}), ...(conflict === "true" ? { status: { not: "RESOLVED" } } : {}) }, take: 250, orderBy: [{ publicationBlocked: "desc" }, { severity: "desc" }, { createdAt: "asc" }] }),
      prisma.kitAlias.findMany({ where: { kitId: { in: kits.map((item) => item.id) } }, take: 250, orderBy: { alias: "asc" } }),
      loadGovernance(),
      preview(),
    ]);
    return NextResponse.json({
      facts,
      claims,
      conflicts,
      aliases,
      preview: visibility,
      allowedActions: [...ACTIONS],
      governance: {
        counts: governance?.counts ?? null,
        metaBIdentity: governance?.metaBIdentity ?? null,
        conflictGroups: filterByKit(governance?.conflictGroups ?? [], kit),
        quantityGaps: filterByKit((governance?.missingValues ?? []).filter((item) => item.field === "quantity" && item.status === "STILL_BLOCKING"), kit),
        claimQueue: filterByKit(governance?.claimReviewQueue ?? [], kit),
        decisionsRequired: governance?.decisionsRequired ?? [],
        remainingBlockersByKit: governance?.remainingBlockersByKit ?? [],
        safeForInternalRagTesting: governance?.safeForInternalRagTesting ?? [],
        safeForPatientPublication: governance?.safeForPatientPublication ?? [],
        mustRemainBlocked: governance?.mustRemainBlocked ?? [],
      },
    });
  } catch (error) {
    const auth = handleAuthError(error); if (auth) return auth;
    console.error("[KNOWLEDGE REVIEW GET]", error);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

type ActionBody = { action?: string; entityType?: string; entityId?: string; newValue?: unknown; reason?: string };

export async function POST(request: Request) {
  try {
    const ctx = await assertSuperAdmin();
    const body = await request.json() as ActionBody;
    if (!body.action || !ACTIONS.has(body.action) || !body.entityType || !body.entityId) return NextResponse.json({ error: "Invalid review action" }, { status: 400 });
    const action = body.action; const entityType = body.entityType; const entityId = body.entityId;
    const result = await prisma.$transaction(async (tx) => {
      let previousValue: unknown = null;
      let nextValue: unknown = body.newValue ?? null;
      if (entityType === "STRUCTURED_FACT") {
        const record = await tx.structuredFactRecord.findUnique({ where: { id: entityId } });
        if (!record) throw new Error("Structured fact not found");
        previousValue = record;
        if (action === "APPROVE") {
          if (record.conflictStatus !== "NONE" || record.formulaError || record.normalizedValue === null) throw new Error("Resolve conflict, formula error or missing value before approval");
          nextValue = await tx.structuredFactRecord.update({ where: { id: record.id }, data: { approvalStatus: "APPROVED", requiresReview: false } });
        } else if (action === "REJECT") nextValue = await tx.structuredFactRecord.update({ where: { id: record.id }, data: { approvalStatus: "REJECTED", requiresReview: false } });
        else if (action === "MARK_INCOMPLETE") nextValue = await tx.structuredFactRecord.update({ where: { id: record.id }, data: { approvalStatus: "INCOMPLETE", conflictStatus: "MISSING", requiresReview: true } });
        else if (action === "EDIT_NORMALIZED_VALUE") nextValue = await tx.structuredFactRecord.update({ where: { id: record.id }, data: { normalizedValue: json(body.newValue), approvalStatus: "DRAFT", requiresReview: true } });
        else if (action === "REQUEST_COMMERCIAL_REVIEW") nextValue = await tx.structuredFactRecord.update({ where: { id: record.id }, data: { approvalStatus: "PENDING_REVIEW", requiresReview: true } });
        else if (action === "PUBLISH_APPROVED_ITEM") nextValue = await tx.structuredFactRecord.update({ where: { id: record.id }, data: { publicationStatus: "PUBLISHED" } });
        else throw new Error("Action is not valid for a structured fact");
      } else if (entityType === "CLAIM") {
        const record = await tx.knowledgeClaim.findUnique({ where: { claimId: entityId } });
        if (!record) throw new Error("Claim not found");
        previousValue = record;
        if (action === "APPROVE") nextValue = await tx.knowledgeClaim.update({ where: { claimId: record.claimId }, data: { medicalReviewStatus: "APPROVED" } });
        else if (action === "REJECT") nextValue = await tx.knowledgeClaim.update({ where: { claimId: record.claimId }, data: { approvalStatus: "RETIRED", patientVisible: false, medicalReviewStatus: "REJECTED" } });
        else if (action === "REQUEST_MEDICAL_REVIEW") nextValue = await tx.knowledgeClaim.update({ where: { claimId: record.claimId }, data: { medicalReviewStatus: "PENDING_REVIEW", patientVisible: false } });
        else if (action === "REQUEST_COMMERCIAL_REVIEW") nextValue = await tx.knowledgeClaim.update({ where: { claimId: record.claimId }, data: { commercialReviewStatus: "PENDING_REVIEW", patientVisible: false } });
        else if (action === "PUBLISH_APPROVED_ITEM") {
          if (record.evidenceStatus !== "SUPPORTED" || record.medicalReviewStatus !== "APPROVED" || (record.claimType === "COMMERCIAL_FACT" && record.commercialReviewStatus !== "APPROVED")) throw new Error("Claim lacks required evidence or review approval");
          nextValue = await tx.knowledgeClaim.update({ where: { claimId: record.claimId }, data: { approvalStatus: "PUBLISHED_PATIENT", patientVisible: true } });
        } else throw new Error("Action is not valid for a claim");
      } else if (entityType === "CONFLICT") {
        const record = await tx.knowledgeConflict.findUnique({ where: { id: entityId } });
        if (!record) throw new Error("Conflict not found");
        previousValue = record;
        if (!["SELECT_CANONICAL_VALUE", "MERGE_DUPLICATE"].includes(action)) throw new Error("Action is not valid for a conflict");
        nextValue = await tx.knowledgeConflict.update({ where: { id: record.id }, data: { proposedCanonicalValue: json(body.newValue), resolution: body.reason ?? action, status: "RESOLVED", publicationBlocked: false, reviewRequired: false } });
      } else if (entityType === "KIT_ALIAS" || entityType === "PRODUCT_ALIAS") {
        const approved = action === "APPROVE_ALIAS";
        if (!approved && action !== "REJECT_ALIAS") throw new Error("Action is not valid for an alias");
        if (entityType === "KIT_ALIAS") {
          const record = await tx.kitAlias.findUnique({ where: { id: entityId } }); if (!record) throw new Error("Alias not found"); previousValue = record;
          nextValue = await tx.kitAlias.update({ where: { id: record.id }, data: { reviewStatus: approved ? "APPROVED" : "REJECTED", matchMethod: approved ? "APPROVED_ALIAS" : record.matchMethod } });
        } else {
          const record = await tx.productAlias.findUnique({ where: { id: entityId } }); if (!record) throw new Error("Alias not found"); previousValue = record;
          nextValue = await tx.productAlias.update({ where: { id: record.id }, data: { reviewStatus: approved ? "APPROVED" : "REJECTED", matchMethod: approved ? "APPROVED_ALIAS" : record.matchMethod } });
        }
      } else if (entityType === "DOCUMENT_VERSION" && ["RETIRE_PREVIOUS_VERSION", "ROLLBACK_PUBLICATION"].includes(action)) {
        const version = await tx.knowledgeDocumentVersion.findUnique({ where: { id: entityId } }); if (!version) throw new Error("Version not found"); previousValue = version;
        if (action === "RETIRE_PREVIOUS_VERSION") {
          nextValue = await tx.knowledgeDocumentVersion.update({ where: { id: version.id }, data: { status: "RETIRED", sourceStatus: "RETIRED", effectiveUntil: new Date() } });
        } else {
          if (!body.reason?.trim()) throw new Error("Rollback requires a reason");
          const previous = await tx.knowledgeDocumentVersion.findFirst({ where: { documentId: version.documentId, version: { lt: version.version }, status: { in: ["PUBLISHED_INTERNAL", "PUBLISHED_PATIENT"] } }, orderBy: { version: "desc" } });
          if (!previous) throw new Error("No previously published version is available for rollback");
          const now = new Date();
          await tx.knowledgeDocumentVersion.update({ where: { id: version.id }, data: { status: "RETIRED", sourceStatus: "RETIRED", effectiveUntil: now } });
          const restored = await tx.knowledgeDocumentVersion.update({ where: { id: previous.id }, data: { sourceStatus: "ACTIVE", effectiveFrom: now, effectiveUntil: null } });
          await tx.knowledgeDocument.update({ where: { id: version.documentId }, data: { status: restored.status, sourceStatus: "ACTIVE" } });
          await tx.knowledgeReviewAction.create({ data: { actorId: ctx.userId, action: "INVALIDATE_RETRIEVAL_CACHE", entityType: "DOCUMENT", entityId: version.documentId, previousValue: Prisma.JsonNull, newValue: json({ restoredVersionId: restored.id, retiredVersionId: version.id }), reason: "Rollback changed the active knowledge version" } });
          nextValue = restored;
        }
      } else throw new Error("Unsupported review entity type");
      await tx.knowledgeReviewAction.create({ data: { actorId: ctx.userId, action: action, entityType: entityType, entityId: entityId, previousValue: json(previousValue), newValue: json(nextValue), reason: body.reason } });
      return nextValue;
    });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const auth = handleAuthError(error); if (auth) return auth;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Internal" }, { status: 400 });
  }
}