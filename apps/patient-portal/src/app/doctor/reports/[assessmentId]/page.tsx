import { signReviewToken } from "@/lib/reviewToken";
import { fetchReviewPayload } from "@/lib/consultation/reviewPayload";
import { loadDoctorShellData } from "@/components/app-shell/loadShellData";
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

  const shell = await loadDoctorShellData();
  const initial = await fetchReviewPayload(
    assessmentId,
    {
      authUserId: shell.userId,
      authEmail: shell.email,
      authRole: shell.role,
      doctor: shell.doctor,
      mode: shell.viewMode === "self" ? "doctor" : "admin_view",
    },
    false,
  );

  // Server-minted signed token so the shared patient link resolves with full
  // artifact access on /assessment/[id]/report (anonymous callers only get
  // presence flags).
  const shareToken = signReviewToken(assessmentId);

  // WHATSAPP_AUTOMATION_ENABLED — the launch-mode switch. Resolved here
  // (server-only env read) and passed down as a plain boolean prop rather
  // than a NEXT_PUBLIC_ var: the client needs to know WHETHER automation is
  // on, never anything about how it is configured.
  const whatsappAutomationEnabled = process.env.WHATSAPP_AUTOMATION_ENABLED === "1";

  return (
    <DoctorReviewClient
      assessmentId={assessmentId}
      shareToken={shareToken}
      initialData={initial.ok ? initial.body : null}
      initialError={initial.ok ? null : initial.body}
      whatsappAutomationEnabled={whatsappAutomationEnabled}
      initialConsent={null}
    />
  );
}
