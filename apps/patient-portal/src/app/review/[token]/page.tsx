import { notFound } from "next/navigation";
import { verifyReviewToken } from "@/lib/reviewToken";
import { ReviewClient } from "./ReviewClient";

// Server entry: verifies the signed token before we hand the assessmentId
// to the client. Doing this server-side keeps the assessmentId off the
// network path of a doctor who only ever holds the token URL — they can
// approve a case without seeing the internal cuid.
//
// We deliberately DO NOT fetch report data here. The client reuses the
// existing /api/assessment/status endpoint that the patient preview page
// already consumes; rebuilding the loader here would duplicate that.
export default async function ReviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = verifyReviewToken(token);

  if (!result.ok) {
    return (
      <main className="min-h-[100dvh] grid place-items-center bg-stone-50 px-6">
        <div className="max-w-md text-center space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-700">
            DrFACT review link
          </p>
          <h1 className="font-serif text-2xl text-slate-900">
            {result.error === "EXPIRED"
              ? "This link has expired."
              : "This link is not valid."}
          </h1>
          <p className="text-sm text-stone-600">
            {result.error === "EXPIRED"
              ? "Please ask the clinic to share a fresh review link."
              : "Please double-check the URL or request a new link from the clinic."}
          </p>
        </div>
      </main>
    );
  }

  return <ReviewClient assessmentId={result.assessmentId} token={token} />;
}
