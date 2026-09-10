import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";

// Patient-side engagement events: "the patient actually opened the thing we
// sent them".
//
// ── Why AssessmentEvent and not a new analytics table ───────────────────────
// `AssessmentEvent` already is the per-assessment timeline — a free-form
// `type`, an optional `stage`, `message` and `metadata`, indexed by
// (assessmentId, createdAt). That is exactly the shape of "report opened at
// 14:02", and it is what the doctor's journey view reads. A dedicated
// PatientEngagement table would be a second timeline for the same record, and
// the two would disagree the first time one of them failed to write.
//
// ── Delivery ≠ open ─────────────────────────────────────────────────────────
// These are deliberately NOT written by the delivery layer. "WhatsApp accepted
// the message" and "a human opened the link" are different facts about
// different actors, and collapsing them is how a dashboard ends up claiming a
// patient read a report they never received. Delivery state lives on
// WhatsappDelivery; this file records only what happened on our own server
// when someone presented a valid token.

export type PatientSubject = "REPORT" | "CART";

const EVENT_TYPE: Record<PatientSubject, string> = {
  REPORT: "PATIENT_REPORT_OPENED",
  CART: "PATIENT_CART_OPENED",
};

const AUDIT_ACTION = {
  REPORT: "PATIENT_REPORT_OPENED",
  CART: "PATIENT_CART_OPENED",
} as const;

/**
 * How long two opens are treated as the same visit.
 *
 * Without a window this records one row per page load, and a patient who
 * refreshes, rotates their phone, or comes back from a background tab
 * manufactures "opened 9 times" out of one reading. Thirty minutes is the
 * span of a single sitting with a report; a genuine return the next day is a
 * separate, and interesting, event.
 *
 * This is a de-duplication window, not a rate limit — it protects the meaning
 * of the data, not the server.
 */
const OPEN_DEDUPE_WINDOW_MS = 30 * 60 * 1000;

/**
 * A stable, non-reversible short handle for the token that was presented.
 *
 * Support needs to be able to ask "was this the link we sent on Tuesday, or an
 * older one?", and that question needs SOMETHING on the row. It must not be
 * the token: a share token in an event row is a live credential sitting in a
 * table that is read by dashboards, exported, and eventually copied into a
 * support ticket.
 *
 * A truncated SHA-256 answers the question and nothing else. It cannot be
 * turned back into a working link, and 12 hex characters is far too little to
 * brute-force a 256-bit HMAC from.
 */
export function tokenFingerprint(token: string): string {
  return createHash("sha256").update(token).digest("hex").slice(0, 12);
}

export interface RecordPatientOpenInput {
  assessmentId: string;
  subject: PatientSubject;
  /** The raw token presented. Fingerprinted here; never stored or logged. */
  token?: string | null;
}

export interface RecordPatientOpenResult {
  /** False when an open was already recorded inside the dedupe window. */
  recorded: boolean;
}

/**
 * Record that the patient opened their report or cart. **Never throws.**
 *
 * Engagement telemetry must not be able to break the page it is measuring. A
 * patient who opens their clinical report and gets a 500 because an event row
 * could not be written has been failed by the analytics, which is the least
 * important thing on the screen. Every failure path here degrades to "not
 * recorded" and leaves the caller to render the report.
 */
export async function recordPatientOpen(
  input: RecordPatientOpenInput,
): Promise<RecordPatientOpenResult> {
  const type = EVENT_TYPE[input.subject];

  try {
    const since = new Date(Date.now() - OPEN_DEDUPE_WINDOW_MS);
    const recent = await prisma.assessmentEvent.findFirst({
      where: { assessmentId: input.assessmentId, type, createdAt: { gte: since } },
      select: { id: true },
    });
    if (recent) return { recorded: false };

    // Resolve the clinic for the audit row's metadata. Read separately rather
    // than passed in by the caller: the caller is a patient-token path that
    // has no clinic context of its own, and inventing one from the request
    // would be a guess about tenancy.
    const assessment = await prisma.assessment.findUnique({
      where: { id: input.assessmentId },
      select: { clinicId: true },
    });

    const fingerprint = input.token ? tokenFingerprint(input.token) : null;

    await prisma.assessmentEvent.create({
      data: {
        assessmentId: input.assessmentId,
        type,
        stage: "PATIENT_ENGAGEMENT",
        // No patient name, no phone, no link, no clinical content. The event
        // IS the whole fact.
        message: input.subject === "REPORT" ? "Patient opened report" : "Patient opened cart",
        metadata: {
          subject: input.subject,
          ...(fingerprint ? { tokenFingerprint: fingerprint } : {}),
        },
      },
    });

    await writeAuditLog({
      action: AUDIT_ACTION[input.subject],
      entityType: "Assessment",
      entityId: input.assessmentId,
      assessmentId: input.assessmentId,
      clinicId: assessment?.clinicId ?? null,
      // The patient is the actor, and they have no account — so there is no
      // actorId to record. Naming the doctor here would attribute the patient's
      // action to a clinician who was not present.
      actorType: "patient",
      metadata: {
        subject: input.subject,
        ...(fingerprint ? { tokenFingerprint: fingerprint } : {}),
      },
    });

    return { recorded: true };
  } catch {
    // Deliberately silent to the caller. Logged without identifiers so a
    // failing writer is visible in operations without putting an assessment id
    // — which is one half of a patient's identity here — into every log line.
    console.warn(`[journey] failed to record ${type}`);
    return { recorded: false };
  }
}

export interface PatientOpenSummary {
  firstOpenedAt: string | null;
  lastOpenedAt: string | null;
  openCount: number;
}

/**
 * Read the open history for one assessment and subject.
 *
 * Returns zeroes rather than throwing when the timeline cannot be read: an
 * unknown engagement history and "never opened" look the same to this
 * function's callers by design — both render as "not yet opened", which is the
 * conservative claim. The doctor's journey view must never assert that a
 * patient HAS read something on the strength of a failed query.
 */
export async function readPatientOpens(
  assessmentId: string,
  subject: PatientSubject,
): Promise<PatientOpenSummary> {
  try {
    const rows = await prisma.assessmentEvent.findMany({
      where: { assessmentId, type: EVENT_TYPE[subject] },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    });
    if (rows.length === 0) {
      return { firstOpenedAt: null, lastOpenedAt: null, openCount: 0 };
    }
    return {
      firstOpenedAt: rows[0].createdAt.toISOString(),
      lastOpenedAt: rows[rows.length - 1].createdAt.toISOString(),
      openCount: rows.length,
    };
  } catch {
    return { firstOpenedAt: null, lastOpenedAt: null, openCount: 0 };
  }
}
