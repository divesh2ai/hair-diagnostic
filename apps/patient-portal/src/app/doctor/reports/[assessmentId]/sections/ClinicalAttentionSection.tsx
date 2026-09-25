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
// ── Hard clinical/safety items ONLY ─────────────────────────────────────────
// This section renders ONLY genuine HARD items — a recorded safety flag
// (contraindication / caution / allergy) or an evidence-integrity failure. The
// soft AI documentation advisories (narrative wording notes, reasoning gaps,
// optional-information suggestions, AI completeness messages) are deliberately
// NOT rendered in the doctor's normal consultation flow: a documentation gap
// must never compete with the treatment plan and Approve for the doctor's
// attention, or read as a clinical error the reviewing doctor made.
//
// Those soft items are not discarded — buildAttentionItems still derives them
// from the persisted clinical-readiness snapshot, so they remain in the
// readiness metadata for auditability. They are simply filtered out of this
// screen.
//
// ── Silence is the default ──────────────────────────────────────────────────
// This section returns null when there are no HARD items. A card reading "No
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
// evidence-integrity failure is rendered as a prominent card.
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

  // HARD ONLY — genuine safety flags and evidence-integrity failures. The
  // doctor must weigh these before approving. Soft AI documentation/
  // completeness advisories are intentionally dropped from this screen (they
  // remain in the readiness metadata for audit — see header).
  const hard = items.filter((i) => i.severity === "hard");

  // Quiet when there is no hard item. See header: a routine case, or one
  // carrying only soft advisories, renders nothing at all here.
  if (hard.length === 0) return null;

  return (
    <section aria-labelledby="attention-heading" className="space-y-3">
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
    </section>
  );
}
