import { createHash } from "node:crypto";
import type { ConflictDraft, FiveKitDraftManifest, FiveKitId, KnowledgeClaimDraft, StructuredFactDraft } from "./fiveKitSlice";

export type GovernanceStatus = "RESOLVED" | "INTENTIONALLY_PARKED" | "STILL_BLOCKING" | "NOT_REQUIRED_FOR_PUBLICATION";
export type GovernanceSeverity = "HIGH" | "MEDIUM" | "LOW";
export type MissingReason = "EXPECTED_NULL" | "CONFIDENTIAL" | "NOT_APPLICABLE" | "SOURCE_INCOMPLETE" | "PUBLICATION_BLOCKING" | "PRICE_REVISION_PARKED";

export type GovernedFactRecord = {
  factId: string;
  entityType: StructuredFactDraft["entityType"];
  entityId: string;
  field: string;
  value: unknown;
  status: GovernanceStatus;
  severity: GovernanceSeverity;
  reason: string;
  governancePublicationBlocking: boolean;
  safeForInternalRagTesting: boolean;
  safeForPatientPublication: boolean;
  mustRemainBlocked: boolean;
  requiredForPatientPublication: boolean;
  missingReason: MissingReason | null;
  provenance: StructuredFactDraft["provenance"];
};

export type GovernedMissingValueRecord = GovernedFactRecord & {
  rawMissingValue: true;
};

export type GovernedPriceRecord = GovernedFactRecord & {
  parkReason: "PENDING_PRICE_REVISION";
};

export type GovernedClaimReviewRecord = {
  claimId: string;
  chunkId: string;
  kitId: FiveKitId;
  claimType: KnowledgeClaimDraft["claimType"];
  audience: KnowledgeClaimDraft["audience"];
  claimText: string;
  status: GovernanceStatus;
  severity: GovernanceSeverity;
  reason: string;
  governancePublicationBlocking: boolean;
  safeForInternalRagTesting: boolean;
  safeForPatientPublication: boolean;
  mustRemainBlocked: boolean;
  requiredApprovals: string[];
  replacementRequired: true;
  queueStatus: "AWAITING_AUTHORIZED_HAIROS_CONTENT";
  provenance: KnowledgeClaimDraft["provenance"];
};

export type GovernedConflictGroup = {
  id: string;
  conflictType: ConflictDraft["type"];
  entity: string;
  fieldOrClaim: string;
  kitIds: FiveKitId[];
  impactCount: number;
  conflictIds: string[];
  status: GovernanceStatus;
  severity: GovernanceSeverity;
  reason: string;
  governancePublicationBlocking: boolean;
  safeForInternalRagTesting: boolean;
  safeForPatientPublication: boolean;
  mustRemainBlocked: boolean;
  authoritativeResolutionAvailable: boolean;
  recommendedDecision: string;
  conflicts: ConflictDraft[];
};

export type MetaBIdentityAudit = {
  canonicalId: "KIT_PRO_FACT_META_B";
  officialName: "PRO FACT META B";
  aliases: string[];
  variants: Array<{ kitId: FiveKitId; canonicalName: string }>;
  status: GovernanceStatus;
  severity: GovernanceSeverity;
  reason: string;
  governancePublicationBlocking: boolean;
  safeForInternalRagTesting: boolean;
  safeForPatientPublication: boolean;
  mustRemainBlocked: boolean;
};

export type GovernanceRecordRef = {
  recordType: "FACT" | "CLAIM" | "CONFLICT_GROUP" | "META_B_IDENTITY";
  id: string;
  kitId?: FiveKitId;
  entityId?: string;
  field?: string;
  reason: string;
  severity: GovernanceSeverity;
};

