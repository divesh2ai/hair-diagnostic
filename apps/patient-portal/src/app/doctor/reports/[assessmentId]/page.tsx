import { signReviewToken } from "@/lib/reviewToken";
import { fetchReviewPayload } from "@/lib/consultation/reviewPayload";
import { getPatientWhatsappConsent } from "@/lib/patient/whatsappConsent";
import { DoctorReviewClient } from "./DoctorReviewClient";

// Doctor review workspace.
//
// ── Why the review is resolved HERE ─────────────────────────────────────────
// The client used to fetch `/api/consultation/[id]` on mount, so opening a
// case ran server-render → bundle download → hydrate → API round trip →
// paint, strictly in series, with a skeleton on screen for all of it. The
// server can authenticate and read the record while the browser is still
// downloading JavaScript, so it does: the payload is resolved during server
// rendering and handed to the client as props.
//
// The client keeps its own `load()` for refresh-after-edit, retry and conflict
// recovery — it simply no longer needs it to show the case in the first place.
export default async function DoctorReportDetailPage({
  params,
}: {
  params: Promise<{ assessmentId: string }>;
}) {
  const { assessmentId } = await params;

  const initial = await fetchReviewPayload(assessmentId);

  // Server-minted signed token so the shared patient link resolves with full
  // artifact access on /assessment/[id]/report (anonymous callers only get
  // presence flags).
  const shareToken = signReviewToken(assessmentId);

  // WHATSAPP_AUTOMATION_ENABLED — the launch-mode switch. Resolved here
  // (server-only env read) and passed down as a plain boolean prop rather
  // than a NEXT_PUBLIC_ var: the client needs to know WHETHER automation is
  // on, never anything about how it is configured.
  const whatsappAutomationEnabled = process.env.WHATSAPP_AUTOMATION_ENABLED === "1";

  // Consent is read only when there is a patient to read it for, and only
  // over the guarded reader — see lib/patient/whatsappConsent.ts for why this
  // cannot be folded into fetchReviewPayload's own query.
  const patientId = initial.ok ? initial.body.consultation.patient.id : null;
  const consent = patientId
    ? await getPatientWhatsappConsent(patientId).catch(() => null)
    : null;

  return (
    <DoctorReviewClient
      assessmentId={assessmentId}
      shareToken={shareToken}
      initialData={initial.ok ? initial.body : null}
      initialError={initial.ok ? null : initial.body}
      whatsappAutomationEnabled={whatsappAutomationEnabled}
      initialConsent={
        consent ? { consent: consent.consent, provisioned: consent.provisioned } : null
      }
    />
  );
}
