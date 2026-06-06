"use client";

import { useParams } from "next/navigation";
import { OrchestrationProgress } from "@/components/processing/OrchestrationProgress";

export default function ProcessingPage() {
  const params = useParams();
  const clinicSlug = String(params.clinicSlug);
  const assessmentId = String(params.assessmentId ?? "");

  return (
    <OrchestrationProgress
      assessmentId={assessmentId}
      clinicSlug={clinicSlug}
    />
  );
}
