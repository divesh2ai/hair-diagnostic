"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, Clock, Download, FileText, ImageIcon, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { normalizeAssessmentReportPayload } from "@/lib/adapters/assessmentAdapter";
import { ClinicalReportView } from "@/components/report/ClinicalReportView";
import { PremiumDashboardView } from "@/components/report/PremiumDashboardView";
import { HairStoryHero } from "@/components/hair-story/HairStoryHero";
import { HairStoryBuilding } from "@/components/hair-story/HairStoryBuilding";
import type { BuildingChecklistState } from "@/components/hair-story/HairStoryBuilding";
import { useAssessmentStore } from "@/stores/useAssessmentStore";
import type { AssessmentReportPayload } from "@shared/types/assessment";

const POLL_INTERVAL_MS = 2000;

export default function PreviewSandboxPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const variant = searchParams?.get("v");
  const usePremium = variant === "premium";
  const previewToken = searchParams?.get("t");
  const tokenQs = previewToken ? `&t=${encodeURIComponent(previewToken)}` : "";
  const resetAssessment = useAssessmentStore((s) => s.reset);
  const assessmentId = String(params.assessmentId ?? "");
  const clinicSlug = String(params.clinicSlug ?? "");
  const [data, setData] = useState<AssessmentReportPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [debugOpen, setDebugOpen] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const reportSectionRef = useRef<HTMLDivElement>(null);

  const startNewAssessment = useCallback(() => {
    resetAssessment();
    router.push(`/q/${clinicSlug}/assessment`);
  }, [resetAssessment, router, clinicSlug]);

  const refresh = useCallback(() => {
    fetch(`/api/assessment/status?id=${assessmentId}${tokenQs}`, { cache: "no-store" })
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
  }, [assessmentId, tokenQs]);

  const rerunOrchestration = useCallback(
    async (force = false) => {
      await fetch("/api/assessment/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assessmentId, force }),
      });
      refresh();
    },
    [assessmentId, refresh],
  );

  // â”€â”€ Initial load + auto-poll while video is not yet READY/UNAVAILABLE â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    refresh();
  }, [refresh]);

  const videoState = data?.video.state ?? "PENDING";
  const isWaiting = videoState === "PENDING" || videoState === "RENDERING";

  useEffect(() => {
    if (!isWaiting) return;
    const id = window.setInterval(refresh, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [isWaiting, refresh]);

  const checklist: BuildingChecklistState = useMemo(() => {
    const presence = data?.artifactPresence ?? {};
    const status = data?.status ?? "PENDING";
    const pastClinical =
      status === "GENERATING_RECOMMENDATIONS" ||
      status === "GENERATING_NARRATIVE" ||
      status === "GENERATING_VIDEO_SCRIPT" ||
      status === "RENDERING_VIDEO" ||
      status === "GENERATING_REPORT" ||
      status === "COMPLETED" ||
      status === "PARTIAL_FAILURE";
    return {
      assessmentComplete: pastClinical || Boolean(presence.severityAnalysis),
      driversIdentified: Boolean(presence.severityAnalysis),
      recoveryPlanGenerated: Boolean(presence.recommendations),
      doctorNarrativeCreating: !presence.narratives,
      doctorNarrativeReady: Boolean(presence.narratives),
      videoRendering: videoState === "PENDING" || videoState === "RENDERING",
    };
  }, [data?.artifactPresence, data?.status, videoState]);

  const needsReportRefresh =
    !!data
    && (!data.narratives?.clinicalReport
      || !(data.narratives.clinicalReport as Record<string, unknown>)?.clinicalInsightStory);

  const reportContent = asObject(data?.artifactByType.REPORT?.content);
  const pdfUrl =
    typeof reportContent.patientPdfUrl === "string"
      ? reportContent.patientPdfUrl
      : typeof reportContent.reportUrl === "string"
      ? reportContent.reportUrl
      : null;
  const pdfRoute = `/api/assessment/pdf?id=${assessmentId}${tokenQs}`;
  const pdfDownloadRoute = `/api/assessment/pdf?id=${assessmentId}&download=1${tokenQs}`;
  const clinicalReport = data?.narratives?.clinicalReport;
  const reportIsReady = Boolean(clinicalReport);

  const generateAndDownloadPdf = useCallback(async () => {
    if (!assessmentId || isGeneratingPdf) return;
    setIsGeneratingPdf(true);
    setError(null);

    try {
      if (!pdfUrl) {
        const response = await fetch("/api/assessment/pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assessmentId }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.error ?? "We could not generate the PDF yet.");
        }

        refresh();
      }

      window.location.href = pdfDownloadRoute;
    } catch (err) {
      console.error("[PreviewSandboxPage] Failed to generate PDF", err);
      setError(err instanceof Error ? err.message : "We could not generate the PDF yet.");
    } finally {
      setIsGeneratingPdf(false);
    }
  }, [assessmentId, isGeneratingPdf, pdfDownloadRoute, pdfUrl, refresh]);
  const scrollToReport = useCallback(() => {
    reportSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 via-white to-stone-50 text-slate-900">
      {/* â”€â”€ Top bar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <header className="sticky top-0 z-30 border-b border-stone-200/80 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-teal-700">
              DrFACT clinical report
            </p>
            <p className="truncate font-mono text-[11px] text-stone-400">
              {assessmentId}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={refresh}>
              <RefreshCw className="mr-1 h-4 w-4" />
              Refresh
            </Button>
            {!isWaiting && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => rerunOrchestration(reportIsReady)}
                title={
                  reportIsReady
                    ? "Force-rebuild this report from scratch (uses latest engine)"
                    : "Trigger orchestration for this assessment"
                }
              >
                Regenerate
              </Button>
            )}
            <Button size="sm" onClick={startNewAssessment}>
              New assessment
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pt-6 pb-32 sm:px-6 lg:px-8">
        {/* â”€â”€ Video-first hero state machine â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {videoState === "READY" && data?.video.url ? (
          <HairStoryHero
            videoUrl={data.video.url}
            thumbnailUrl={data.video.thumbnailUrl}
            onViewReport={scrollToReport}
          />
        ) : isWaiting ? (
          <HairStoryBuilding checklist={checklist} />
        ) : null}

        <div ref={reportSectionRef} className="mt-12">
          {!reportIsReady && !isWaiting && error && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-900">
              {error}
            </div>
          )}
          <ErrorBoundary title="Report artifacts could not be displayed">
            {reportIsReady ? (
              usePremium ? (
                <PremiumDashboardView report={clinicalReport} />
              ) : (
                <ClinicalReportView report={clinicalReport} />
              )
            ) : (
              <ReportPlaceholder onRefresh={refresh} />
            )}
          </ErrorBoundary>
        </div>
        {!isWaiting && (
          <section className="mt-10 overflow-hidden rounded-2xl border border-stone-200 bg-white">
            <button
              type="button"
              onClick={() => setDebugOpen((v) => !v)}
              className="flex w-full items-center justify-between px-5 py-3 text-left text-sm font-medium text-stone-700 hover:bg-stone-50"
              aria-expanded={debugOpen}
            >
              <span className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-stone-400" />
                Orchestration & artifacts (debug)
              </span>
              <ChevronDown
                className={`h-4 w-4 text-stone-400 transition-transform ${debugOpen ? "rotate-180" : ""}`}
              />
            </button>
            {debugOpen && (
              <div className="grid gap-5 border-t border-stone-200 bg-stone-50/60 p-5 sm:grid-cols-3">
                <DebugCard icon={<ImageIcon className="h-4 w-4" />} title="Uploaded images">
                  <p className="text-xs text-stone-500">
                    Scalp photos appear here when uploaded.
                  </p>
                </DebugCard>

                <DebugCard icon={<Clock className="h-4 w-4" />} title="Orchestration timeline">
                  <ul className="max-h-48 space-y-1.5 overflow-auto pr-1 text-xs">
                    {(data?.orchestrationLogs ?? []).map((log) => (
                      <li key={log.id} className="flex justify-between gap-3 text-stone-600">
                        <span className="truncate">{log.stage}</span>
                        <span className={log.status === "SUCCESS" ? "text-emerald-600" : "text-stone-400"}>
                          {log.status}
                          {log.durationMs != null && ` Â· ${log.durationMs}ms`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </DebugCard>

                <DebugCard title="Artifacts">
                  <ul className="space-y-1 font-mono text-[11px] text-stone-500">
                    {(data?.artifacts ?? []).map((artifact) => (
                      <li key={artifact.id}>{artifact.type}</li>
                    ))}
                  </ul>
                </DebugCard>
              </div>
            )}
          </section>
        )}
      </main>

      {/* â”€â”€ Sticky bottom action bar â€” PDF preview + download â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
          Hidden while in the Building state â€” we don't expose "Pending..." PDF
          status to the patient before they've even seen their video. */}
      {!isWaiting && (
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-stone-200 bg-white/95 backdrop-blur-md shadow-[0_-4px_24px_-12px_rgba(15,23,42,0.12)]">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">Patient PDF report</p>
                <p className="truncate text-xs text-stone-500">
                  {pdfUrl
                    ? "Ready - preview or download"
                    : isGeneratingPdf
                    ? "Generating PDF..."
                    : reportIsReady
                    ? "Ready to generate"
                    : data?.status === "PARTIAL_FAILURE"
                    ? "PDF delayed - clinical report above is available"
                    : "Generating PDF..."}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {pdfUrl ? (
                <>
                  <a
                    href={pdfRoute}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 text-xs font-medium text-slate-700 hover:border-teal-300 hover:text-teal-700"
                  >
                    Preview
                  </a>
                  <a
                    href={pdfDownloadRoute}
                    download={`hair-dossier-${assessmentId}.pdf`}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-xs font-medium text-white hover:bg-slate-800"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </a>
                  {/* Doctor-reviewed one-page summary — separate document from
                      the long-form PDF above. Opens the printable Dr FACT sheet. */}
                  <a
                    href={`/reports/${assessmentId}/one-page${previewToken ? `?t=${encodeURIComponent(previewToken)}` : ""}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                    title="Open the doctor-reviewed one-page patient report"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Patient Report
                  </a>
                </>
              ) : (
                <button
                  type="button"
                  onClick={generateAndDownloadPdf}
                  disabled={isGeneratingPdf || !reportIsReady}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-xs font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-500"
                >
                  <Download className="h-3.5 w-3.5" />
                  {isGeneratingPdf ? "Generating..." : reportIsReady ? "Generate PDF" : "Pending"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ReportPlaceholder({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div className="rounded-3xl border border-stone-200 bg-white p-12 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50">
        <FileText className="h-6 w-6 text-teal-700" />
      </div>
      <h2 className="font-serif text-xl font-semibold text-slate-900">
        Preparing your clinical report
      </h2>
      <p className="mt-2 text-sm text-stone-500">
        The structured report will appear here within a few seconds.
      </p>
      <Button variant="outline" size="sm" className="mt-4" onClick={onRefresh}>
        <RefreshCw className="mr-1 h-4 w-4" />
        Refresh now
      </Button>
    </div>
  );
}

function DebugCard({
  icon,
  title,
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="mb-2 flex items-center gap-2 text-stone-500">
        {icon}
        <h3 className="text-xs font-semibold uppercase tracking-[0.12em]">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function asObject(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}