export type GovernanceAudit = {
  generatedAt: string;
  counts: {
    raw: {
      missingValues: number;
      conflictImpacts: number;
      priceRecords: number;
      blockedClaims: number;
    };
    statuses: Record<GovernanceStatus, number>;
    byCategory: {
      missingValues: Record<GovernanceStatus, number>;
      conflictGroups: Record<GovernanceStatus, number>;
      claims: Record<GovernanceStatus, number>;
      priceRecords: Record<GovernanceStatus, number>;
      metaBIdentity: Record<GovernanceStatus, number>;
    };
    groupedConflictCount: number;
    routeNullsNotRequired: number;
    publicationBlockingQuantityGaps: number;
    parseableQuantityGapImpacts: number;
  };
  comparison: {
    previousReported: {
      blockedClaims: number;
      conflictGroups: number;
      ambiguousGenericMetaBMapping: "BLOCKING";
      priceRecords: "PENDING_REVISION";
      missingValues: number;
    };
    current: {
      blockedClaims: { status: GovernanceStatus; count: number };
      conflictImpacts: number;
      conflictGroups: { status: GovernanceStatus; count: number };
      ambiguousGenericMetaBMapping: GovernanceStatus;
      priceRecords: { status: GovernanceStatus; count: number };
      missingValues: {
        totalRaw: number;
        routeNullsNotRequired: number;
        publicationBlockingQuantityGaps: number;
      };
    };
  };
  metaBIdentity: MetaBIdentityAudit;
  missingValues: GovernedMissingValueRecord[];
  priceRecords: GovernedPriceRecord[];
  claimReviewQueue: GovernedClaimReviewRecord[];
  conflictGroups: GovernedConflictGroup[];
  remainingBlockersByKit: Array<{
    kitId: FiveKitId;
    severity: GovernanceSeverity;
    blockers: GovernanceRecordRef[];
  }>;
  decisionsRequired: string[];
  safeForInternalRagTesting: GovernanceRecordRef[];
  safeForPatientPublication: GovernanceRecordRef[];
  mustRemainBlocked: GovernanceRecordRef[];
  recommendedImplementationSequence: string[];
};

type FactKitIndex = {
  byProductId: Map<string, FiveKitId[]>;
};

const PRICE_FIELDS = new Set([
  "mrp",
  "gstPercent",
  "mrpExcludingGst",
  "gstAmount",
  "previousMrp",
  "doctorPrice",
  "sellingPrice",
  "discount",
  "priceEffectiveDate",
  "calculatedTotal",
]);

const statusCounter = (): Record<GovernanceStatus, number> => ({
  RESOLVED: 0,
  INTENTIONALLY_PARKED: 0,
  STILL_BLOCKING: 0,
  NOT_REQUIRED_FOR_PUBLICATION: 0,
});

const stableId = (...parts: unknown[]): string =>
  createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 32);

function isPriceField(field: string): boolean {
  return PRICE_FIELDS.has(field);
}

function uniqueKitIds(values: Iterable<FiveKitId>): FiveKitId[] {
  return [...new Set(values)];
}

function isParseableQuantityText(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return /^\s*-?\d+(?:\.\d+)?(?:\s+[A-Za-z%]+)+\s*$/i.test(value.trim());
}

function buildFactKitIndex(manifest: FiveKitDraftManifest): FactKitIndex {
  const byProductId = new Map<string, FiveKitId[]>();
  for (const fact of manifest.structuredFacts) {
    if (fact.entityType !== "KIT_COMPONENT" || fact.field !== "productId" || typeof fact.value !== "string") continue;
    const kitId = fact.entityId.split(":")[0] as FiveKitId;
    byProductId.set(fact.value, [...(byProductId.get(fact.value) ?? []), kitId]);
  }
  return { byProductId };
}

function kitIdsForConflict(conflict: ConflictDraft, index: FactKitIndex): FiveKitId[] {
  if (conflict.entity.startsWith("KIT_")) return [conflict.entity as FiveKitId];
  const [productId] = conflict.entity.split(":");
  return uniqueKitIds(index.byProductId.get(productId) ?? []);
}

function conflictSeverity(type: ConflictDraft["type"]): GovernanceSeverity {
  if (type === "MISSING_QUANTITY" || type === "DUPLICATE_PRODUCT" || type === "ALIAS_AMBIGUITY") return "HIGH";
  return "MEDIUM";
}

