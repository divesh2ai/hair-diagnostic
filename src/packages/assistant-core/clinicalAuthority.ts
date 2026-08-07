import type { SourceRef } from "./types";

export type ApprovedClinicalContext = {
  approvalStatus: "APPROVED";
  planVersionId: string;
  kitSequence: string[];
  ruleTrace: Array<{ ruleId?: string; kitId?: string; action?: string; reason: string }>;
  doctorNote?: string | null;
  sources: SourceRef[];
};

export type ClinicalAuthorityPort = {
  getApprovedContext(input: { clinicId: string; patientId?: string; assessmentId?: string }): Promise<ApprovedClinicalContext | null>;
};

/**
 * Deliberately read-only: the assistant consumes persisted, approved output and
 * never imports or invokes the kit scorer. This is the boundary that keeps the
 * deterministic clinical engine authoritative for selection and sequence.
 */
export class NoClinicalContext implements ClinicalAuthorityPort {
  async getApprovedContext(): Promise<null> { return null; }
}
