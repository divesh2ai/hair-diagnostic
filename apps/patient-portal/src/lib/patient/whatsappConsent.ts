import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Patient WhatsApp consent — read and write, over raw SQL.
//
// ── Why raw SQL, and why this cannot live on the typed Patient read ─────────
// The `whatsappConsent` / `whatsappConsentAt` / `whatsappConsentSource`
// columns exist in schema.prisma and in
// prisma/migrations/20260908_whatsapp_report_delivery, but that migration may
// not be applied yet in every environment — same situation as
// lib/delivery/deliveryStore.ts. Reading these columns through the typed
// Prisma client (`prisma.patient.findUnique(...)`, or any `include: {
// patient: true }` on a query that touches Patient) selects EVERY scalar
// column of the model, so an unapplied migration would throw "column does not
// exist" on ordinary reads that have nothing to do with WhatsApp — including
// every consultation load, which goes through exactly such an include (see
// consultation-orchestrator/infra/loaders.ts). Raw SQL, naming only the three
// columns this module owns, keeps that blast radius to "consent reads unknown
// consent" instead of "the clinical review page 500s".
//
// ── Fail-closed semantics ────────────────────────────────────────────────────
// Both "column missing" and "consent column says false" resolve to `consent:
// false` for any caller deciding whether to send. `provisioned` is kept
// alongside so a caller that needs to explain WHY (e.g. the doctor UI) can
// still tell "not provisioned" apart from "the patient said no" — but no
// caller may treat `provisioned: false` as anything other than "do not send".

export interface PatientWhatsappConsent {
  consent: boolean;
  consentAt: string | null;
  consentSource: string | null;
  /** False only when the migration has not been applied here. */
  provisioned: boolean;
}

const UNPROVISIONED: PatientWhatsappConsent = {
  consent: false,
  consentAt: null,
  consentSource: null,
  provisioned: false,
};

/** Same detection deliveryStore.ts uses for a raw query against a missing column. */
function isMissingColumn(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2010") {
    const meta = (err.meta ?? {}) as { code?: string; message?: string };
    if (meta.code === "42703" || meta.code === "42P01") return true;
    return /does not exist/i.test(meta.message ?? err.message);
  }
  return false;
}

interface ConsentRow {
  whatsappConsent: boolean;
  whatsappConsentAt: Date | null;
  whatsappConsentSource: string | null;
}

export async function getPatientWhatsappConsent(
  patientId: string,
): Promise<PatientWhatsappConsent> {
  try {
    const rows = await prisma.$queryRaw<ConsentRow[]>(Prisma.sql`
      SELECT "whatsappConsent", "whatsappConsentAt", "whatsappConsentSource"
        FROM "Patient"
       WHERE "id" = ${patientId}
       LIMIT 1
    `);
    const row = rows[0];
    if (!row) return { consent: false, consentAt: null, consentSource: null, provisioned: true };
    return {
      consent: row.whatsappConsent === true,
      consentAt: row.whatsappConsentAt?.toISOString() ?? null,
      consentSource: row.whatsappConsentSource,
      provisioned: true,
    };
  } catch (err) {
    if (isMissingColumn(err)) return UNPROVISIONED;
    throw err;
  }
}

/**
 * Record consent (or its withdrawal). Swallows the unprovisioned case rather
 * than throwing — a deployment that has not applied the migration cannot
 * persist consent, and a doctor toggling a checkbox must not see a 500 for
 * that; the checkbox itself should not be offered when `provisioned: false`.
 *
 * `whatsappConsentAt` is stamped ONLY on a grant (`consent: true`) and
 * cleared to null on a revocation. A revocation is not a "consent event" at
 * a point in time in the same sense a grant is — it is the absence of one —
 * so leaving a timestamp behind would misrepresent a withdrawn consent as a
 * still-dated fact, indistinguishable from a stale grant nobody re-confirmed.
 */
export async function setPatientWhatsappConsent(
  patientId: string,
  consent: boolean,
  source: string,
): Promise<PatientWhatsappConsent> {
  try {
    const rows = await prisma.$queryRaw<ConsentRow[]>(Prisma.sql`
      UPDATE "Patient"
         SET "whatsappConsent"       = ${consent},
             "whatsappConsentAt"     = CASE WHEN ${consent} THEN NOW() ELSE NULL END,
             "whatsappConsentSource" = ${source},
             "updatedAt"             = NOW()
       WHERE "id" = ${patientId}
      RETURNING "whatsappConsent", "whatsappConsentAt", "whatsappConsentSource"
    `);
    const row = rows[0];
    if (!row) return UNPROVISIONED;
    return {
      consent: row.whatsappConsent === true,
      consentAt: row.whatsappConsentAt?.toISOString() ?? null,
      consentSource: row.whatsappConsentSource,
      provisioned: true,
    };
  } catch (err) {
    if (isMissingColumn(err)) return UNPROVISIONED;
    throw err;
  }
}
