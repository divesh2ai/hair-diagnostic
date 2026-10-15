/** Identity for an approved PDF. Names are display data, never object keys. */
export interface ApprovedReportIdentity {
  clinicId: string;
  patientId: string;
  assessmentId: string;
  consultationVersionId: string;
  contentVersion: number;
}

export const PDF_TEMPLATE_VERSION = 'approved-dossier-v1';
export const PDF_RENDERER_VERSION = 'react-pdf-v1';

export function approvedReportPath(identity: ApprovedReportIdentity): string {
  const ids = [identity.clinicId, identity.patientId, identity.assessmentId, identity.consultationVersionId];
  if (ids.some(id => !id || !/^[a-zA-Z0-9_-]+$/.test(id)) ||
      !Number.isSafeInteger(identity.contentVersion) || identity.contentVersion < 1) {
    throw new Error('Invalid approved report identity');
  }
  return `reports/${identity.clinicId}/${identity.patientId}/${identity.assessmentId}/v${identity.contentVersion}/${identity.consultationVersionId}/${PDF_TEMPLATE_VERSION}.pdf`;
}

export function approvedReportKey(consultationVersionId: string) {
  return { consultationVersionId, type: 'PATIENT_REPORT_PDF' as const,
    templateVersion: PDF_TEMPLATE_VERSION, rendererVersion: PDF_RENDERER_VERSION };
}