function classifyMissingValue(fact: StructuredFactDraft): GovernedMissingValueRecord {
  if (isPriceField(fact.field)) {
    return {
      factId: fact.id,
      entityType: fact.entityType,
      entityId: fact.entityId,
      field: fact.field,
      value: fact.value,
      status: "INTENTIONALLY_PARKED",
      severity: "LOW",
      reason: "PENDING_PRICE_REVISION",
      governancePublicationBlocking: true,
      safeForInternalRagTesting: false,
      safeForPatientPublication: false,
      mustRemainBlocked: true,
      requiredForPatientPublication: true,
      missingReason: "PRICE_REVISION_PARKED",
      provenance: fact.provenance,
      rawMissingValue: true,
    };
  }
  if (fact.field === "route" && fact.value === null) {
    return {
      factId: fact.id,
      entityType: fact.entityType,
      entityId: fact.entityId,
      field: fact.field,
      value: fact.value,
      status: "NOT_REQUIRED_FOR_PUBLICATION",
      severity: "LOW",
      reason: "ROUTE_NOT_CAPTURED_IN_SOURCE_AND_NOT_REQUIRED_FOR_PATIENT_PUBLICATION",
      governancePublicationBlocking: false,
      safeForInternalRagTesting: true,
      safeForPatientPublication: true,
      mustRemainBlocked: false,
      requiredForPatientPublication: false,
      missingReason: "NOT_APPLICABLE",
      provenance: fact.provenance,
      rawMissingValue: true,
    };
  }
  return {
    factId: fact.id,
    entityType: fact.entityType,
    entityId: fact.entityId,
    field: fact.field,
    value: fact.value,
    status: "STILL_BLOCKING",
    severity: "HIGH",
    reason: fact.field === "quantity" ? "PUBLICATION_BLOCKING_QUANTITY_GAP" : "SOURCE_INCOMPLETE",
    governancePublicationBlocking: true,
    safeForInternalRagTesting: false,
    safeForPatientPublication: false,
    mustRemainBlocked: true,
    requiredForPatientPublication: true,
    missingReason: fact.field === "quantity" ? "PUBLICATION_BLOCKING" : "SOURCE_INCOMPLETE",
    provenance: fact.provenance,
    rawMissingValue: true,
  };
}

function classifyPriceRecord(fact: StructuredFactDraft): GovernedPriceRecord {
  return {
    factId: fact.id,
    entityType: fact.entityType,
    entityId: fact.entityId,
    field: fact.field,
    value: fact.value,
    status: "INTENTIONALLY_PARKED",
    severity: "LOW",
    reason: "PENDING_PRICE_REVISION",
    governancePublicationBlocking: true,
    safeForInternalRagTesting: false,
    safeForPatientPublication: false,
    mustRemainBlocked: true,
    requiredForPatientPublication: true,
    missingReason: fact.conflictStatus === "MISSING" ? "PRICE_REVISION_PARKED" : null,
    provenance: fact.provenance,
    parkReason: "PENDING_PRICE_REVISION",
  };
}

function classifyClaim(claim: KnowledgeClaimDraft): GovernedClaimReviewRecord {
  const requiredApprovals = ["MEDICAL_REVIEW", "EVIDENCE_CONFIRMATION"];
  if (claim.claimType === "COMMERCIAL_FACT") requiredApprovals.push("COMMERCIAL_REVIEW");
  return {
    claimId: claim.claimId,
    chunkId: claim.chunkId,
    kitId: claim.kitId,
    claimType: claim.claimType,
    audience: claim.audience,
    claimText: claim.claimText,
    status: "STILL_BLOCKING",
    severity: "HIGH",
    reason: "AWAITING_AUTHORIZED_HAIROS_CONTENT_AND_REVIEW",
    governancePublicationBlocking: true,
    safeForInternalRagTesting: false,
    safeForPatientPublication: false,
    mustRemainBlocked: true,
    requiredApprovals,
    replacementRequired: true,
    queueStatus: "AWAITING_AUTHORIZED_HAIROS_CONTENT",
    provenance: claim.provenance,
  };
}

