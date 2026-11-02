import { redirect } from 'next/navigation';

import { isValidClinicSlug } from '@/lib/clinic/slug';

/**
 * Where a bare hostname sends a visitor.
 *
 * The platform has no home page of its own. Patients arrive by scanning one
 * clinic's QR code and staff arrive at /login, so `/` exists only so that a
 * bare hostname lands somewhere useful. A deployment can explicitly select a
 * clinic with `DEFAULT_CLINIC_SLUG`; otherwise visitors go to staff login.
 * Never guess a clinic: a demo slug may not exist in this environment.
 */

/**
 * Read at request time rather than baked into a static prerender, so the
 * default clinic can be repointed by changing the variable instead of by
 * rebuilding. A redirect costs nothing to render.
 */
export const dynamic = 'force-dynamic';

function defaultClinicSlug(): string | null {
  const configured = (process.env.DEFAULT_CLINIC_SLUG ?? '').trim().toLowerCase();
  // Validated, not trusted: a malformed or path-bearing value would otherwise
  // become a redirect to a route that cannot exist — or off this origin
  // entirely. A bad value sends the visitor to login instead.
  return isValidClinicSlug(configured) ? configured : null;
}

export default function RootPage() {
  const clinicSlug = defaultClinicSlug();
  redirect(clinicSlug ? `/q/${clinicSlug}` : '/login');
}
