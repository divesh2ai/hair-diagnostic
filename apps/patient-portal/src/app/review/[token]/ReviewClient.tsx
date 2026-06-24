"use client";

import { useCallback, useEffect, useState } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ClinicalReportView } from "@/components/report/ClinicalReportView";
import { normalizeAssessmentReportPayload } from "@/lib/adapters/assessmentAdapter";
import type { AssessmentReportPayload } from "@shared/types/assessment";
import { ReviewFooter, type ReviewMeta } from "./ReviewFooter";

// Doctor review surface. Reuses the existing /api/assessment/status fetcher
// and ClinicalReportView component — this page deliberately does NOT
// reimplement the report. Its only job is to render the same thing the
// patient sees, plus a sticky approval footer that writes back through
// /api/review/[token].

interface Props {
  assessmentId: string;
  token: string;
}

export function ReviewClient({ assessmentId, token }: Props) {
  const [data, setData] = useState<AssessmentReportPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<ReviewMeta | null>(null);

  const load = useCallback(async () => {
    try {
      const [statusRes, reviewRes] = await Promise.all([
        fetch(`/api/assessment/status?id=${assessmentId}`, { cache: "no-store" }),
        fetch(`/api/review/${token}`, { cache: "no-store" }),
      ]);
      const raw = await statusRes.json();
      setData(normalizeAssessmentReportPayload(raw));

      if (reviewRes.ok) {
        const r = await reviewRes.json();
        setMeta({
          decision: r.review?.decision ?? "PENDING",
          reviewerName: r.review?.reviewerName ?? "",
          reviewerEmail: r.review?.reviewerEmail ?? "",
          notes: r.review?.notes ?? "",
          reviewedAt: r.review?.reviewedAt ?? null,
          patientName: r.patient?.name ?? null,
          clinicName: r.clinic?.name ?? null,
        });
      }
      setError(null);
    } catch (err) {
      console.error("[REVIEW] load failed", err);
      setError("We could not load this report. Please refresh.");
    }
  }, [assessmentId, token]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <main className="min-h-[100dvh] grid place-items-center bg-stone-50 px-6">
        <p className="text-stone-600">{error}</p>
      </main>
    );
  }

  if (!data || !meta) {
    return (
      <main className="min-h-[100dvh] grid place-items-center bg-stone-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-slate-900 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 font-medium">Loading report…</p>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 via-white to-stone-50 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-stone-200/80 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-teal-700">
              Doctor review · {meta.clinicName ?? "Clinic"}
            </p>
            <p className="truncate text-[13px] font-medium text-slate-700">
              {meta.patientName ?? "Patient case"}
            </p>
          </div>
          {meta.decision !== "PENDING" && (
            <span
              className="rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide"
              style={decisionBadgeStyle(meta.decision)}
            >
              {decisionLabel(meta.decision)}
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pt-6 pb-44 sm:px-6 lg:px-8">
        <ErrorBoundary title="Report could not be displayed">
          {data.narratives?.clinicalReport ? (
            <ClinicalReportView report={data.narratives.clinicalReport} />
          ) : (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-6 text-sm text-amber-900">
              The clinical report is not ready yet for this case.
            </div>
          )}
        </ErrorBoundary>
      </main>

      <ReviewFooter
        token={token}
        meta={meta}
        onSubmitted={(next) => setMeta(next)}
      />
    </div>
  );
}

function decisionLabel(d: ReviewMeta["decision"]): string {
  switch (d) {
    case "APPROVED": return "Approved";
    case "EDITS_REQUESTED": return "Edits requested";
    case "REJECTED": return "Rejected";
    default: return "Pending";
  }
}

function decisionBadgeStyle(d: ReviewMeta["decision"]): React.CSSProperties {
  switch (d) {
    case "APPROVED":        return { color: "#047857", background: "#ecfdf5", borderColor: "#a7f3d0" };
    case "EDITS_REQUESTED": return { color: "#b45309", background: "#fffbeb", borderColor: "#fcd34d" };
    case "REJECTED":        return { color: "#b91c1c", background: "#fef2f2", borderColor: "#fecaca" };
    default:                return { color: "#475569", background: "#f8fafc", borderColor: "#e2e8f0" };
  }
}
