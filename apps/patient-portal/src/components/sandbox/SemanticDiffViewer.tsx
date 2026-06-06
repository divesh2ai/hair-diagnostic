"use client";

export interface DiffRow {
  field: string;
  oldValue: string;
  newValue: string;
  hasDifference: boolean;
}

interface Props {
  rows: DiffRow[];
  oldLabel?: string;
  newLabel?: string;
}

export function SemanticDiffViewer({
  rows,
  oldLabel = "Baseline",
  newLabel = "Current pipeline",
}: Props) {
  const changed = rows.filter((r) => r.hasDifference);

  if (changed.length === 0) {
    return (
      <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
        No semantic drift detected.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {changed.map((row) => (
        <div
          key={row.field}
          className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] overflow-hidden"
        >
          <div className="px-4 py-2 border-b border-amber-500/15 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
            {row.field.replace(/_/g, " ")}
          </div>
          <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-amber-500/10">
            <div className="p-4">
              <p className="text-[10px] uppercase tracking-widest text-white/40 mb-2">{oldLabel}</p>
              <p className="text-sm text-rose-200/90 line-through decoration-rose-400/50">
                {row.oldValue || "—"}
              </p>
            </div>
            <div className="p-4">
              <p className="text-[10px] uppercase tracking-widest text-white/40 mb-2">{newLabel}</p>
              <p className="text-sm text-emerald-100 font-medium">{row.newValue || "—"}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
