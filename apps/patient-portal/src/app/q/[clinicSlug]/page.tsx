import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getClinicLandingData } from '@/lib/clinics/getClinicLandingData';

import ClinicLandingClient from './ClinicLandingClient';

interface ClinicLandingPageProps {
  params: Promise<{ clinicSlug: string }>;
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
export default async function ClinicLandingPage({ params }: ClinicLandingPageProps) {
  const { clinicSlug } = await params;
  const clinic = await getClinicLandingData(clinicSlug);

  if (!clinic || !clinic.isActive) {
    notFound();
  }

  return <ClinicLandingClient clinic={clinic} />;
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