function classifyConflictGroups(manifest: FiveKitDraftManifest): GovernedConflictGroup[] {
  const index = buildFactKitIndex(manifest);
  const grouped = new Map<string, ConflictDraft[]>();
  for (const conflict of manifest.conflicts) {
    const key = [conflict.type, conflict.entity, conflict.fieldOrClaim, JSON.stringify(conflict.valueA), JSON.stringify(conflict.valueB)].join("|");
    grouped.set(key, [...(grouped.get(key) ?? []), conflict]);
  }
  const groups = [...grouped.entries()].map(([key, conflicts]) => {
    const sample = conflicts[0];
    const authoritativeResolutionAvailable = conflicts.every((item) => item.type === "MISSING_QUANTITY" && isParseableQuantityText(item.valueA));
    const reason = sample.type === "DUPLICATE_PRODUCT"
      ? "PRODUCT_IDENTITY_REMAINS_AMBIGUOUS"
      : sample.type === "MISSING_QUANTITY" && authoritativeResolutionAvailable
        ? "SOURCE_HAS_PARSEABLE_QUANTITY_TEXT_BUT_NO_GOVERNED_NORMALIZATION_DECISION"
        : sample.type === "MISSING_QUANTITY"
          ? "AUTHORITATIVE_QUANTITY_VALUE_IS_STILL_MISSING"
          : sample.type === "INCOMPLETE_KIT"
            ? "REQUIRED_NARRATIVE_SECTION_IS_MISSING"
            : "UNRESOLVED_CONTRADICTION_OR_IDENTITY_DECISION";
    const recommendedDecision = sample.type === "DUPLICATE_PRODUCT"
      ? "Confirm whether F-TRICHOGROW+ is an approved alias of an existing canonical product or a distinct canonical product."
      : sample.type === "MISSING_QUANTITY" && authoritativeResolutionAvailable
        ? "Confirm the normalized numeric quantity and unit from the cited source text, then approve it under governed review."
        : sample.type === "INCOMPLETE_KIT"
          ? "Provide the missing governed narrative section from authorized HairOS science."
          : sample.recommendedAction;
    return {
      id: `conflict_group_${stableId(key)}`,
      conflictType: sample.type,
      entity: sample.entity,
      fieldOrClaim: sample.fieldOrClaim,
      kitIds: uniqueKitIds(conflicts.flatMap((item) => kitIdsForConflict(item, index))),
      impactCount: conflicts.length,
      conflictIds: conflicts.map((item) => item.id),
      status: "STILL_BLOCKING" as const,
      severity: conflictSeverity(sample.type),
      reason,
      governancePublicationBlocking: true,
      safeForInternalRagTesting: false,
      safeForPatientPublication: false,
      mustRemainBlocked: true,
      authoritativeResolutionAvailable,
      recommendedDecision,
      conflicts,
    };
  });
  return groups.sort((left, right) => right.impactCount - left.impactCount || left.entity.localeCompare(right.entity));
}

function buildMetaBIdentityAudit(manifest: FiveKitDraftManifest): MetaBIdentityAudit {
  const baseKit = manifest.kits.find((kit) => kit.kitId === "KIT_PRO_FACT_META_B");
  const aliases = ["PRO FACT META B", "Meta B", "Profact Meta B", "Pro Fact Meta B"];
  const variants = manifest.kits
    .filter((kit) => ["KIT_PRO_FACT_META_B_PCOS", "KIT_PRO_FACT_META_B_THYROID", "KIT_PRO_FACT_META_B_MENOPAUSE"].includes(kit.kitId))
    .map((kit) => ({ kitId: kit.kitId, canonicalName: kit.canonicalName }));
  return {
    canonicalId: "KIT_PRO_FACT_META_B",
    officialName: "PRO FACT META B",
    aliases: [...new Set([...(baseKit?.aliases ?? []), ...aliases].filter((alias) => aliases.includes(alias)))],
    variants,
    status: "RESOLVED",
    severity: "LOW",
    reason: "GENERIC_META_B_NOW_RESOLVES_TO_THE_STANDALONE_BASE_KIT_WITH_VARIANTS_KEPT_DISTINCT",
    governancePublicationBlocking: false,
    safeForInternalRagTesting: true,
    safeForPatientPublication: true,
    mustRemainBlocked: false,
  };
}

