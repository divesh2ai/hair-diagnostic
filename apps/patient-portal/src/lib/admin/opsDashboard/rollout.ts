// Rollout checklist — pure derivation, no Prisma, no I/O.
//
// A clinic's pilot readiness is part live-data fact and part human attestation.
// This module merges the two into one honest checklist the Super Admin can read
// and sign off, with the semantic rules the task is explicit about:
//
//   • "A verified Google identity link is not proof of a successful dashboard
//      login." DOCTOR_LOGIN is auto-satisfied ONLY by a recorded sign-in, never
//      by the existence of a linked identity. When sign-in telemetry cannot be
//      read the state is UNKNOWN, never a confident pass or fail.
//   • "A QR route existing is not proof of a successful QR scan." BRANCH_QR is
//      REQUIRES_MANUAL — live data can show how many branches have a QR handle
//      configured, but a working scan must be witnessed and documented. It is
//      never auto-satisfied.
//   • Final PILOT_ACCEPTANCE is a human judgement — always REQUIRES_MANUAL.
//   • A report milestone is the CONFIRMED asset (a READY dossier), not an
//      approval; delivery is a PROVIDER-CONFIRMED delivery, not a send.
//
// A manual sign-off is authoritative over the auto-derivation: if an operator
// attests VERIFIED (or FAILED / BLOCKED / NOT_APPLICABLE) with evidence, that is
// what the checklist shows. Where no sign-off exists the auto state stands, so a
// clinic that is demonstrably working reads as "auto-satisfied — confirm" rather
// than an empty box.

import type { CapabilityState } from "./types";

/** The eight rollout milestones, in checklist order. Mirrors the Prisma enum. */
export const MILESTONE_KEYS = [
  "DOCTOR_LOGIN",
  "BRANCH_QR",
  "FIRST_ASSESSMENT",
  "FIRST_CONSULTATION",
  "FIRST_REPORT",
  "KIT_REVIEW",
  "WHATSAPP_DELIVERY",
  "PILOT_ACCEPTANCE",
] as const;

export type MilestoneKey = (typeof MILESTONE_KEYS)[number];

/** The attestation outcomes a human can record. Mirrors the Prisma enum. */
export const MILESTONE_OUTCOMES = [
  "VERIFIED",
  "FAILED",
  "BLOCKED",
  "NOT_APPLICABLE",
] as const;

export type MilestoneOutcome = (typeof MILESTONE_OUTCOMES)[number];

export function isMilestoneKey(v: unknown): v is MilestoneKey {
  return typeof v === "string" && (MILESTONE_KEYS as readonly string[]).includes(v);
}

export function isMilestoneOutcome(v: unknown): v is MilestoneOutcome {
  return typeof v === "string" && (MILESTONE_OUTCOMES as readonly string[]).includes(v);
}

/**
 * What the live data says about a milestone, before any human attestation.
 *   SATISFIED       the database proves it happened.
 *   NOT_SATISFIED   the database proves it has not happened yet.
 *   REQUIRES_MANUAL the database cannot prove it even in principle — a human
 *                   must witness and document it (QR scan, pilot acceptance).
 *   UNKNOWN         the evidence could not be read (a capability is not
 *                   connected, or auth.users was unreadable).
 */
export type AutoEvidenceState =
  | "SATISFIED"
  | "NOT_SATISFIED"
  | "REQUIRES_MANUAL"
  | "UNKNOWN";

/** The overall per-milestone status the checklist renders. */
export type MilestoneStatus =
  // A human attested it working, with evidence.
  | "VERIFIED"
  // Live data satisfies it; no human has confirmed it yet.
  | "AUTO_SATISFIED"
  // A human recorded a FAILED / BLOCKED outcome — needs remediation.
  | "ATTENTION"
  // Nothing yet: auto says not-satisfied, or a manual witness is still owed.
  | "NOT_STARTED"
  // A human marked it not applicable to this clinic.
  | "NOT_APPLICABLE"
  // Cannot be determined from the evidence available here, and unsigned.
  | "UNKNOWN";

/** A stored manual sign-off, as the UI/API carry it (dates are ISO strings). */
export interface MilestoneSignoff {
  outcome: MilestoneOutcome;
  evidence: string | null;
  notes: string | null;
  actorName: string | null;
  actorRole: string | null;
  signedOffAt: string;
}

