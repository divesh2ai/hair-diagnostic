"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, CheckCircle2, AlertCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { parseAssessmentStatusResponse } from "@/lib/adapters/assessmentAdapter";
import { safeArray } from "@/lib/safeData";

export interface OrchestrationStage {
  stage: string;
  status: string;
  durationMs?: number | null;
}

// Canonical ordered pipeline stages — matches orchestration log stage names exactly.
// Do NOT add AssessmentStatus values here; they are not stage identifiers.
const PIPELINE_STEPS = [
  "normalize",
  "clinical",
  "therapy",
  "recommendations",
  "narratives",
  "visual",
  "pdf",
  "complete",
] as const;

type PipelineStep = (typeof PIPELINE_STEPS)[number];

const STEP_LABELS: Record<PipelineStep, string> = {
  normalize:       "Normalizing clinical signals",
  clinical:        "Detecting clinical profile",
  therapy:         "Mapping therapy needs",
  recommendations: "Building recommendations",
  narratives:      "Generating narratives",
  visual:          "Creating visual journey",
  pdf:             "Rendering your report",
  complete:        "Complete",
};

// Cinematic messages shown during processing, cycling per stage
const CINEMATIC_MESSAGES: Record<string, string[]> = {
  normalize: [
    "Reading your hair biology signals…",
    "Mapping questionnaire responses to clinical markers…",
    "Calibrating follicular stress indicators…",
  ],
  questionnaire: [
    "Interpreting your intake profile…",
    "Tagging clinical relevance of each response…",
    "Cross-referencing lifestyle and medical factors…",
  ],
  clinical: [
    "Analyzing follicular degeneration patterns…",
    "Detecting inflammatory scalp markers…",
    "Computing androgenetic susceptibility index…",
    "Profiling telogen-effluvium risk vectors…",
    "Identifying hormonal interference signatures…",
  ],
  therapy: [
    "Mapping therapy pathways for your phenotype…",
    "Prioritising micronutrient repletion targets…",
    "Calculating regenerative protocol fit…",
    "Aligning treatment phases to severity grade…",
  ],
  recommendations: [
    "Building your regenerative recovery pathway…",
    "Scoring clinical kit match coefficients…",
    "Applying Dr FACT clinical rule engine…",
    "Filtering contraindicated formulations…",
    "Ranking protocols by signal confidence…",
  ],
  narratives: [
    "Generating doctor-grade trichology report…",
    "Composing personalised patient narrative…",
    "Translating clinical findings to plain language…",
    "Crafting root-cause explanation…",
  ],
  visual: [
    "Building your visual treatment journey…",
    "Rendering phase progression graphics…",
  ],
  pdf: [
    "Compiling your clinical PDF report…",
    "Embedding protocol recommendations…",
    "Finalising doctor summary pages…",
  ],
  complete: ["Your report is ready."],
};

interface Props {
  assessmentId: string;
  clinicSlug: string;
  onComplete?: () => void;
}

