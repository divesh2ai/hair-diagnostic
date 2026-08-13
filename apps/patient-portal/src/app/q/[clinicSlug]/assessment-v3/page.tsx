import { getClinicLandingData } from '@/lib/clinics/getClinicLandingData';

import { AssessmentV3Client } from './AssessmentV3Client';

interface AssessmentV3PageProps {
  params: Promise<{ clinicSlug: string }>;
}

/**
 * Server shell for the hair assessment.
 *
 * Exists only to resolve the clinic's offered languages before the client
 * renders, so the language gate and switcher show the right list even when a
 * patient deep-links straight here without passing the landing page. Mirrors
 * the composition already used by `q/[clinicSlug]/page.tsx`, and shares its
 * cached Prisma read.
 *
 * Deliberately does NOT 404 on an unknown or inactive clinic — that is the
 * landing page's job, and changing it here would alter existing behaviour for
 * in-flight assessments. A missing clinic simply falls back to offering every
 * language the platform supports.
 */
export default async function AssessmentV3Page({ params }: AssessmentV3PageProps) {
  const { clinicSlug } = await params;
  const clinic = await getClinicLandingData(clinicSlug);

  return (
    <AssessmentV3Client
      clinicSlug={clinicSlug}
      clinic={
        clinic
          ? {
              id: clinic.id,
              name: clinic.name,
              language: clinic.language,
              supportedLanguages: clinic.supportedLanguages,
            }
          : null
      }
    />
  );
}
