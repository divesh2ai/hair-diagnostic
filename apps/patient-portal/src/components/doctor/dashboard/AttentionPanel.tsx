"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, ChevronRight, Clock, FileQuestion } from "lucide-react";

// NEEDS ATTENTION — operational exceptions, only when they are real.
//
// ── Honesty note ────────────────────────────────────────────────────────────
// The concept lists three exception types. We show only the ones the existing
// data can prove:
//
//   • Reports that could not finish generating  — counts.needsAttention, sent
//     by the stats API only when > 0.
//   • Records that cannot be opened for review   — counts.unopenable, sent by
//     the stats loader only when > 0. These are pending cases the queue
//     withholds because there is no stored questionnaire and no persisted
//     consultation, so the review would refuse to open. Saying so is the
//     alternative to dropping them silently.
//   • Patients waiting longer than 15 minutes    — derived from the loaded
//     queue slice's own timestamps. It is an observed floor (the deck holds the
//     oldest few), so the copy says "in your deck", never a clinic-wide claim.
//
// A "report generation recovered" line has no event source, so it is omitted
// rather than fabricated. When nothing is wrong, the panel says so plainly.

export interface AttentionItem {
  key: string;
  icon: "reports" | "waiting" | "incomplete";
  title: string;
  detail: string;
  href?: string;
  tone: "danger" | "warning";
}

export function AttentionPanel({ items }: { items: AttentionItem[] }) {
  return (
    <section
      aria-labelledby="attention-heading"
      className="flex h-full flex-col rounded-2xl border border-stone-200 bg-white p-5"
    >
      <div className="flex items-center gap-2">
        <h2
          id="attention-heading"
          className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500"
        >
          Needs attention
        </h2>
        {items.length > 0 && (
          <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-red-50 px-1.5 text-[11px] font-semibold tabular-nums text-red-700">
            {items.length}
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
          <CheckCircle2 className="h-5 w-5 text-emerald-500" aria-hidden />
          <p className="text-sm text-stone-500">Everything is running smoothly.</p>
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {items.map((item) => (
            <li key={item.key}>
              <AttentionRow item={item} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AttentionRow({ item }: { item: AttentionItem }) {
  const Icon =
    item.icon === "reports"
      ? AlertTriangle
      : item.icon === "incomplete"
        ? FileQuestion
        : Clock;
  const iconClass =
    item.tone === "danger"
      ? "bg-red-50 text-red-600"
      : "bg-amber-50 text-amber-600";

  const inner = (
    <>
      <span
        className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconClass}`}
        aria-hidden
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-slate-900">{item.title}</span>
        <span className="mt-0.5 block text-xs text-stone-500">{item.detail}</span>
      </span>
      {item.href && (
        <ChevronRight
          className="h-4 w-4 shrink-0 self-center text-stone-300 transition-colors group-hover:text-stone-500"
          aria-hidden
        />
      )}
    </>
  );

  const base =
    "flex items-start gap-3 rounded-xl border border-stone-100 bg-stone-50/50 px-3 py-2.5";

  if (item.href) {
    return (
      <Link
        href={item.href}
        className={`group ${base} transition-colors hover:border-stone-200 hover:bg-stone-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/25`}
      >
        {inner}
      </Link>
    );
  }
  return <div className={base}>{inner}</div>;
}