export function OrchestrationProgress({ assessmentId, clinicSlug, onComplete }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<string>("PROCESSING");
  const [stage, setStage] = useState<string>("normalize");
  const [logs, setLogs] = useState<OrchestrationStage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState(0);
  const [cinematicIdx, setCinematicIdx] = useState(0);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/assessment/status?id=${assessmentId}`);
      if (!res.ok) throw new Error("Status unavailable");
      const data = parseAssessmentStatusResponse(await res.json());

      // New status endpoint shape: { success, status, orchestration.stage, orchestration.logs }
      const status = data.status ?? "PENDING";
      setStatus(status);

      // Derive active stage from orchestration log events — never from lowercased status strings,
      // which are DB enum values and do not match log stage names.
      const orchestrationLogs = safeArray<{ stage: string; status: string; durationMs?: number | null }>(
        data.orchestration?.logs
      ).map((l) => ({ stage: l.stage, status: l.status, durationMs: l.durationMs }));
      setLogs(orchestrationLogs);

      const lastRunning = [...orchestrationLogs].reverse().find((l) => l.status === "RUNNING");
      const lastSuccess = [...orchestrationLogs].reverse().find((l) => l.status === "SUCCESS");
      setStage(lastRunning?.stage ?? lastSuccess?.stage ?? "normalize");
      if (status === "COMPLETED" || status === "PARTIAL_FAILURE") {
        onComplete?.();
      }
      if (status === "FAILED") {
        setError(data.errors?.[0] ?? "Processing failed");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection error");
    }
  }, [assessmentId, onComplete]);

  useEffect(() => {
    poll();
    const id = setInterval(() => {
      setPollCount((c) => c + 1);
      poll();
    }, 2000);
    return () => clearInterval(id);
  }, [poll]);

  // Cycle cinematic messages every 2.5s per active stage
  const ACTIVE_STATUSES = ["QUEUED", "NORMALIZING", "RUNNING_CLINICAL_ENGINE", "GENERATING_RECOMMENDATIONS", "GENERATING_REPORT"];
  useEffect(() => {
    if (ACTIVE_STATUSES.includes(status)) {
      setCinematicIdx(0);
      const id = setInterval(() => {
        setCinematicIdx((prev) => {
          const msgs = CINEMATIC_MESSAGES[stage] ?? [];
          return msgs.length > 0 ? (prev + 1) % msgs.length : 0;
        });
      }, 2500);
      return () => clearInterval(id);
    }
  }, [stage, status]);

  const retry = async () => {
    setError(null);
    await fetch("/api/assessment/orchestrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assessmentId }),
    });
    poll();
  };

  const isDone = status === "COMPLETED" || status === "PARTIAL_FAILURE";
  const isFailed = status === "FAILED" || !!error;

  useEffect(() => {
    if (!isDone) return;
    const id = window.setTimeout(() => {
      router.push(`/q/${clinicSlug}/preview/${assessmentId}`);
    }, 1200);
    return () => window.clearTimeout(id);
  }, [assessmentId, clinicSlug, isDone, router]);

  return (
    <div className="min-h-screen bg-[#0a0f14] text-white flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center mb-10"
        >
          <div className="mx-auto mb-6 relative h-20 w-20">
            {!isDone && !isFailed && (
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-sky-500/30"
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              />
            )}
            <div className="absolute inset-2 rounded-full bg-sky-500/10 flex items-center justify-center">
              {isDone ? (
                <CheckCircle2 className="h-10 w-10 text-emerald-400" />
              ) : isFailed ? (
                <AlertCircle className="h-10 w-10 text-rose-400" />
              ) : (
                <Loader2 className="h-10 w-10 text-sky-400 animate-spin" />
              )}
            </div>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {isDone ? "Your report is ready" : isFailed ? "Something went wrong" : "Analyzing your profile"}
          </h1>
          <p className="mt-2 text-sm text-white/50">
            {STEP_LABELS[stage as PipelineStep] ?? stage}
          </p>
          {!isDone && !isFailed && (
            <AnimatePresence mode="wait">
              <motion.p
                key={`${stage}-${cinematicIdx}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className="mt-3 text-xs text-sky-400/70 min-h-[1rem]"
              >
                {(CINEMATIC_MESSAGES[stage] ?? [])[cinematicIdx] ?? ""}
              </motion.p>
            </AnimatePresence>
          )}
        </motion.div>

        <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <AnimatePresence mode="popLayout">
            {PIPELINE_STEPS.map((key) => {
              const log = logs.find((l) => l.stage === key);
              const done = log?.status === "SUCCESS" || (isDone && key === "complete");
              const running = stage === key && !isDone && !isFailed;
              const failed = log?.status === "FAILED";
              if (key === "complete" && !isDone) return null;
              return (
                <motion.div
                  key={key}
                  layout
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-3 py-2 text-sm"
                >
                  {done ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  ) : running ? (
                    <Loader2 className="h-4 w-4 text-sky-400 animate-spin shrink-0" />
                  ) : failed ? (
                    <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
                  ) : (
                    <div className="h-4 w-4 rounded-full border border-white/20 shrink-0" />
                  )}
                  <span className={done ? "text-white/80" : running ? "text-white" : "text-white/35"}>
                    {STEP_LABELS[key]}
                  </span>
                  {log?.durationMs != null && (
                    <span className="ml-auto text-xs text-white/25">{log.durationMs}ms</span>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {isDone && (
          <Button
            className="w-full mt-8 rounded-full bg-white text-[#0a0f14] hover:bg-sky-50"
            onClick={() => (window.location.href = `/q/${clinicSlug}/preview/${assessmentId}`)}
          >
            View your report
          </Button>
        )}

        {isFailed && (
          <div className="mt-6 flex flex-col gap-3">
            <p className="text-sm text-rose-300/80 text-center">{error}</p>
            <Button variant="outline" className="w-full rounded-full border-white/20" onClick={retry}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Retry orchestration
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