export interface RolloutChecklistItem {
  key: MilestoneKey;
  label: string;
  /** One line explaining what the milestone attests and why it is not inferable. */
  description: string;
  /** Whether a milestone can ever be auto-proved, for UI affordances. */
  manualOnly: boolean;
  autoState: AutoEvidenceState;
  /** Human-readable summary of the live evidence behind autoState. */
  autoEvidence: string;
  signoff: MilestoneSignoff | null;
  status: MilestoneStatus;
}

export interface RolloutChecklist {
  /** CONNECTED when the sign-off table is provisioned here; else NOT_CONNECTED. */
  signoffState: CapabilityState;
  items: RolloutChecklistItem[];
  /** Count of items a human has VERIFIED — the honest "done" tally. */
  verifiedCount: number;
  /** Items needing attention (a FAILED/BLOCKED sign-off). */
  attentionCount: number;
  total: number;
}

/** Live signals the checklist derives auto-evidence from. All measured facts. */
export interface RolloutSignals {
  authReadable: boolean;
  /** At least one doctor has a recorded sign-in (verified login evidence). */
  anyDoctorSignedIn: boolean;
  doctorCount: number;
  /** Branches whose QR/link handle (slug) is configured — a route, not a scan. */
  branchesWithQrHandle: number;
  branchCount: number;
  assessmentsTotal: number;
  /** Any consultation row created (the doctor-review artefact exists). */
  consultationsTotal: number;
  /** Confirmed READY patient-report dossier assets. */
  dossiersReady: number;
  /** Kit decisions made (active or cancelled intents) — a review happened. */
  kitDecisions: number;
  /** Whether WhatsApp delivery records are provisioned in this environment. */
  deliveryState: CapabilityState;
  /** Provider-confirmed report deliveries; null when delivery is NOT_CONNECTED. */
  reportsDelivered: number | null;
}

const LABELS: Record<MilestoneKey, { label: string; description: string; manualOnly: boolean }> = {
  DOCTOR_LOGIN: {
    label: "Doctor login accepted",
    description:
      "A doctor actually signed in to the dashboard. A linked Google identity is not proof of a successful login.",
    manualOnly: false,
  },
  BRANCH_QR: {
    label: "Branch QR scanned & documented",
    description:
      "Each branch's QR/link was scanned end-to-end and the result recorded. A QR route existing is not proof of a scan.",
    manualOnly: true,
  },
  FIRST_ASSESSMENT: {
    label: "First assessment captured",
    description: "The clinic captured its first patient assessment.",
    manualOnly: false,
  },
  FIRST_CONSULTATION: {
    label: "First consultation created",
    description: "A consultation was created for a completed assessment (the doctor-review artefact exists).",
    manualOnly: false,
  },
  FIRST_REPORT: {
    label: "First report produced",
    description: "A patient-report dossier asset reached READY — a confirmed asset, not an approval.",
    manualOnly: false,
  },
  KIT_REVIEW: {
    label: "Kit reviewed",
    description: "A doctor reviewed and authorised (or cancelled) a kit for a patient.",
    manualOnly: false,
  },
  WHATSAPP_DELIVERY: {
    label: "WhatsApp report delivered",
    description: "A report delivery was confirmed by the provider — a send is not a delivery.",
    manualOnly: false,
  },
  PILOT_ACCEPTANCE: {
    label: "Pilot accepted",
    description: "Final human sign-off that the clinic's pilot is accepted and operational.",
    manualOnly: true,
  },
};

