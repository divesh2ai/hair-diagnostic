// Instant navigation feedback for opening a patient Review.
//
// The Review page is a force-dynamic server component that reads the stored
// consultation before it can paint (see ./page.tsx and lib/consultation/
// reviewPayload). Without a route-level loading UI, clicking a patient card or
// "Review" left the doctor looking at the unchanged dashboard until that read
// finished — the click read as dead. This Suspense fallback is prefetched with
// the <Link>, so it appears the instant navigation starts and is swapped for
// the real case when the server render streams in.
//
// Deliberately a lightweight skeleton, matching DoctorReviewClient's own
// SkeletonReview so the transition is visually continuous — this is loading
// chrome, not a redesign of the review surface.
export default function Loading() {
  return (
    <div className="px-4 py-6 sm:px-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Opening patient review…</span>
      <div className="mx-auto w-full max-w-4xl animate-pulse space-y-6">
        <div className="h-32 rounded-2xl border border-stone-200 bg-white" />
        <div className="h-64 rounded-2xl border border-stone-200 bg-white" />
        <div className="h-80 rounded-2xl border border-stone-200 bg-white" />
      </div>
    </div>
  );
}
