"use client";

import { useParams } from "next/navigation";
import { CinematicProcessing } from "@/components/processing/CinematicProcessing";

export default function ProcessingPage() {
  const params = useParams();
  const clinicSlug = String(params.clinicSlug);
  const assessmentId = String(params.assessmentId ?? "");

  return (
    <CinematicProcessing
      assessmentId={assessmentId}
      clinicSlug={clinicSlug}
    />
  );
}