/** Derive one milestone's auto-evidence state + a human summary of it. */
function autoEvidenceFor(
  key: MilestoneKey,
  s: RolloutSignals,
): { state: AutoEvidenceState; summary: string } {
  switch (key) {
    case "DOCTOR_LOGIN":
      if (!s.authReadable) return { state: "UNKNOWN", summary: "Sign-in telemetry unreadable here." };
      if (s.doctorCount === 0) return { state: "NOT_SATISFIED", summary: "No doctors provisioned yet." };
      return s.anyDoctorSignedIn
        ? { state: "SATISFIED", summary: "At least one doctor has a recorded sign-in." }
        : { state: "NOT_SATISFIED", summary: "No doctor has signed in yet." };
    case "BRANCH_QR":
      return {
        state: "REQUIRES_MANUAL",
        summary:
          s.branchCount === 0
            ? "No branches configured."
            : `${s.branchesWithQrHandle}/${s.branchCount} branch${s.branchCount === 1 ? "" : "es"} have a QR handle; a scan test must be documented.`,
      };
    case "FIRST_ASSESSMENT":
      return s.assessmentsTotal > 0
        ? { state: "SATISFIED", summary: `${s.assessmentsTotal} assessment(s) captured.` }
        : { state: "NOT_SATISFIED", summary: "No assessments yet." };
    case "FIRST_CONSULTATION":
      return s.consultationsTotal > 0
        ? { state: "SATISFIED", summary: `${s.consultationsTotal} consultation(s) created.` }
        : { state: "NOT_SATISFIED", summary: "No consultations created yet." };
    case "FIRST_REPORT":
      return s.dossiersReady > 0
        ? { state: "SATISFIED", summary: `${s.dossiersReady} dossier asset(s) READY.` }
        : { state: "NOT_SATISFIED", summary: "No report dossier is ready yet." };
    case "KIT_REVIEW":
      return s.kitDecisions > 0
        ? { state: "SATISFIED", summary: `${s.kitDecisions} kit decision(s) recorded.` }
        : { state: "NOT_SATISFIED", summary: "No kit reviewed yet." };
    case "WHATSAPP_DELIVERY":
      if (s.deliveryState !== "CONNECTED")
        return { state: "UNKNOWN", summary: "Delivery records not provisioned here." };
      return (s.reportsDelivered ?? 0) > 0
        ? { state: "SATISFIED", summary: `${s.reportsDelivered} provider-confirmed delivery(ies).` }
        : { state: "NOT_SATISFIED", summary: "No provider-confirmed delivery yet." };
    case "PILOT_ACCEPTANCE":
      return { state: "REQUIRES_MANUAL", summary: "Awaiting a human acceptance decision." };
  }
}

/** Merge a manual sign-off (authoritative) with the auto-evidence state. */
function resolveStatus(
  auto: AutoEvidenceState,
  signoff: MilestoneSignoff | null,
): MilestoneStatus {
  if (signoff) {
    switch (signoff.outcome) {
      case "VERIFIED":
        return "VERIFIED";
      case "FAILED":
      case "BLOCKED":
        return "ATTENTION";
      case "NOT_APPLICABLE":
        return "NOT_APPLICABLE";
    }
  }
  switch (auto) {
    case "SATISFIED":
      return "AUTO_SATISFIED";
    case "UNKNOWN":
      return "UNKNOWN";
    case "NOT_SATISFIED":
    case "REQUIRES_MANUAL":
      return "NOT_STARTED";
  }
}

/**
 * Build the full rollout checklist. Pure: the caller supplies the measured
 * signals and the stored sign-offs (keyed by milestone), and gets back one
 * item per milestone with its honest status.
 */
export function deriveRolloutChecklist(
  signals: RolloutSignals,
  signoffs: Map<MilestoneKey, MilestoneSignoff>,
  signoffState: CapabilityState,
): RolloutChecklist {
  const items: RolloutChecklistItem[] = MILESTONE_KEYS.map((key) => {
    const meta = LABELS[key];
    const { state: autoState, summary } = autoEvidenceFor(key, signals);
    // When the sign-off store is unreadable we cannot show a sign-off even if
    // one exists, so ignore the (empty) map and never imply "not signed".
    const signoff = signoffState === "CONNECTED" ? signoffs.get(key) ?? null : null;
    return {
      key,
      label: meta.label,
      description: meta.description,
      manualOnly: meta.manualOnly,
      autoState,
      autoEvidence: summary,
      signoff,
      status: resolveStatus(autoState, signoff),
    };
  });

  return {
    signoffState,
    items,
    verifiedCount: items.filter((i) => i.status === "VERIFIED").length,
    attentionCount: items.filter((i) => i.status === "ATTENTION").length,
    total: items.length,
  };
}

/** UI labels for a milestone status. */
export const MILESTONE_STATUS_LABEL: Record<MilestoneStatus, string> = {
  VERIFIED: "Verified",
  AUTO_SATISFIED: "Auto-satisfied — confirm",
  ATTENTION: "Needs attention",
  NOT_STARTED: "Not started",
  NOT_APPLICABLE: "Not applicable",
  UNKNOWN: "Unknown",
};

/** UI labels for an attestation outcome. */
export const MILESTONE_OUTCOME_LABEL: Record<MilestoneOutcome, string> = {
  VERIFIED: "Verified working",
  FAILED: "Failed",
  BLOCKED: "Blocked",
  NOT_APPLICABLE: "Not applicable",
};
