// Clinic readiness tiers for the Super Admin command centre.
//
// Three DISTINCT facts, never collapsed into one "is it working?" boolean —
// conflating them is exactly what let an ACTIVE database row read as proof the
// clinic actually works end to end:
//
//   1. DATABASE ACTIVE       — Clinic.status === ACTIVE (and not soft-deleted).
//                              A stored fact about the record, nothing more.
//   2. ACCESS READY          — the clinic has an active, authorised doctor whose
//                              authentication identity is linked (provisioned).
//                              This is "the doctor CAN sign in", NOT proof of a
//                              successful live OTP/OAuth login.
//   3. OPERATIONALLY VERIFIED — a trustworthy, clinic-specific golden-path test
//                              record exists (patient submission → correct doctor
//                              visibility → review/approval → report/PDF →
//                              WhatsApp when enabled → clinic isolation).
//
// There is deliberately NO inference of tier 3 from completed Assessment,
// ReportAsset or WhatsappDelivery rows: those prove activity happened, not that
// an end-to-end verification was performed and passed. The current schema holds
// no such verification record, so `verificationRecord` is always absent today
// and the tier reads VERIFICATION PENDING until a dedicated, separately-approved
// evidence source exists. Missing evidence is PENDING, never VERIFIED.

export type OperationalStatus = "VERIFIED" | "PENDING";

export type ClinicReadiness = {
  /** Clinic.status === ACTIVE and not soft-deleted. */
  databaseActive: boolean;
  /** >= 1 active authorised doctor with a linked auth identity (provisioned). */
  accessReady: boolean;
  /** VERIFIED only with a trustworthy golden-path record; otherwise PENDING. */
  operational: OperationalStatus;
};

export function classifyClinicReadiness(input: {
  status: string;
  deleted?: boolean;
  /** Clinic has an active doctor whose supabaseUserId/supabasePhoneUserId is set. */
  hasAccessReadyDoctor: boolean;
  /**
   * Presence of a trustworthy end-to-end verification record. Never derived
   * from assessment/report/delivery activity. Absent (false/undefined) today,
   * so the operational tier is PENDING.
   */
  verificationRecord?: boolean;
}): ClinicReadiness {
  return {
    databaseActive: input.status === "ACTIVE" && !input.deleted,
    accessReady: input.hasAccessReadyDoctor === true,
    operational: input.verificationRecord ? "VERIFIED" : "PENDING",
  };
}

/** Human label for the operational tier. */
export function operationalLabel(op: OperationalStatus): string {
  return op === "VERIFIED" ? "Operationally verified" : "Verification pending";
}
