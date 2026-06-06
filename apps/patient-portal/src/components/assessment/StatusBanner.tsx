"use client";

interface StatusBannerProps {
  status: string;
  progressPercent: number;
  isStuck: boolean;
  stage: string | null;
  retryCount: number;
  onRetry?: () => void;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; border: string; dot: string }
> = {
  PENDING:                    { label: "Pending",                   color: "text-gray-600",   bg: "bg-gray-50",   border: "border-gray-200", dot: "bg-gray-400" },
  QUEUED:                     { label: "Queued",                    color: "text-blue-600",   bg: "bg-blue-50",   border: "border-blue-200", dot: "bg-blue-400" },
  NORMALIZING:                { label: "Normalizing signals",       color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-200", dot: "bg-indigo-400" },
  RUNNING_CLINICAL_ENGINE:    { label: "Running clinical engine",   color: "text-violet-600", bg: "bg-violet-50", border: "border-violet-200", dot: "bg-violet-500" },
  GENERATING_RECOMMENDATIONS: { label: "Generating recommendations",color: "text-sky-600",    bg: "bg-sky-50",    border: "border-sky-200", dot: "bg-sky-500" },
  GENERATING_REPORT:          { label: "Generating report",         color: "text-teal-600",   bg: "bg-teal-50",   border: "border-teal-200", dot: "bg-teal-500" },
  COMPLETED:                  { label: "Completed",                 color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", dot: "bg-emerald-500" },
  PARTIAL_FAILURE:            { label: "Partially completed",       color: "text-amber-700",  bg: "bg-amber-50",  border: "border-amber-200", dot: "bg-amber-500" },
  FAILED:                     { label: "Failed",                    color: "text-rose-700",   bg: "bg-rose-50",   border: "border-rose-200", dot: "bg-rose-500" },
};

const ACTIVE_STATUSES = new Set([
  "QUEUED", "NORMALIZING", "RUNNING_CLINICAL_ENGINE",
  "GENERATING_RECOMMENDATIONS", "GENERATING_REPORT",
]);

export function StatusBanner({
  status,
  progressPercent,
  isStuck,
  stage,
  retryCount,
  onRetry,
}: StatusBannerProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG["PENDING"];
  const isActive = ACTIVE_STATUSES.has(status) && !isStuck;

  const effectiveConfig = isStuck
    ? { ...config, label: "Processing stalled", color: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200", dot: "bg-orange-500" }
    : config;

  return (
    <div className={`rounded-xl border ${effectiveConfig.border} ${effectiveConfig.bg} p-4`}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {/* Animated dot for active states */}
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            {isActive && (
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full ${effectiveConfig.dot} opacity-50`}
              />
            )}
            <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${effectiveConfig.dot}`} />
          </span>

          <div className="min-w-0">
            <p className={`text-sm font-semibold ${effectiveConfig.color}`}>
              {effectiveConfig.label}
              {retryCount > 0 && (
                <span className="ml-2 text-xs font-normal opacity-70">
                  (retry #{retryCount})
                </span>
              )}
            </p>
            {stage && status !== "COMPLETED" && status !== "FAILED" && (
              <p className="text-xs text-gray-500 mt-0.5 truncate">
                Stage: {stage.replace(/_/g, " ").toLowerCase()}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {progressPercent > 0 && (
            <span className={`text-sm font-bold tabular-nums ${effectiveConfig.color}`}>
              {progressPercent}%
            </span>
          )}
          {onRetry && (
            <button
              onClick={onRetry}
              className="px-3 py-1 text-xs font-medium rounded-md bg-rose-600 text-white hover:bg-rose-700 transition-colors"
            >
              Retry
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {progressPercent > 0 && progressPercent < 100 && (
        <div className="mt-3 h-1.5 rounded-full bg-black/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-current transition-all duration-1000 ease-out"
            style={{ width: `${progressPercent}%`, color: effectiveConfig.dot.replace("bg-", "") }}
          >
            <div className={`h-full w-full rounded-full ${effectiveConfig.dot}`} />
          </div>
        </div>
      )}
    </div>
  );
}
