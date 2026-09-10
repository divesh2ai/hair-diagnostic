import type { PrismaClient } from "@prisma/client";

/**
 * THE order for an assessment — resolved by identity, never by recency.
 *
 * ── The defect this replaces ────────────────────────────────────────────────
 * Two surfaces answered "which order is this?" with two different queries:
 *
 *   cart API   findFirst({ assessmentId, status: READY_FOR_FULFILMENT },
 *                        orderBy: { createdAt: "desc" })
 *   meta.ts    findFirst({ assessmentId }, orderBy: { createdAt: "desc" })
 *
 * Neither is "the order the doctor approved". They are "the newest row that
 * happens to match", and they do not even match each other — meta accepts a
 * CANCELLED intent, the cart skips it. An assessment CAN hold more than one
 * intent: the unique key is (consultationId, consultationVersionId), so a
 * revise-and-reapprove cycle legitimately produces a second row. Once it does,
 * the two queries can name different orders, and the concrete failure is a
 * doctor previewing order A on a page whose status line reads order B — or the
 * page offering a cart link that lands on "no confirmed plan yet".
 *
 * ── What makes this exact ───────────────────────────────────────────────────
 * The review page renders `Consultation.currentVersion` — that is literally
 * what the orchestrator's `getLatestByAssessment` returns, and `meta.approvalStatus`
 * is that version's approval status. So the order the doctor is looking at is
 * the intent stamped with THAT version id, and `@@unique([consultationId,
 * consultationVersionId])` guarantees there is at most one of them.
 *
 * So this resolves by version identity and applies two gates:
 *   1. the current version must be APPROVED, and
 *   2. its intent must be READY_FOR_FULFILMENT.
 *
 * Anything else returns null, which the callers render as "no order" rather
 * than as a link to somebody else's snapshot. No schema change is involved —
 * every column used here already exists.
 *
 * Both the doctor's preview and the patient's cart call this. Divergence
 * between them is not guarded against; it is structurally impossible.
 */
export interface ApprovedOrder {
  intentId: string;
  status: string;
  kitIds: string[];
  /**
   * Persisted per-kit supply, when it exists.
   *
   * The column is real, but `approveAndCreateOrder` writes `Prisma.JsonNull`
   * ("no quantities defined in the pilot") on every intent, so in practice
   * this is always null today. Surfaced rather than swallowed so the callers
   * can prefer a persisted quantity the moment one is ever written, without
   * another pass through this file.
   */
  quantities: Record<string, number> | null;
  consultationId: string;
  consultationVersionId: string;
  contentVersion: number;
}

/** Prisma's enum values, referenced as literals to avoid importing the client enums. */
const APPROVED = "APPROVED";
const READY_FOR_FULFILMENT = "READY_FOR_FULFILMENT";

export async function resolveApprovedOrder(
  prisma: PrismaClient,
  assessmentId: string,
): Promise<ApprovedOrder | null> {
  // `Consultation` is @@unique([assessmentId]) — one consultation per
  // assessment, so this is a lookup and not a choice.
  const consultation = await prisma.consultation.findUnique({
    where: { assessmentId },
    select: {
      id: true,
      currentVersionId: true,
      currentVersion: {
        select: { id: true, contentVersion: true, approvalStatus: true },
      },
    },
  });

  const version = consultation?.currentVersion;
  if (!consultation || !version) return null;

  // An unapproved current version means there is no approved order to show,
  // even if an OLDER version once produced one. Showing that older order here
  // would present a superseded lineup as the current plan.
  if (String(version.approvalStatus) !== APPROVED) return null;

  const intent = await prisma.kitOrderIntent.findUnique({
    where: {
      consultationId_consultationVersionId: {
        consultationId: consultation.id,
        consultationVersionId: version.id,
      },
    },
    select: { id: true, status: true, kitIds: true, quantities: true },
  });

  if (!intent) return null;
  if (String(intent.status) !== READY_FOR_FULFILMENT) return null;

  return {
    intentId: intent.id,
    status: String(intent.status),
    kitIds: intent.kitIds,
    quantities: normaliseQuantities(intent.quantities),
    consultationId: consultation.id,
    consultationVersionId: version.id,
    contentVersion: version.contentVersion,
  };
}

/**
 * `{ kitId: number }` or nothing.
 *
 * Defensive because the column is `Json?` and therefore unvalidated by the
 * database: a malformed blob must degrade to "no quantities recorded", never
 * to a NaN that reaches a price calculation.
 */
function normaliseQuantities(raw: unknown): Record<string, number> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: Record<string, number> = {};
  for (const [kitId, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      out[kitId] = Math.floor(value);
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}
