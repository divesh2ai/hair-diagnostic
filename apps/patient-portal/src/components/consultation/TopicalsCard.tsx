"use client";

import type { TopicalRecommendation } from "@shared/types/consultation";
import { CardShell } from "./_shell";
import { ProductImage } from "@/components/kits/ProductImage";

// Renders `consultation.treatmentPlan.topicals` verbatim from the canonical
// payload. No recomputation, no client-side ranking — items appear in the
// exact order the engine emitted them. Absent by design when the engine did
// not surface any topicals for this consultation.
//
// ── The packshot ────────────────────────────────────────────────────────────
// Topicals carried no artwork at all while the kits beside them did, so the
// doctor could recognise a wrong carton in the protocol but not a wrong bottle
// in the topical shelf — on the same screen, authorising the same order.
//
// `category="topical"` is passed explicitly and is never inferred from the
// name. The resolver keeps kit and topical registries apart on purpose: an
// oral tablet illustrated with a scalp-solution bottle misrepresents the
// prescription, which is a clinical error rather than a layout one. An
// unresolved product renders a labelled empty frame, never a stand-in.

export function TopicalsCard({
  topicals,
}: {
  topicals: TopicalRecommendation[];
}) {
  if (!topicals || topicals.length === 0) return null;
  return (
    <CardShell eyebrow="Topical care" title="Topical recommendations">
      <ul className="space-y-3">
        {topicals.map((t, i) => (
          <li
            key={`${t.name}-${i}`}
            className="flex gap-3 rounded-xl border border-stone-200 px-3 py-2.5"
          >
            <ProductImage id={t.name} category="topical" size="md" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-900">{t.name}</p>
              {t.usage && (
                <p className="mt-0.5 text-xs text-stone-600 leading-snug">
                  {t.usage}
                </p>
              )}
              {t.note && <p className="mt-1 text-xs text-slate-700">{t.note}</p>}
              {t.whySelected && (
                <p className="mt-1 text-[11px] text-stone-500 italic">
                  {t.whySelected}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </CardShell>
  );
}
