"use client";

import { useParams, useSearchParams } from "next/navigation";
import { CinematicProcessing } from "@/components/processing/CinematicProcessing";

export default function ProcessingPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const clinicSlug = String(params.clinicSlug);
  const assessmentId = String(params.assessmentId ?? "");
  const previewToken = searchParams?.get("t") ?? null;

  return (
    <CinematicProcessing
      assessmentId={assessmentId}
      clinicSlug={clinicSlug}
      previewToken={previewToken}
    />
  );
}
