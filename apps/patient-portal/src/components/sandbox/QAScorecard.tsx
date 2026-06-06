"use client";

export interface ScorecardItem {
  label: string;
  status: "PASS" | "WARNING" | "FAIL" | "SKIP";
  detail?: string;
}

const styles: Record<ScorecardItem["status"], string> = {
  PASS: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  WARNING: "bg-amber-500/15 text-amber-200 border-amber-500/25",
  FAIL: "bg-rose-500/15 text-rose-200 border-rose-500/25",
  SKIP: "bg-white/5 text-white/40 border-white/10",
};

export function QAScorecard({ items }: { items: ScorecardItem[] }) {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div
          key={item.label}
          className={`flex items-center justify-between rounded-lg border px-4 py-3 ${styles[item.status]}`}
        >
          <div>
            <p className="text-sm font-medium">{item.label}</p>
            {item.detail && (
              <p className="text-xs opacity-70 mt-0.5 max-w-md truncate">{item.detail}</p>
            )}
          </div>
          <span className="text-xs font-bold tracking-wide">{item.status}</span>
        </div>
      ))}
    </div>
  );
}
