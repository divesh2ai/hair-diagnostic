import type { DashboardCounts } from "@/lib/doctor/dashboardStats";

// What the dashboard's Needs-attention panel says, as a pure function.
//
// Extracted from the page component for one reason: this is the only place on
// the dashboard that makes a claim about something being WRONG, and a claim
// like that has to be testable without rendering React or standing up a
// database. Nothing else moved.
//
// ── Honesty rules, unchanged from the panel's own header ────────────────────
// Only exceptions the data can prove are listed, and the list is empty when
// nothing is wrong. No "all clear" line is emitted: the review-pathway
// classifier that would justify one is disabled, and asserting an all-clear we
// did not compute is the most dangerous thing this surface could do.

/** A row in the Needs-attention panel. Mirrors AttentionPanel's own props. */
export interface DashboardAttentionItem {
  key: string;
  icon: "reports" | "waiting" | "incomplete";
  title: string;
  detail: string;
  href?: string;
  tone: "danger" | "warning";
}

/** Minimal shape the builder needs from a queue row. */
export interface AttentionQueueRow {
  submittedAt: string | null;
}

/**
 * Long enough that a genuinely stuck case surfaces, short enough to be
 * actionable within a clinic session.
 */
export const LONG_WAIT_MS = 15 * 60 * 1000;

export function buildDashboardAttention(input: {
  counts: Pick<DashboardCounts, "needsAttention" | "unopenable">;
  /** The loaded deck slice — an observed floor, never the whole backlog. */
  queue: AttentionQueueRow[];
  /** Injected so the long-wait boundary is testable without faking timers. */
  now?: number;
}): DashboardAttentionItem[] {
  const { counts, queue } = input;
  const now = input.now ?? Date.now();
  const items: DashboardAttentionItem[] = [];

  if (counts.needsAttention && counts.needsAttention > 0) {
    const n = counts.needsAttention;
    items.push({
      key: "reports",
      icon: "reports",
      tone: "danger",
      title: `${n} ${n === 1 ? "report needs" : "reports need"} attention`,
      detail: "Report generation did not complete",
      href: "/doctor/reports",
    });
  }

  // Pending cases the queue withheld because they cannot be opened. Saying so
  // is the alternative to dropping them silently — see lib/doctor/reviewQueue.
  if (counts.unopenable && counts.unopenable > 0) {
    const n = counts.unopenable;
    items.push({
      key: "unopenable",
      icon: "incomplete",
      tone: "warning",
      title: `${n} ${n === 1 ? "record is" : "records are"} held back from the queue`,
      // States the fact, not a remedy we cannot promise: the questionnaire is
      // not recoverable from here, and the record itself is preserved.
      detail: "No stored assessment responses — the review cannot be opened",
      href: "/doctor/reports?tab=all",
    });
  }

  const longWaits = queue.filter(
    (r) => r.submittedAt && now - new Date(r.submittedAt).getTime() > LONG_WAIT_MS,
  ).length;
  if (longWaits > 0) {
    items.push({
      key: "long-wait",
      icon: "waiting",
      tone: "warning",
      title: `${longWaits} ${longWaits === 1 ? "patient" : "patients"} waiting over 15 min`,
      // "In your deck", never a clinic-wide claim: the deck holds the oldest
      // few rows, so this is a floor on the real number, not the number.
      detail: "In your deck, longer than the usual wait",
      href: "/doctor/reports?tab=needs_review",
    });
  }

  return items;
}
