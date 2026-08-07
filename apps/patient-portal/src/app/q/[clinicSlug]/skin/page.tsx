import { redirect } from 'next/navigation';

export default async function SkinFactEntryPage({
  params,
}: {
  params: Promise<{ clinicSlug: string }>;
}) {
  const { clinicSlug } = await params;
  redirect(`/skin/${clinicSlug}`);
}
