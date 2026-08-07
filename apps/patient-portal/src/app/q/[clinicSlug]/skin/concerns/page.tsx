import { SkinConcernMultiSelect } from '@/components/skin-fact/SkinConcernMultiSelect';

export default async function SkinConcernSelectionPage({
  params,
}: {
  params: Promise<{ clinicSlug: string }>;
}) {
  const { clinicSlug } = await params;
  return <SkinConcernMultiSelect clinicSlug={clinicSlug} />;
}
