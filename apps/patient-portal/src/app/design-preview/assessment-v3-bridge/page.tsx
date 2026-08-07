import type { Metadata } from 'next';

import { AssessmentBridgePreview, type PreviewView } from './AssessmentBridgePreview';

export const metadata: Metadata = {
  title: 'Assessment V3 · Biological bridge · Dr. FACT',
  description:
    'Isolated approval prototype driving the real Assessment V3 journey with the biological-bridge progress system.',
};

type PageProps = {
  searchParams: Promise<{ view?: string | string[]; clinic?: string | string[] }>;
};

const VIEWS: PreviewView[] = ['desktop', 'mobile', 'responsive'];

export default async function AssessmentBridgePreviewPage({ searchParams }: PageProps) {
  const raw = await searchParams;
  const requestedView = Array.isArray(raw.view) ? raw.view[0] : raw.view;
  const requestedClinic = Array.isArray(raw.clinic) ? raw.clinic[0] : raw.clinic;
  const view: PreviewView = VIEWS.includes(requestedView as PreviewView)
    ? (requestedView as PreviewView)
    : 'responsive';

  return <AssessmentBridgePreview view={view} clinicSlug={requestedClinic ?? undefined} />;
}
