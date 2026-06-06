"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Download, RefreshCw } from "lucide-react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { normalizeAssessmentReportPayload } from "@/lib/adapters/assessmentAdapter";
import type { AssessmentReportPayload } from "@shared/types/assessment";

function DownloadButton({ assessmentId, pdfUrl }: { assessmentId: string; pdfUrl: string | null }) {
  const downloadPDF = async () => {
    const res = pdfUrl
      ? await fetch(pdfUrl)
      : await fetch(`/api/assessment/pdf?id=${assessmentId}`);

    if (!res.ok) {
      alert("PDF not ready yet");
      return;
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hair-report-${assessmentId}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  return (
    <button
      onClick={downloadPDF}
      className="inline-flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-800"
    >
      <Download className="h-4 w-4" />
      {pdfUrl ? "Download PDF" : "Check PDF"}
    </button>
  );
}

export default function ReportPage() {
  const { id } = useParams();
  const assessmentId = String(id ?? "");
  const [report, setReport] = useState<AssessmentReportPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/assessment/status?id=${assessmentId}`, { cache: "no-store" });
      const json = await res.json();
      const normalized = normalizeAssessmentReportPayload(json);
      setReport(normalized);
      setLoadError(normalized.processing.errors[0] ?? null);
    } catch (error) {
      console.error("[ReportPage] Error fetching assessment status:", error);
      setLoadError("We could not load the latest report data.");
    } finally {
      setLoading(false);
    }
  }, [assessmentId]);

  useEffect(() => {
    const firstPoll = window.setTimeout(fetchData, 0);
    const interval = setInterval(fetchData, 3000);
    return () => {
      window.clearTimeout(firstPoll);
      clearInterval(interval);
    };
  }, [fetchData]);

  if (loading) {
    return <div className="p-10 text-center font-medium text-gray-500">Loading assessment data...</div>;
  }

  const reportArtifact = report?.artifactByType.REPORT;
  const reportContent = asObject(reportArtifact?.content);
  const pdfUrl = typeof reportContent.patientPdfUrl === "string" ? reportContent.patientPdfUrl : null;

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl space-y-6 p-6">
        <header className="rounded-lg border bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Hair Analysis Report</h1>
              <p className="mt-1 text-sm text-gray-600">
                Status: <span className="font-semibold">{report?.status ?? "PENDING"}</span>
              </p>
              <p className="text-sm text-gray-600">
                Stage: <span className="font-semibold text-indigo-600">{report?.processing.stage ?? "INITIALIZING"}</span>
              </p>
              {loadError && <p className="mt-2 text-sm text-amber-700">{loadError}</p>}
            </div>
            <div className="flex gap-2">
              <button
                onClick={fetchData}
                className="inline-flex items-center gap-2 rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
              <DownloadButton assessmentId={assessmentId} pdfUrl={pdfUrl} />
            </div>
          </div>
        </header>

        {report?.status === "PARTIAL_FAILURE" && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Some sections are still unavailable. The report below is rendered from completed artifacts.
          </div>
        )}

        <ErrorBoundary title="Clinical profile could not be displayed">
          <ReportSection title="Clinical Profile" value={report?.artifactByType.CLINICAL_REASONING?.content} />
        </ErrorBoundary>
        <ErrorBoundary title="Severity analysis could not be displayed">
          <ReportSection title="Severity Analysis" value={report?.artifactByType.SEVERITY_ANALYSIS?.content} />
        </ErrorBoundary>
        <ErrorBoundary title="Therapy recommendations could not be displayed">
          <KitProtocol value={report?.artifactByType.RECOMMENDATIONS?.content} />
        </ErrorBoundary>
        <ErrorBoundary title="Protocols could not be displayed">
          <ReportSection title="Protocols" value={report?.artifactByType.THERAPY_PLAN?.content} />
        </ErrorBoundary>
        <ErrorBoundary title="Narratives could not be displayed">
          <ReportSection title="Doctor Narrative / Patient Narrative / Prognosis" value={report?.artifactByType.NARRATIVES?.content} />
        </ErrorBoundary>
        <ErrorBoundary title="Visual journey could not be displayed">
          <ReportSection title="Visual Journey" value={report?.artifactByType.VISUAL_JOURNEY?.content} />
        </ErrorBoundary>

        <footer className="flex items-center justify-between border-t border-gray-100 pt-4 text-xs text-gray-400">
          <p>ID: {assessmentId}</p>
          <p>{pdfUrl ? "PDF available" : "PDF generation pending"}</p>
        </footer>
      </div>
    </main>
  );
}

function ReportSection({ title, value }: { title: string; value: unknown }) {
  const object = asObject(value);
  const entries = Object.entries(object);

  return (
    <section className="rounded-lg border bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-lg font-bold text-gray-800">{title}</h2>
      {entries.length === 0 ? (
        <p className="text-sm text-gray-400">Pending or unavailable.</p>
      ) : (
        <dl className="grid gap-3">
          {entries.slice(0, 12).map(([key, entryValue]) => (
            <div key={key} className="grid gap-1 border-b border-gray-100 pb-2 last:border-0 sm:grid-cols-[190px_1fr]">
              <dt className="text-sm font-medium capitalize text-gray-500">{key.replace(/_/g, " ")}</dt>
              <dd className="text-sm text-gray-800">{summarizeValue(entryValue)}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

function KitProtocol({ value }: { value: unknown }) {
  const recommendation = asObject(value);
  const kits = Array.isArray(recommendation.rankedKits)
    ? (recommendation.rankedKits as Record<string, unknown>[])
    : [];

  return (
    <section className="rounded-lg border border-emerald-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold text-gray-900">Therapy Recommendations</h2>
      {typeof recommendation.protocolLabel === "string" && (
        <p className="mt-1 text-sm font-semibold text-emerald-700">{recommendation.protocolLabel}</p>
      )}
      {typeof recommendation.protocolRationale === "string" && (
        <p className="mt-3 text-sm leading-6 text-gray-700">{recommendation.protocolRationale}</p>
      )}

      {kits.length === 0 ? (
        <p className="mt-4 text-sm text-gray-400">Kit recommendations are pending.</p>
      ) : (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {kits.map((kit, index) => (
            <article key={`${kit.kitId ?? index}`} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    Phase {String(kit.phase ?? index + 1)}
                  </p>
                  <h3 className="mt-1 text-base font-bold text-emerald-800">{String(kit.kitId ?? "Recommended kit")}</h3>
                </div>
                {typeof kit.score === "number" && (
                  <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
                    Score {kit.score}
                  </span>
                )}
              </div>
              <p className="mt-3 text-xs font-medium text-gray-500">
                Targets: {Array.isArray(kit.matchedNeeds) && kit.matchedNeeds.length > 0 ? kit.matchedNeeds.join(", ") : "Clinical support"}
              </p>
              {Array.isArray(kit.reasons) && kit.reasons.length > 0 && (
                <ul className="mt-3 list-disc space-y-1 pl-4 text-sm text-gray-700">
                  {kit.reasons.map((reason, reasonIndex) => (
                    <li key={reasonIndex}>{String(reason)}</li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>
      )}

      {typeof recommendation.selectionJustification === "string" && (
        <div className="mt-5 rounded-md border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm font-semibold text-gray-900">Clinical justification</p>
          <p className="mt-2 whitespace-pre-line text-sm leading-6 text-gray-700">
            {recommendation.selectionJustification}
          </p>
        </div>
      )}
    </section>
  );
}

function summarizeValue(value: unknown): string {
  if (value == null) return "Pending or unavailable";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return "None";
    if (value.every((item) => typeof item === "string" || typeof item === "number")) return value.join(", ");
    return `${value.length} items`;
  }
  if (typeof value === "object") return Object.keys(value).slice(0, 8).join(", ") || "Available";
  return String(value);
}

function asObject(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
