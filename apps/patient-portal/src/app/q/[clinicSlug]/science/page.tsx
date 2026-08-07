'use client';

import { useParams } from 'next/navigation';
import RootCauseStory from '@/components/education/RootCauseStory';

export default function ClinicSciencePage() {
  const params = useParams();
  const clinicSlug = String(params.clinicSlug ?? '');

  return (
    <RootCauseStory
      ctaHref={`/q/${clinicSlug}/assessment`}
      ctaLabel="Start my assessment"
      backHref={`/q/${clinicSlug}`}
      backLabel="Back to clinic"
      showScrollHint
    />
  );
}
