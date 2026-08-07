import { ArtifactType, ConsultationApprovalStatus, PrismaClient } from "@prisma/client";
import type { ApprovedClinicalContext, ClinicalAuthorityPort } from "./clinicalAuthority";
import type { SourceRef } from "./types";

type JsonRecord = Record<string, unknown>;
const record = (value: unknown): JsonRecord => value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};

export class PrismaClinicalAuthority implements ClinicalAuthorityPort {
  constructor(private readonly prisma: PrismaClient) {}
  async getApprovedContext(input: { clinicId: string; patientId?: string; assessmentId?: string }): Promise<ApprovedClinicalContext | null> {
    const consultation = await this.prisma.consultation.findFirst({
      where: { clinicId: input.clinicId, ...(input.patientId ? { patientId: input.patientId } : {}), ...(input.assessmentId ? { assessmentId: input.assessmentId } : {}), currentVersion: { is: { approvalStatus: ConsultationApprovalStatus.APPROVED } } },
      orderBy: { updatedAt: "desc" },
      include: { currentVersion: true, assessment: { include: { artifacts: { where: { type: ArtifactType.RECOMMENDATIONS }, take: 1 } } } },
    });
    const version = consultation?.currentVersion;
    if (!consultation || !version) return null;
    const plan = record(record(version.content).treatmentPlan);
    const phases = Array.isArray(plan.kitPhases) ? plan.kitPhases.map(record) : [];
    const kitSequence = phases.map((phase) => String(phase.displayName ?? phase.kitId ?? "")).filter(Boolean);
    const recommendation = record(consultation.assessment.artifacts[0]?.content);
    const rawTrace = Array.isArray(recommendation.ruleTrace) ? recommendation.ruleTrace.map(record) : [];
    const ruleTrace = rawTrace.map((trace) => ({ ruleId: typeof trace.ruleId === "string" ? trace.ruleId : undefined, kitId: typeof trace.kitId === "string" ? trace.kitId : undefined, action: typeof trace.action === "string" ? trace.action : undefined, reason: String(trace.reason ?? trace.explanation ?? trace.message ?? "Stored deterministic clinical rule applied.") }));
    if (!ruleTrace.length) for (const phase of phases) ruleTrace.push({ ruleId: undefined, kitId: String(phase.kitId ?? ""), action: "SELECTED", reason: String(phase.whySelected ?? "Selected in the doctor-approved plan.") });
    const sources: SourceRef[] = [{ sourceType: "CLINICAL_RECORD", sourceId: version.id, label: `Doctor-approved consultation v${version.contentVersion}`, field: "treatmentPlan.kitPhases", version: version.contentVersion, approvalStatus: "APPROVED" }];
    if (consultation.assessment.artifacts[0]) sources.push({ sourceType: "CLINICAL_RECORD", sourceId: consultation.assessment.artifacts[0].id, label: "Persisted deterministic recommendation trace", field: "ruleTrace", approvalStatus: "ENGINE_OUTPUT" });
    return { approvalStatus: "APPROVED", planVersionId: version.id, kitSequence, ruleTrace, doctorNote: version.approvalNotes, sources };
  }
}