function summarizeByKit(
  claims: GovernedClaimReviewRecord[],
  conflicts: GovernedConflictGroup[],
  missingValues: GovernedMissingValueRecord[],
): Array<{ kitId: FiveKitId; severity: GovernanceSeverity; blockers: GovernanceRecordRef[] }> {
  const kitIds = new Set<FiveKitId>();
  for (const claim of claims) kitIds.add(claim.kitId);
  for (const group of conflicts) for (const kitId of group.kitIds) kitIds.add(kitId);
  for (const fact of missingValues) {
    const candidate = fact.entityId.split(":")[0];
    if (candidate.startsWith("KIT_")) kitIds.add(candidate as FiveKitId);
  }
  return [...kitIds].sort().map((kitId) => {
    const blockers: GovernanceRecordRef[] = [];
    for (const claim of claims.filter((item) => item.kitId === kitId)) {
      blockers.push({ recordType: "CLAIM", id: claim.claimId, kitId, reason: claim.reason, severity: claim.severity });
    }
    for (const group of conflicts.filter((item) => item.kitIds.includes(kitId))) {
      blockers.push({ recordType: "CONFLICT_GROUP", id: group.id, kitId, reason: group.reason, severity: group.severity });
    }
    for (const fact of missingValues.filter((item) => item.status === "STILL_BLOCKING" && item.entityId.startsWith(`${kitId}:`))) {
      blockers.push({ recordType: "FACT", id: fact.factId, kitId, entityId: fact.entityId, field: fact.field, reason: fact.reason, severity: fact.severity });
    }
    const severity = blockers.some((item) => item.severity === "HIGH") ? "HIGH" : blockers.length ? "MEDIUM" : "LOW";
    return { kitId, severity, blockers };
  });
}

