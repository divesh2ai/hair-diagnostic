import { redirect } from 'next/navigation';

import { isValidClinicSlug } from '@/lib/clinic/slug';

/**
 * Where a bare hostname sends a visitor.
 *
 * The platform has no home page of its own. Patients arrive by scanning one
 * clinic's QR code and staff arrive at /login, so `/` exists only so that a
 * bare hostname lands somewhere useful — which means it has to name a clinic,
 * and which clinic that is differs per deployment.
 *
 * It was hardcoded to the demo seed's `drfact-mumbai`, a clinic that has never
 * existed in staging, so every Preview visitor hit `/q/drfact-mumbai` and got
 * the landing page's `notFound()`. The slug is configuration, not a constant.
 *
 * `DEFAULT_CLINIC_SLUG` supplies it. When unset the fallback below applies, so
 * production behaves exactly as it did before this file changed; staging sets
 * the variable to its own clinic and no staging value is written into the code.
 */
const FALLBACK_CLINIC_SLUG = 'drfact-mumbai';

/**
 * Read at request time rather than baked into a static prerender, so the
 * default clinic can be repointed by changing the variable instead of by
 * rebuilding. A redirect costs nothing to render.
 */
export const dynamic = 'force-dynamic';

function defaultClinicSlug(): string {
  const configured = (process.env.DEFAULT_CLINIC_SLUG ?? '').trim().toLowerCase();
  // Validated, not trusted: a malformed or path-bearing value would otherwise
  // become a redirect to a route that cannot exist — or off this origin
  // entirely. A bad value falls back rather than propagating.
  return isValidClinicSlug(configured) ? configured : FALLBACK_CLINIC_SLUG;
}

export default function RootPage() {
  redirect(`/q/${defaultClinicSlug()}`);
}
