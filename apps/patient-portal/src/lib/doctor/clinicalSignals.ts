// Merge model for the review's "Signals & what they mean" band.
//
// Pure and dependency-free so it can be unit-tested without React. The component
// only renders what this returns.
//
// ── The join, and why it is a string join ───────────────────────────────────
// A signal's interpretation must be shown next to the selection that produced
// it. The only thing linking the two in the persisted contract is the signal
// TEXT: `ClinicalInterpretation` carries `{ signal, condition?, interpretation }`
// with no id, and the evidence groups are built from plain `string[]`
// (patientSummary.hairLossPattern, scalpConcerns, …) with no id either. There is
// no stable key to join on without changing the clinical engine, so the join is
// on normalized text — and the engine already guarantees the match is real:
// `clinicalInterpretation[].signal` is copied VERBATIM from the patient's
// selection (see report-engine, and lib/doctor/clinicalSummary.makeEmphasiser,
// which relies on the same identity).
//
// ── Orphans fail visibly, never silently ────────────────────────────────────
// An interpretation whose signal matches no reported selection is NOT dropped
// and NOT guessed into a clinical category. It is surfaced in an explicit
// "Additional clinical signals" group so a doctor still sees every finding the
// engine flagged, and a broken/renamed signal string shows up as a visible
// orphan rather than a disappearance. No clinical meaning is invented here —
// grouping is presentation only.

import type {
  ClinicalSummaryViewModel,
  EvidenceKey,
} from "@/lib/doctor/clinicalSummary";

/** Category keys, plus the explicit bucket for unmatched interpretations. */
export type MergedGroupKey = EvidenceKey | "OTHER";

export interface MergedSignal {
  id: string;
  /** The patient's selection / the signal text. */
  value: string;
  /** "Duration" / "Pattern" for the hair group; null elsewhere. */
  label: string | null;
  /** The clinical pattern the engine mapped this signal to. */
  condition: string | null;
  /** What that pattern means for the follicle. */
  interpretation: string | null;
  /** True when an interpretation was joined to this signal. */
  interpreted: boolean;
  /** True when this row is an interpretation with no reported selection. */
  orphan: boolean;
}

export interface MergedGroup {
  key: MergedGroupKey;
  category: string;
  signals: MergedSignal[];
}

export const ORPHAN_KEY: MergedGroupKey = "OTHER";
const ORPHAN_LABEL = "Additional clinical signals";

const CATEGORY_LABEL: Record<EvidenceKey, string> = {
  HAIR: "Hair & shedding",
  SCALP: "Scalp",
  LIFESTYLE: "Lifestyle",
  MEDICAL: "Medical & metabolic",
  TREATMENTS: "Previous treatments",
};

// Clinical reading order: presentation, site, context, history, then anything
// the engine flagged that the patient did not directly select.
const GROUP_ORDER: MergedGroupKey[] = [
  "HAIR",
  "SCALP",
  "LIFESTYLE",
  "MEDICAL",
  "TREATMENTS",
  "OTHER",
];

/**
 * Normalize a signal string for the join: lower-case, collapse internal
 * whitespace, and strip surrounding punctuation so a trailing period or stray
 * bullet can't turn a real match into a false orphan. Unicode-aware so
 * non-ASCII option labels are handled.
 */
export function normalizeSignal(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

/**
 * Join reported selections to their interpretations into one grouped list.
 * Evidence drives order and preserves labels; unmatched interpretations are
 * appended to the explicit OTHER group so nothing the engine flagged is lost.
 */
export function buildMergedGroups(vm: ClinicalSummaryViewModel): MergedGroup[] {
  const interpByNorm = new Map<
    string,
    { condition: string; interpretation: string }
  >();
  for (const it of vm.interpretations) {
    const key = normalizeSignal(it.signal);
    if (key) {
      interpByNorm.set(key, {
        condition: it.condition,
        interpretation: it.interpretation,
      });
    }
  }

  const consumed = new Set<string>();
  const groups = new Map<MergedGroupKey, MergedGroup>();
  const ensure = (key: MergedGroupKey, category: string): MergedGroup => {
    let g = groups.get(key);
    if (!g) {
      g = { key, category, signals: [] };
      groups.set(key, g);
    }
    return g;
  };

  for (const g of vm.evidence) {
    const group = ensure(g.key, g.category);
    for (const item of g.items) {
      const n = normalizeSignal(item.value);
      const interp = n ? interpByNorm.get(n) ?? null : null;
      if (interp) consumed.add(n);
      group.signals.push({
        id: `${g.key}:${group.signals.length}:${item.value}`,
        value: item.value,
        label: item.label,
        condition: interp?.condition || null,
        interpretation: interp?.interpretation || null,
        interpreted: !!interp,
        orphan: false,
      });
    }
  }

  for (const it of vm.interpretations) {
    const n = normalizeSignal(it.signal);
    if (!n || consumed.has(n)) continue;
    consumed.add(n);
    const group = ensure(ORPHAN_KEY, ORPHAN_LABEL);
    group.signals.push({
      id: `orphan:${group.signals.length}:${it.signal}`,
      value: it.signal,
      label: null,
      condition: it.condition || null,
      interpretation: it.interpretation || null,
      interpreted: true,
      orphan: true,
    });
  }

  return GROUP_ORDER.filter((k) => groups.has(k)).map((k) => groups.get(k)!);
}