export function deriveFiveKitGovernanceAudit(manifest: FiveKitDraftManifest): GovernanceAudit {
  const missingValues = manifest.structuredFacts.filter((fact) => fact.conflictStatus === "MISSING").map(classifyMissingValue);
  const priceRecords = manifest.structuredFacts.filter((fact) => isPriceField(fact.field)).map(classifyPriceRecord);
  const claimReviewQueue = manifest.claims.map(classifyClaim);
  const conflictGroups = classifyConflictGroups(manifest);
  const metaBIdentity = buildMetaBIdentityAudit(manifest);

  const byCategory = {
    missingValues: statusCounter(),
    conflictGroups: statusCounter(),
    claims: statusCounter(),
    priceRecords: statusCounter(),
    metaBIdentity: statusCounter(),
  };
  const statuses = statusCounter();

  for (const record of missingValues) {
    byCategory.missingValues[record.status] += 1;
    statuses[record.status] += 1;
  }
  for (const record of conflictGroups) {
    byCategory.conflictGroups[record.status] += 1;
    statuses[record.status] += 1;
  }
  for (const record of claimReviewQueue) {
    byCategory.claims[record.status] += 1;
    statuses[record.status] += 1;
  }
  for (const record of priceRecords) {
    byCategory.priceRecords[record.status] += 1;
    statuses[record.status] += 1;
  }
  byCategory.metaBIdentity[metaBIdentity.status] += 1;
  statuses[metaBIdentity.status] += 1;

  const routeNullsNotRequired = missingValues.filter((record) => record.status === "NOT_REQUIRED_FOR_PUBLICATION").length;
  const publicationBlockingQuantityGaps = missingValues.filter((record) => record.field === "quantity" && record.status === "STILL_BLOCKING").length;
  const parseableQuantityGapImpacts = conflictGroups
    .filter((record) => record.conflictType === "MISSING_QUANTITY" && record.authoritativeResolutionAvailable)
    .reduce((sum, record) => sum + record.impactCount, 0);
  const sourceIncompleteQuantityGaps = publicationBlockingQuantityGaps - parseableQuantityGapImpacts;

  const safeForInternalRagTesting: GovernanceRecordRef[] = [
    ...missingValues
      .filter((record) => record.safeForInternalRagTesting)
      .map((record) => ({ recordType: "FACT" as const, id: record.factId, entityId: record.entityId, field: record.field, reason: record.reason, severity: record.severity })),
    {
      recordType: "META_B_IDENTITY",
      id: metaBIdentity.canonicalId,
      kitId: metaBIdentity.canonicalId,
      reason: metaBIdentity.reason,
      severity: metaBIdentity.severity,
    },
  ];

  const safeForPatientPublication: GovernanceRecordRef[] = [
    ...missingValues
      .filter((record) => record.safeForPatientPublication && !record.mustRemainBlocked)
      .map((record) => ({ recordType: "FACT" as const, id: record.factId, entityId: record.entityId, field: record.field, reason: record.reason, severity: record.severity })),
    {
      recordType: "META_B_IDENTITY",
      id: metaBIdentity.canonicalId,
      kitId: metaBIdentity.canonicalId,
      reason: metaBIdentity.reason,
      severity: metaBIdentity.severity,
    },
  ];

  const mustRemainBlocked: GovernanceRecordRef[] = [
    ...priceRecords.map((record) => ({ recordType: "FACT" as const, id: record.factId, entityId: record.entityId, field: record.field, reason: record.reason, severity: record.severity })),
    ...missingValues
      .filter((record) => record.mustRemainBlocked)
      .map((record) => ({ recordType: "FACT" as const, id: record.factId, entityId: record.entityId, field: record.field, reason: record.reason, severity: record.severity })),
    ...claimReviewQueue.map((record) => ({ recordType: "CLAIM" as const, id: record.claimId, kitId: record.kitId, reason: record.reason, severity: record.severity })),
    ...conflictGroups.map((record) => ({ recordType: "CONFLICT_GROUP" as const, id: record.id, kitId: record.kitIds[0], reason: record.reason, severity: record.severity })),
  ];

  return {
    generatedAt: manifest.generatedAt,
    counts: {
      raw: {
        missingValues: missingValues.length,
        conflictImpacts: manifest.conflicts.length,
        priceRecords: priceRecords.length,
        blockedClaims: claimReviewQueue.length,
      },
      statuses,
      byCategory,
      groupedConflictCount: conflictGroups.length,
      routeNullsNotRequired,
      publicationBlockingQuantityGaps,
      parseableQuantityGapImpacts,
    },
    comparison: {
      previousReported: {
        blockedClaims: 49,
        conflictGroups: 13,
        ambiguousGenericMetaBMapping: "BLOCKING",
        priceRecords: "PENDING_REVISION",
        missingValues: 222,
      },
      current: {
        blockedClaims: { status: "STILL_BLOCKING", count: claimReviewQueue.length },
        conflictImpacts: manifest.conflicts.length,
        conflictGroups: { status: "STILL_BLOCKING", count: conflictGroups.length },
        ambiguousGenericMetaBMapping: metaBIdentity.status,
        priceRecords: { status: "INTENTIONALLY_PARKED", count: priceRecords.length },
        missingValues: {
          totalRaw: missingValues.length,
          routeNullsNotRequired,
          publicationBlockingQuantityGaps,
        },
      },
    },
    metaBIdentity,
    missingValues,
    priceRecords,
    claimReviewQueue,
    conflictGroups,
    remainingBlockersByKit: summarizeByKit(claimReviewQueue, conflictGroups, missingValues),
    decisionsRequired: [
      "Provide authorized HairOS science replacement content, evidence, and medical approval for all 49 narrative claims before any patient-facing publication.",
      "Resolve the F-TRICHOGROW+ product identity by approving an exact alias or creating a distinct canonical product with governed mappings.",
      "Provide the missing governed narrative section for KIT_TE_GOLD indication coverage and KIT_GI_HEALTH_GOLD conclusion coverage.",
      `Enter or approve ${sourceIncompleteQuantityGaps} source-incomplete quantity gaps from authoritative commercial or product source material.`,
      `Review and normalize the ${parseableQuantityGapImpacts} source-parseable formulation quantity impacts under governed review rather than silently inferring them.`,
      "Keep all price records parked under PENDING_PRICE_REVISION until the commercial revision package is explicitly approved.",
    ],
    safeForInternalRagTesting,
    safeForPatientPublication,
    mustRemainBlocked,
    recommendedImplementationSequence: [
      "Import and review authorized HairOS science replacements for the 49 governed claims without changing the deterministic recommendation engine.",
      "Resolve the F-TRICHOGROW+ canonical product identity so product retrieval filters and mappings stop branching on ambiguity.",
      `Approve normalized values for the ${parseableQuantityGapImpacts} parseable formulation quantity impacts, then fill the remaining ${sourceIncompleteQuantityGaps} true quantity gaps from authoritative source material.`,
      "Backfill the two missing governed narrative sections for TE GOLD and GI HEALTH GOLD.",
      "Regenerate the draft-only governance outputs and verify the reviewer UI shows the updated conflict groups, quantity gaps, and claim review queue.",
      "Only after the content decisions above are recorded should any patient-publication workflow be considered; price records stay parked separately.",
    ],
  };
}