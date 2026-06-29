import { DoctorReviewClient } from "./DoctorReviewClient";

// Doctor review workspace. Until 2026-06-26 this route just redirected to
// the patient-facing /assessment/[id]/report — clinicians had no review
// surface in /doctor/*. This page now reuses ClinicalReportView and adds
// a doctor-only sidebar (patient summary, notes, decision actions, final
// share actions) without rebuilding the report itself.
export default async function DoctorReportDetailPage({
  params,
}: {
  params: Promise<{ assessmentId: string }>;
}) {
  const { assessmentId } = await params;
  return <DoctorReviewClient assessmentId={assessmentId} />;
}
