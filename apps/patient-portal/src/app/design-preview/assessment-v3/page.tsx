import type { Metadata } from "next";

import { AssessmentV3Preview, type PreviewView } from "./AssessmentV3Preview";

export const metadata: Metadata = {
  title: "Assessment V3 Preview | Dr. FACT",
  description: "Isolated approval preview for the Dr. FACT patient assessment experience.",
};

type PreviewPageProps = {
  searchParams: Promise<{ view?: string | string[] }>;
};

const PREVIEW_VIEWS: PreviewView[] = ["desktop", "mobile", "chapter"];

export default async function AssessmentV3PreviewPage({ searchParams }: PreviewPageProps) {
  const requestedView = (await searchParams).view;
  const viewValue = Array.isArray(requestedView) ? requestedView[0] : requestedView;
  const view = PREVIEW_VIEWS.includes(viewValue as PreviewView)
    ? (viewValue as PreviewView)
    : "desktop";

  return <AssessmentV3Preview view={view} />;
}
