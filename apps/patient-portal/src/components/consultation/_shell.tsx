import type { ReactNode } from "react";

// Shared card shell so every presentation primitive looks identical and can be
// re-themed for PDF / mobile by overriding this single file.

export function CardShell({
  title,
  eyebrow,
  action,
  children,
  className = "",
}: {
  title: string;
  eyebrow?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl bg-white border border-stone-200 shadow-sm overflow-hidden ${className}`}
    >
      <header className="px-5 py-4 border-b border-stone-200 flex items-start justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-500">
              {eyebrow}
            </p>
          )}
          <h3 className="font-serif text-lg text-slate-900 truncate">{title}</h3>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "teal" | "sky" | "amber" | "rose" | "slate";
}) {
  const tones: Record<string, string> = {
    neutral: "bg-stone-100 text-stone-700",
    teal: "bg-teal-50 text-teal-700",
    sky: "bg-sky-50 text-sky-700",
    amber: "bg-amber-50 text-amber-700",
    rose: "bg-rose-50 text-rose-700",
    slate: "bg-slate-100 text-slate-700",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function KeyValue({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 border-b border-stone-100 last:border-b-0">
      <span className="text-xs font-medium text-stone-500">{label}</span>
      <span className="text-sm text-slate-800 text-right">{value}</span>
    </div>
  );
}
