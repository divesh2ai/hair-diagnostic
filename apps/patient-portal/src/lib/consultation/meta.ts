import type { StoredVersion } from "@hairos/packages/consultation-orchestrator";

/**
 * Approval + version metadata surfaced alongside the clinical content so the
 * doctor dashboard can render Approval Status / Version History without
 * recomputing anything. The consultation `content` stays the single source of
 * truth for clinical data; this is the non-clinical version envelope.
 */
export interface ConsultationMeta {
  contentVersion: number;
  approvalStatus: string;
  approvedBy: string | null;
  approvedAt: string | null;
  approvalNotes: string | null;
  createdAt: string;
  createdBy: string;
  lastUpdatedAt: string;
}

export function consultationMeta(stored: StoredVersion): ConsultationMeta {
  return {
    contentVersion: stored.contentVersion,
    approvalStatus: stored.metadata.approvalStatus ?? "PENDING_REVIEW",
    approvedBy: stored.metadata.approvedBy ?? null,
    approvedAt: stored.metadata.approvedAt ?? null,
    approvalNotes: stored.metadata.approvalNotes ?? null,
    createdAt: stored.createdAt,
    createdBy: stored.createdBy,
    lastUpdatedAt: stored.content.audit?.lastUpdatedAt ?? stored.createdAt,
  };
}
