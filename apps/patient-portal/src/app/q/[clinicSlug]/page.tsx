import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getClinicLandingData } from '@/lib/clinics/getClinicLandingData';
import { listClinicBranches, resolveClinicBranch } from '@/lib/clinics/branches';
import { prisma } from '@/lib/prisma';

import ClinicLandingClient from './ClinicLandingClient';

interface ClinicLandingPageProps {
  params: Promise<{ clinicSlug: string }>;
  searchParams: Promise<{ branch?: string | string[] }>;
}

/** First value only — `?branch=a&branch=b` is a malformed link, not a choice. */
function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/**
 * Patient-facing clinic landing page.
 *
 * Rendered as a Server Component so the initial HTML the browser receives
 * already contains the resolved clinic data — no post-hydration fetch, no
 * "Preparing your clinic" flash. The underlying Prisma lookup is memoised via
 * `unstable_cache` in `getClinicLandingData`; mutation handlers invalidate the
 * `clinic:${slug}` tag so admin/clinic edits appear on the next request.
 */
export default async function ClinicLandingPage({ params, searchParams }: ClinicLandingPageProps) {
  const { clinicSlug } = await params;
  const clinic = await getClinicLandingData(clinicSlug);

  if (!clinic || !clinic.isActive) {
    notFound();
  }

  // Branch attribution for the shared clinic route. Only branches with a QR
  // handle are offerable; an invalid or absent `?branch=` leaves the patient to
  // choose when there is more than one. Validation is scoped to this clinic, so
  // a slug can never select another clinic's branch.
  const rawBranch = firstParam((await searchParams).branch);
  const [branches, validated] = await Promise.all([
    listClinicBranches(prisma, clinic.id, { withSlugOnly: true }),
    resolveClinicBranch(prisma, clinic.id, rawBranch),
  ]);

  return (
    <ClinicLandingClient
      clinic={clinic}
      branches={branches
        .filter((b): b is typeof b & { slug: string } => Boolean(b.slug))
        .map((b) => ({ id: b.id, slug: b.slug, branchName: b.branchName }))}
      initialBranch={validated?.slug ?? null}
    />
  );
}

export async function generateMetadata({ params }: ClinicLandingPageProps): Promise<Metadata> {
  const { clinicSlug } = await params;
  const clinic = await getClinicLandingData(clinicSlug);

  if (!clinic || !clinic.isActive) {
    return { title: 'Clinic — DR. FACT' };
  }

  const title = `${clinic.name} — DR. FACT`;
  const description = clinic.tagline ?? 'AI-powered, doctor-guided hair health assessment.';

  return {
    title,
    description,
    openGraph: { title, description },
  };
}
