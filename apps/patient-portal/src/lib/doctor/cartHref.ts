/**
 * The one place a patient-cart URL is built.
 *
 * Three call sites need it — the sticky decision bar, the Report & delivery
 * block, and the WhatsApp message the doctor sends the patient — and a cart
 * path assembled independently in three components is a cart path that drifts
 * in two of them. `reviewHref` exists for the same reason on the review side.
 *
 * ── Why there is no order id in the URL ─────────────────────────────────────
 * It would be easy to append `?order=<intentId>` and call that proof of
 * identity. It would not be: the cart endpoint resolves the order from the
 * assessment's current approved version via resolveApprovedOrder, so an id in
 * the query string would either agree with that (and be decoration) or
 * disagree with it (and be a second, competing contract for which order is
 * real). One resolver, one answer. The identity is PROVEN by comparing the
 * `order` block the endpoint returns, not asserted by the link.
 */
/**
 * ── Why the token IS in the URL ─────────────────────────────────────────────
 * Unlike an order id, the cart token is not decoration and not a competing
 * claim about which order is real — it is the patient's authority to read the
 * cart at all. `/api/cart/[assessmentId]` returns 404 without it (or without a
 * clinic-scoped doctor session). It is bound to this one assessment, expires,
 * and carries no patient data; see lib/cartToken.
 *
 * `token` is optional so the doctor-side links keep working unchanged — their
 * session authorises them. Omit it and the patient gets a dead link, so the
 * WhatsApp path must always pass one.
 */
export function cartHref(assessmentId: string, token?: string | null): string {
  const base = `/cart/${assessmentId}`;
  return token ? `${base}?t=${encodeURIComponent(token)}` : base;
}

/**
 * Absolute form, for a link that leaves the app — the WhatsApp message.
 *
 * `origin` must come from the browser at call time. A relative path in a
 * message sent to a patient goes nowhere, and NEXT_PUBLIC_APP_URL can name a
 * host that does not serve this clinic.
 */
export function absoluteCartUrl(
  origin: string,
  assessmentId: string,
  token?: string | null,
): string {
  return `${origin}${cartHref(assessmentId, token)}`;
}
