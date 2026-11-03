// Pure, client-safe formatters for the operations dashboard. No server imports
// (no Prisma) so this can be used from the "use client" page and drawer.

import type { ClinicPrimaryStatus } from "./types";

/** Compact relative time, e.g. "3m", "5h", "2d", or "—" for null. */
export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diff = Date.now() - then;
  if (diff < 0) return "just now";
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

/** An absolute, timezone-explicit label for tooltips/detail. */
export function absoluteTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(d);
}

/** Integer paise → "₹1,234". Never used for a NOT_CONNECTED figure. */
export function formatInrFromMinor(amountMinor: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amountMinor / 100);
}

export const STATUS_LABEL: Record<ClinicPrimaryStatus, string> = {
  NEVER_LOGGED_IN: "Never logged in",
  NO_ASSESSMENTS: "No assessments",
  RECONCILIATION_DISCREPANCY: "Reconciliation discrepancy",
  MISSING_CONSULTATION: "Missing consultation",
  PENDING_REVIEW: "Awaiting doctor review",
  REPORT_DELIVERY_ATTENTION: "Report / delivery attention",
  ACTIVELY_USING: "Actively using HairOS",
  ONBOARDING_IDLE: "Onboarding / idle",
  SUSPENDED: "Suspended",
  ARCHIVED: "Archived",
};

export type BadgeTone = "success" | "warning" | "danger" | "neutral" | "info" | "brand";

export const STATUS_TONE: Record<ClinicPrimaryStatus, BadgeTone> = {
  NEVER_LOGGED_IN: "neutral",
  NO_ASSESSMENTS: "neutral",
  RECONCILIATION_DISCREPANCY: "danger",
  MISSING_CONSULTATION: "warning",
  PENDING_REVIEW: "warning",
  REPORT_DELIVERY_ATTENTION: "danger",
  ACTIVELY_USING: "success",
  ONBOARDING_IDLE: "info",
  SUSPENDED: "warning",
  ARCHIVED: "neutral",
};

/** The filter keys the clinic table exposes. */
export type ClinicFilterKey =
  | "all"
  | "neverLoggedIn"
  | "noAssessments"
  | "pendingReview"
  | "missingConsultation"
  | "reconciliationDiscrepancy"
  | "reportDeliveryAttention"
  | "activelyUsing";

export const FILTER_OPTIONS: { value: ClinicFilterKey; label: string }[] = [
  { value: "all", label: "All clinics" },
  { value: "neverLoggedIn", label: "Never logged in" },
  { value: "noAssessments", label: "No assessments" },
  { value: "pendingReview", label: "Awaiting doctor review" },
  { value: "missingConsultation", label: "Missing consultation / pipeline attention" },
  { value: "reconciliationDiscrepancy", label: "Reconciliation discrepancies" },
  { value: "reportDeliveryAttention", label: "Report / delivery attention" },
  { value: "activelyUsing", label: "Actively using HairOS" },
];

/** Human labels for the per-report readiness verdict (drilldown matrix). */
export const REPORT_READINESS_LABEL: Record<string, string> = {
  NOT_APPROVED: "Not approved",
  AVAILABLE: "Available",
  RETRIEVAL_FAILED: "Retrieval failed",
  ASSET_MISSING: "Asset missing",
  UNVERIFIABLE: "Unverifiable (storage)",
};
