"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Clock, Download, FileText, ImageIcon, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { normalizeAssessmentReportPayload } from "@/lib/adapters/assessmentAdapter";
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
              <div className="space-y-4">
                <ClinicalSummary title="Clinical profile" value={data?.artifactByType.CLINICAL_REASONING?.content} />
                <ClinicalSummary title="Severity analysis" value={data?.artifactByType.SEVERITY_ANALYSIS?.content} />
                <KitProtocol value={data?.artifactByType.RECOMMENDATIONS?.content} />
                <ClinicalSummary title="Therapy needs and protocols" value={data?.artifactByType.THERAPY_PLAN?.content} />
                <ClinicalSummary title="Doctor and patient narrative" value={data?.artifactByType.NARRATIVES?.content} />
                <ClinicalSummary title="Visual journey" value={data?.artifactByType.VISUAL_JOURNEY?.content} />
              </div>
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

function ClinicalSummary({ title, value }: { title: string; value: unknown }) {
  const object = asObject(value);
  const entries = Object.entries(object).slice(0, 8);

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-sm font-medium text-slate-800">{title}</p>
      {entries.length === 0 ? (
        <p className="mt-1 text-xs text-slate-500">Pending or unavailable</p>
      ) : (
        <dl className="mt-2 grid gap-2 text-xs">
          {entries.map(([key, entryValue]) => (
            <div key={key} className="grid gap-1 sm:grid-cols-[160px_1fr]">
              <dt className="font-medium capitalize text-slate-500">{key.replace(/_/g, " ")}</dt>
              <dd className="text-slate-700">{summarizeValue(entryValue)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

function KitProtocol({ value }: { value: unknown }) {
  const recommendation = asObject(value);
  const kits = Array.isArray(recommendation.rankedKits)
    ? (recommendation.rankedKits as Record<string, unknown>[])
    : [];

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
      <p className="text-sm font-semibold text-emerald-900">Recommended kit protocol</p>
      {typeof recommendation.protocolLabel === "string" && (
        <p className="mt-1 text-xs font-medium text-emerald-700">{recommendation.protocolLabel}</p>
      )}
      {typeof recommendation.protocolRationale === "string" && (
        <p className="mt-2 text-sm text-emerald-800">{recommendation.protocolRationale}</p>
      )}
      {kits.length === 0 ? (
        <p className="mt-3 text-sm text-emerald-700">Kit recommendations are pending.</p>
      ) : (
        <div className="mt-4 grid gap-3">
          {kits.map((kit, index) => (
            <div key={`${kit.kitId ?? index}`} className="rounded-md border border-emerald-200 bg-white p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Phase {String(kit.phase ?? index + 1)}: {String(kit.kitId ?? "Recommended kit")}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Targets: {Array.isArray(kit.matchedNeeds) && kit.matchedNeeds.length > 0 ? kit.matchedNeeds.join(", ") : "Clinical support"}
                  </p>
                </div>
                {typeof kit.score === "number" && (
                  <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
                    {kit.score}
                  </span>
                )}
              </div>
              {Array.isArray(kit.reasons) && kit.reasons.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-slate-600">
                  {kit.reasons.map((reason, reasonIndex) => (
                    <li key={reasonIndex}>{String(reason)}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function summarizeValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.length ? `${value.length} items available` : "No items";
  if (typeof value === "object" && value !== null) {
    const keys = Object.keys(value);
    return keys.length ? keys.slice(0, 6).join(", ") : "Available";
  }
  return String(value);
}

function asObject(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
