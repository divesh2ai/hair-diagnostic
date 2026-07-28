import { redirect } from 'next/navigation';

interface AssessmentRedirectProps {
  params: Promise<{ clinicSlug: string }>;
}

export default async function AssessmentRedirect({ params }: AssessmentRedirectProps) {
  const { clinicSlug } = await params;
  redirect(`/q/${clinicSlug}/assessment-v3`);
}
