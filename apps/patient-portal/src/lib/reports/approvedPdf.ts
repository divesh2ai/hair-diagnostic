import type { Consultation } from '@shared/types/consultation';
import { Prisma } from '@prisma/client';
import type { ReportInputPayload } from '@hairos/packages/pdf-engine/types';
import { approvedReportKey, approvedReportPath } from '@hairos/packages/pdf-engine/version';
import { prisma } from '@/lib/prisma';

type Version = { id: string; contentVersion: number; content: unknown; approvedAt: Date | null };
type Subject = { id: string; clinicId: string; patientId: string };

/** Render only the persisted version, including doctor edits to the plan. */
export function approvedPdfPayload(subject: Subject, version: Version, clinicName: string, doctorName: string): ReportInputPayload {
  const c = version.content as Consultation;
  if (!c?.clinicalReport || c.patient?.id !== subject.patientId || c.assessment?.id !== subject.id ||
      c.version?.contentVersion !== version.contentVersion || !c.treatmentPlan) {
    throw new Error('Approved consultation snapshot is incomplete or inconsistent');
  }
  return {
    assessmentId: subject.id,
    approvedVersion: { assessmentId: subject.id, clinicId: subject.clinicId, patientId: subject.patientId,
      consultationVersionId: version.id, contentVersion: version.contentVersion },
    patient: { name: c.patient.name, age: c.patient.age, gender: c.patient.sex },
    clinic: { name: clinicName }, doctor: { name: doctorName },
    clinicalProfile: {} as ReportInputPayload['clinicalProfile'], visualJourney: null,
    clinicalReport: { ...c.clinicalReport,
      patientSummary: { ...c.clinicalReport.patientSummary, name: c.patient.name, age: c.patient.age, gender: c.patient.sex,
        ...(c.clinicalFindings ? { clinicalInterpretation: c.clinicalFindings } : {}) },
      ...(c.rootCause ? { rootCauseAnalysis: c.rootCause } : {}),
      ...(c.rootCauseRationale ? { whyHairosChoseThisPlan: c.rootCauseRationale } : {}),
      treatmentStrategy: c.treatmentPlan.kitPhases,
      topicalRecommendations: c.treatmentPlan.topicals, topicalCautions: c.treatmentPlan.topicalCautions,
      recoveryMilestones: c.treatmentPlan.expectedTimeline,
      ...(c.patientEducation ? { clinicalInsightStory: c.patientEducation.story,
        finalClinicalAssessment: c.patientEducation.finalAssessment,
        generalLifestyleGuide: c.patientEducation.generalLifestyle, dietAndLifestyle: c.patientEducation.conditionLifestyle } : {}) },
    createdAt: version.approvedAt ?? new Date(c.audit.createdAt),
  };
}

export async function findApprovedPdf(subject: Subject, version: Version) {
  const asset = await prisma.reportAsset.findUnique({ where: { render_key: approvedReportKey(version.id) } });
  if (!asset || asset.status !== 'READY') return null;
  if (asset.assessmentId !== subject.id || asset.clinicId !== subject.clinicId || asset.patientId !== subject.patientId ||
      asset.contentVersion !== version.contentVersion || asset.storageBucket !== 'clinical-reports' ||
      asset.storagePath !== approvedReportPath({ ...subject, assessmentId: subject.id, consultationVersionId: version.id, contentVersion: version.contentVersion })) {
    throw new Error('Approved PDF identity mismatch');
  }
  return asset;
}

/** Durable version history uses ReportAsset, never the unique REPORT pointer.
 * Upload happens first; a DB failure is an error and retry reuses the object.
 * Only READY rows are inserted, so the PNG queue never claims these PDFs.
 */
export async function recordApprovedPdf(subject: Subject, consultationId: string, version: Version, patientPdfUrl: string) {
  const expectedPath = approvedReportPath({ ...subject, assessmentId: subject.id, consultationVersionId: version.id, contentVersion: version.contentVersion });
  if (patientPdfUrl !== expectedPath) throw new Error('Generated PDF path does not match approved version');
  try {
    return await prisma.$transaction(async tx => {
      const approved = await tx.consultationVersion.findFirst({ where: { id: version.id, consultationId, approvalStatus: 'APPROVED' } });
      if (!approved) throw new Error('Consultation version is no longer approved');
      const key = approvedReportKey(version.id);
      const asset = await tx.reportAsset.upsert({ where: { render_key: key }, update: {}, create: {
        ...key, clinicId: subject.clinicId, patientId: subject.patientId, assessmentId: subject.id,
        consultationId, contentVersion: version.contentVersion, status: 'READY',
        storageBucket: 'clinical-reports', storagePath: patientPdfUrl, mimeType: 'application/pdf', generatedAt: new Date(),
      } });
      if (asset.status !== 'READY' || asset.storagePath !== expectedPath || asset.clinicId !== subject.clinicId ||
          asset.patientId !== subject.patientId || asset.assessmentId !== subject.id || asset.consultationId !== consultationId) {
        throw new Error('Existing PDF record does not match approved version');
      }
      await tx.auditLog.upsert({ where: { id: `pdf-approved-${asset.id}` }, update: {}, create: {
        id: `pdf-approved-${asset.id}`, assessmentId: subject.id, clinicId: subject.clinicId,
        action: 'PDF_GENERATED', entityType: 'ConsultationVersion', entityId: version.id,
        metadata: { patientPdfUrl: asset.storagePath, reportAssetId: asset.id, contentVersion: version.contentVersion,
          consultationVersionId: version.id, patientId: subject.patientId, clinicId: subject.clinicId,
          contentHash: approved.contentHash, approvedBy: approved.approvedBy, approvedAt: approved.approvedAt?.toISOString() ?? null },
      } });
      // Preserve the old pointer verbatim before replacing it; it may predate
      // version binding, in which case we must not invent an approved version.
      const old = await tx.aIArtifact.findUnique({ where: { assessmentId_type: { assessmentId: subject.id, type: 'REPORT' } } });
      if (old) await tx.auditLog.upsert({ where: { id: `pdf-legacy-${old.id}` }, update: {}, create: {
        id: `pdf-legacy-${old.id}`, assessmentId: subject.id, clinicId: subject.clinicId,
        action: 'PDF_REFERENCE_PRESERVED', entityType: 'AIArtifact', entityId: old.id,
        metadata: old.content === null ? Prisma.JsonNull : old.content,
      } });
      const current = await tx.consultation.findUnique({ where: { id: consultationId }, select: { currentVersionId: true } });
      if (current?.currentVersionId === version.id) {
        const content = { patientPdfUrl: asset.storagePath, consultationVersionId: version.id, contentVersion: version.contentVersion,
          reportAssetId: asset.id, clinicId: subject.clinicId, patientId: subject.patientId };
        await tx.aIArtifact.upsert({ where: { assessmentId_type: { assessmentId: subject.id, type: 'REPORT' } },
          create: { assessmentId: subject.id, type: 'REPORT', content }, update: { content } });
      }
      return asset;
    });
  } catch (error) {
    // Prisma may implement a compound-key upsert as insert + unique conflict.
    // A concurrent winner has already committed its entire history transaction.
    if ((error as { code?: string }).code === 'P2002') {
      const winner = await findApprovedPdf(subject, version);
      if (winner) return winner;
    }
    throw error;
  }
}
