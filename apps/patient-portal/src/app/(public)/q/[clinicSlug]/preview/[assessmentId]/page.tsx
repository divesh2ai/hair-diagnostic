"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Clock, Download, FileText, ImageIcon, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { normalizeAssessmentReportPayload } from "@/lib/adapters/assessmentAdapter";
import { ClinicalReportView } from "@/components/report/ClinicalReportView";
import type { AssessmentReportPayload } from "@shared/types/assessment";

export default function PreviewSandboxPage() {
  const params = useParams();
  const assessmentId = String(params.assessmentId ?? "");
  const clinicSlug = String(params.clinicSlug ?? "");
  const [data, setData] = useState<AssessmentReportPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    fetch(`/api/assessment/status?id=${assessmentId}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((raw) => {
        const normalized = normalizeAssessmentReportPayload(raw);
        setData(normalized);
        setError(normalized.processing.errors[0] ?? null);
      })
      .catch((err) => {
        console.error("[PreviewSandboxPage] Failed to load assessment", err);
        setError("We could not refresh this report. Please try again.");
      });
  }, [assessmentId]);

  const rerunOrchestration = useCallback(async () => {
    await fetch("/api/assessment/orchestrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assessmentId }),
    });
    refresh();
  }, [assessmentId, refresh]);

  const needsReportRefresh =
    !!data
    && (!data.narratives?.clinicalReport
      || !(data.narratives.clinicalReport as Record<string, unknown>)?.clinicalInsightStory);

  useEffect(() => {
    const firstPoll = window.setTimeout(refresh, 0);
    return () => window.clearTimeout(firstPoll);
  }, [refresh]);

  const reportContent = asObject(data?.artifactByType.REPORT?.content);
  const pdfUrl =
    typeof reportContent.patientPdfUrl === "string"
      ? reportContent.patientPdfUrl
      : typeof reportContent.reportUrl === "string"
      ? reportContent.reportUrl
      : null;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900">
      <header className="flex items-center justify-between border-b bg-white px-6 py-4">
        <div>
          <h1 className="font-semibold">Report preview</h1>
          <p className="font-mono text-xs text-slate-500">{assessmentId}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="mr-1 h-4 w-4" />
            Refresh
          </Button>
          {needsReportRefresh && (
            <Button variant="outline" size="sm" onClick={rerunOrchestration}>
              Regenerate report
            </Button>
          )}
          <Link href={`/q/${clinicSlug}/assessment`}>
            <Button variant="outline" size="sm">New assessment</Button>
          </Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-6 py-8 lg:grid-cols-3">
        <section className="space-y-4 lg:col-span-2">
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2 text-sky-600">
              <FileText className="h-5 w-5" />
              <h2 className="font-semibold">Patient report</h2>
            </div>
            <div className="flex aspect-[3/4] max-h-[480px] items-center justify-center rounded-xl border bg-gradient-to-br from-slate-100 to-slate-50 text-sm text-slate-500">
              {pdfUrl ? (
                <a href={pdfUrl} target="_blank" className="inline-flex items-center gap-2 text-sky-700 hover:text-sky-900">
                  <Download className="h-4 w-4" />
                  Open patient PDF
                </a>
              ) : data?.status === "PARTIAL_FAILURE" ? (
                "PDF delayed. The clinical report below is available."
              ) : (
                "PDF pending orchestration"
              )}
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="mb-2 font-semibold">Assessment results</h2>
            {error && <p className="mb-3 text-sm text-amber-700">{error}</p>}
            <ErrorBoundary title="Report artifacts could not be displayed">
              {data?.narratives?.clinicalReport ? (
                <ClinicalReportView report={data.narratives.clinicalReport} />
              ) : (
                <p className="text-sm text-slate-500">
                  The structured clinical report is being prepared. Please refresh in a moment.
                </p>
              )}
            </ErrorBoundary>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-slate-500" />
              <h3 className="text-sm font-semibold">Uploaded images</h3>
            </div>
            <p className="text-xs text-slate-400">Scalp photos appear here when uploaded.</p>
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4 text-slate-500" />
              <h3 className="text-sm font-semibold">Orchestration timeline</h3>
            </div>
            <ul className="space-y-2 text-xs">
              {(data?.orchestrationLogs ?? []).map((log) => (
                <li key={log.id} className="flex justify-between gap-3 text-slate-600">
                  <span className="truncate">{log.stage}</span>
                  <span className={log.status === "SUCCESS" ? "text-emerald-600" : "text-slate-400"}>
                    {log.status}
                    {log.durationMs != null && ` - ${log.durationMs}ms`}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <h3 className="mb-2 text-sm font-semibold">Artifacts</h3>
            <ul className="space-y-1 font-mono text-xs text-slate-500">
              {(data?.artifacts ?? []).map((artifact) => (
                <li key={artifact.id}>{artifact.type}</li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

function asObject(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
