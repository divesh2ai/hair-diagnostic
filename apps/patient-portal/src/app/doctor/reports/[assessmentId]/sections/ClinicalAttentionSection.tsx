"use client";

import { AlertTriangle, Info, GitCompareArrows } from "lucide-react";
import type { Consultation } from "@shared/types/consultation";
import type { ConsultationMeta } from "@/lib/consultation/meta";
import {
  buildAttentionItems,
  type AttentionClass,
  type SafetyFlag,
} from "@/lib/doctor/clinicalAttention";

// WHAT NEEDS ATTENTION? — and nothing at all when the answer is "nothing".
//
// ── Silence is the default ──────────────────────────────────────────────────
// This section returns null when there is nothing to say. A card reading "No
// issues detected" on every routine case is worse than absent: it trains the
// doctor to skip the region, so the one case that does carry a warning gets
// skipped too. It also must never claim "no red flags" — the pathway
// classifier that would produce that judgement is disabled, and asserting an
// all-clear we did not compute is the most dangerous thing this page could do.
//
// ── Three classes, deliberately distinct ────────────────────────────────────
// NEEDS ATTENTION       something clinical the doctor should weigh
// CLINICAL CONTRADICTION the record disagrees with itself
// DATA LIMITATION       we are missing input, not making a clinical claim
//
// A data limitation is not a red flag, and rendering it in red would make
// every legacy record look like an emergency. Red is reserved.
//
// ── No implementation language ──────────────────────────────────────────────
// "LEGACY_DEGRADED" and "rawResponses" never reach the screen. The doctor is
// told which part of the record they can rely on.

// Labels are deliberately non-accusatory. Only a genuine safety flag or an
// evidence-integrity failure (a grounding violation) is rendered as a prominent
// card; everything else is an AI documentation note collapsed below.
const CLASS_META: Record<
  AttentionClass,
  { label: string; box: string; icon: typeof AlertTriangle }
> = {
  attention: {
    label: "Needs attention",
    box: "border-amber-200 bg-amber-50/70 text-amber-950",
    icon: AlertTriangle,
  },
  contradiction: {
    label: "Recommendation review",
    box: "border-red-200 bg-red-50/70 text-red-950",
    icon: GitCompareArrows,
  },
  limitation: {
    label: "Additional information",
    box: "border-stone-200 bg-stone-50 text-slate-800",
    icon: Info,
  },
};

export interface ClinicalAttentionSectionProps {
  confidence: Consultation["confidence"];
  readiness: ConsultationMeta["clinicalReadiness"] | null;
  degradedReasons: string[];
  /** Contraindications, cautions and allergy flags. Rendered first. */
  safety?: SafetyFlag[];
}

export function ClinicalAttentionSection({
  confidence,
  readiness,
  degradedReasons,
  safety,
}: ClinicalAttentionSectionProps) {
  const items = buildAttentionItems({
    confidence,
    readiness,
    degradedReasons,
    safety,
  });

  // Quiet when there is nothing to say. See header.
  if (items.length === 0) return null;

  // HARD — genuine safety flags and evidence-integrity failures. These stay
  // prominent; the doctor must weigh them before approving.
  // SOFT — AI documentation/completeness advisories. These are gathered into
  // ONE compact, collapsed "AI Review Notes" so a thin narrative never looks
  // like a clinical error the reviewing doctor made, and never competes with
  // the treatment plan and Approve for attention.
  const hard = items.filter((i) => i.severity === "hard");
  const soft = items.filter((i) => i.severity === "soft");

  return (
    <section aria-labelledby="attention-heading" className="space-y-3">
      {hard.length > 0 && (
        <>
          <h2 id="attention-heading" className="hd-story-title">
            Clinical attention
          </h2>
          <ul className="space-y-2.5">
            {hard.map((item, i) => {
              const meta = CLASS_META[item.kind];
              const Icon = meta.icon;
              return (
                <li key={`${item.kind}-${i}`} className={`rounded-xl border p-3.5 ${meta.box}`}>
                  <div className="flex items-start gap-2.5">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 opacity-70" aria-hidden />
                    <div className="min-w-0">
                      {/* The class is stated in words as well as colour — the
                          meaning cannot depend on hue alone. */}
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-70">
                        {meta.label}
                      </p>
                      <p className="mt-0.5 text-sm font-medium">{item.title}</p>
                      {item.detail && (
                        <p className="mt-0.5 text-sm leading-relaxed opacity-90">{item.detail}</p>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {soft.length > 0 && (
        // Compact, collapsed, quiet. A native <details> — no client state, and
        // it reads correctly on the server render. Closed by default so the
        // routine case shows a single unobtrusive line.
        <details className="group rounded-xl border border-stone-200 bg-stone-50/60">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-3.5 py-2.5 text-sm text-slate-700 [&::-webkit-details-marker]:hidden">
            <Info className="h-4 w-4 shrink-0 text-stone-400" aria-hidden />
            <span className="font-medium">AI Review Notes · {soft.length}</span>
            <span className="min-w-0 flex-1 truncate text-stone-500">
              {soft[0].detail || soft[0].title}
            </span>
            <span className="shrink-0 text-xs font-medium text-stone-500 group-open:hidden">
              View details
            </span>
            <span className="hidden shrink-0 text-xs font-medium text-stone-500 group-open:inline">
              Hide
            </span>
          </summary>
          <ul className="space-y-2 border-t border-stone-200 px-3.5 py-3">
            {soft.map((item, i) => (
              <li key={`soft-${item.kind}-${i}`} className="text-sm text-slate-700">
                <span className="font-medium">{item.title}</span>
                {item.detail && (
                  <span className="text-stone-500"> — {item.detail}</span>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
