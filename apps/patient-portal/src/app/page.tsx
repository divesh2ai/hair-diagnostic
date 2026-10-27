import { redirect } from 'next/navigation';

import { isValidClinicSlug } from '@/lib/clinic/slug';
import { getAuthClaims } from '@/lib/auth';
import { rootForRole } from '@/lib/navigation';

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

export default async function RootPage() {
  // Role-aware root. An authenticated STAFF/ADMIN session must NEVER fall
  // through to a clinic's PATIENT assessment page — that is the P0 bug where a
  // Super Admin who lands on "/" (e.g. via an OAuth Site-URL fallback) was
  // dumped onto /q/<DEFAULT_CLINIC_SLUG>. Route them to their own console
  // instead. Anonymous visitors and patients keep the public clinic entry, so
  // /q/[slug] stays publicly reachable and the QR-scan flow is unchanged.
  const claims = await getAuthClaims().catch(() => null);
  const role = claims?.user_role;
  if (role && role !== 'PATIENT') {
    redirect(rootForRole(role));
  }
  redirect(`/q/${defaultClinicSlug()}`);
}
