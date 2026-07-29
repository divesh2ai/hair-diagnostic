import 'server-only';
import { unstable_cache } from 'next/cache';

import { prisma } from '@/lib/prisma';

/**
 * Public fields the patient-facing clinic landing page is allowed to render.
 * Do NOT widen this shape without checking the client component AND confirming
 * the field is safe to serialise to the browser. Private branding config,
 * settings blobs, WhatsApp/PDF config, member lists etc. must never leak here.
 */
export interface LeadDoctorPublicProfile {
  id: string;
  name: string;
  specialization: string | null;
  credentials: string | null;
  photoUrl: string | null;
  bio: string | null;
}

export interface ClinicLandingData {
  id: string;
  slug: string;
  name: string;
  language: string;
  address: string | null;
  tagline: string | null;
  isActive: boolean;
  leadDoctor: LeadDoctorPublicProfile | null;
}

/** URL-safe slug: lowercase, trimmed, alphanumeric + hyphen + underscore. */
const SAFE_SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;

export function normaliseClinicSlug(raw: string | undefined | null): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim().toLowerCase();
  if (!SAFE_SLUG_RE.test(trimmed)) return null;
  return trimmed;
}

export function clinicCacheTag(slug: string): string {
  return `clinic:${slug}`;
}

/**
 * Uncached lookup — always hits Postgres. Callers should prefer the cached
 * wrapper (`getClinicLandingData`) for read paths.
 */
async function fetchClinicLandingUncached(slug: string): Promise<ClinicLandingData | null> {
  const clinic = await prisma.clinic.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      language: true,
      address: true,
      tagline: true,
      isActive: true,
      // Lead clinician = isPrimary first, else oldest active doctor.
      doctors: {
        where: { isActive: true, deletedAt: null },
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
        take: 1,
        select: {
          id: true,
          name: true,
          specialization: true,
          credentials: true,
          photoUrl: true,
          bio: true,
        },
      },
    },
  });

  if (!clinic) return null;

  const { doctors, ...rest } = clinic;
  return { ...rest, leadDoctor: doctors[0] ?? null };
}

/**
 * Cached read for the clinic landing page.
 *
 * Cache key includes the slug so one clinic's branding can never be served
 * under another slug. Tagged `clinic:${slug}` so mutation handlers can
 * invalidate exactly one clinic without wiping the whole cache.
 *
 * The `cacheComponents` experimental flag is not enabled in this project, so
 * we use `unstable_cache` — the supported Next.js primitive for our version.
 */
export async function getClinicLandingData(rawSlug: string): Promise<ClinicLandingData | null> {
  const slug = normaliseClinicSlug(rawSlug);
  if (!slug) return null;

  const cached = unstable_cache(
    () => fetchClinicLandingUncached(slug),
    ['clinic-landing', slug],
    {
      revalidate: 3600,
      tags: [clinicCacheTag(slug)],
    },
  );

  return cached();
}
