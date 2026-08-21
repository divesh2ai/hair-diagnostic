import { signReviewToken } from "@/lib/reviewToken";
import { fetchReviewPayload } from "@/lib/consultation/reviewPayload";
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

  return (
    <DoctorReviewClient
      assessmentId={assessmentId}
      shareToken={shareToken}
      initialData={initial.ok ? initial.body : null}
      initialError={initial.ok ? null : initial.body}
    />
  );
}
