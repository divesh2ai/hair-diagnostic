import { SkinBoardLanding } from '@/components/skin-fact/SkinBoardLanding';

export default async function SkinFactLandingPage({ params }: { params: Promise<{ clinicSlug: string }> }) {
  const { clinicSlug } = await params;
  return <SkinBoardLanding clinicSlug={clinicSlug} />;
}
