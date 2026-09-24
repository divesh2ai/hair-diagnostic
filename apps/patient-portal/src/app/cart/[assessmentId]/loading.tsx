// Instant feedback for the patient-cart / clinic-order screen.
//
// The page is a force-dynamic server component that resolves the caller and
// loads the order before it can paint (see ./page.tsx and lib/cart/
// loadCartData). The doctor opens it in a new tab from the Review decision bar,
// and a patient opens it from their WhatsApp link; in both cases this Suspense
// fallback shows immediately instead of a blank tab, and is swapped for the
// real order once the server render streams in.
//
// Neutral loading chrome only — no order, price or governance data is shown
// here, and nothing about the cart's design is changed.
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading order…</span>
      <div className="animate-pulse space-y-4">
        <div className="h-20 rounded-2xl border border-stone-200 bg-white" />
        <div className="h-40 rounded-2xl border border-stone-200 bg-white" />
        <div className="h-40 rounded-2xl border border-stone-200 bg-white" />
      </div>
    </div>
  );
}
