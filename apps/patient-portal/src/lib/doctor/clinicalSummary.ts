// The Clinical Summary view model — one synthesis surface for the doctor.
//
// ── What this module is for ─────────────────────────────────────────────────
// The review page used to open with a questionnaire. A doctor had to read
// twenty question labels, most of them unanswered, and reconstruct the
// clinical picture themselves. This assembles the picture instead: what the
// patient reported, what it was read to mean, and what the objective is — all
// from content the engines have ALREADY authored.
//
// ── The one rule ────────────────────────────────────────────────────────────
// PRESENTATION MAY BE TRANSFORMED. CLINICAL MEANING MAY NOT.
//
// Nothing here decides that a reported factor is a driver. It reads the
// engine's own output. It never promotes "Stress: Often" into "stress is
// causing this"; it renders the selection, and renders the engine's separate
// judgement beside it. Every string returned is either copied from persisted
// output or is a fixed label defined in this file.
//
// ── Where the evidence comes from ───────────────────────────────────────────
// `clinicalReport.patientSummary` — NOT `assessment.rawAnswers`.
//
// That distinction is the whole point. `rawAnswers` is the questionnaire: a
// jsonb map in arbitrary key order holding every question, including the ones
// the patient skipped. `patientSummary` is the engine's own grouping of what
// the patient ACTUALLY SELECTED, already bucketed into clinical categories.
// Reading it means the doctor sees selections, never questions, and an
// unanswered question simply has no representation to render.
//
// The full questionnaire stays reachable behind "View full assessment", which
// renders the transcript from `rawAnswers`. That is the only place raw
// question text belongs.

import type { Consultation } from "@shared/types/consultation";

// ── View model ──────────────────────────────────────────────────────────────

export type EvidenceEmphasis = "normal" | "attention";

export interface EvidenceItem {
  /**
   * Row label, or null when the category itself is the label.
   *
   * Only "Hair & shedding" carries per-row labels, because it merges two
   * genuinely different facts (duration and pattern). The other groups are
   * flat lists within one category, where a repeated "Reported" down the left
   * margin is pure noise — the heading already said what these are.
   */
  label: string | null;
  value: string;
  /** `attention` ONLY when the engine's own interpretation names this signal. */
  emphasis: EvidenceEmphasis;
}

/** Stable identity for a clinical category — drives the accent colour. */
export type EvidenceKey = "HAIR" | "SCALP" | "LIFESTYLE" | "MEDICAL" | "TREATMENTS";

export interface EvidenceGroup {
  /**
   * Identity, not display text.
   *
   * The accent a category is drawn in is keyed off this rather than off the
   * label, so renaming "Medical & metabolic" cannot silently change which
   * colour a doctor has learned to associate with medical findings.
   */
  key: EvidenceKey;
  category: string;
  items: EvidenceItem[];
}

export interface SummaryDriver {
  label: string;
  explanation: string | null;
}

/**
 * One signal the patient reported, and what it means in hair-cycle terms.
 *
 * The SAME content as the "Clinical Summary & Interpretation" page of the
 * patient's own report — signal, the clinical pattern it was matched to, and
 * the explanation. The doctor and the patient must read the same clinical
 * reasoning; a doctor approving a report should have seen what it says.
 */
export interface SignalInterpretation {
  signal: string;
  condition: string;
  interpretation: string;
}

export interface ClinicalSummaryViewModel {
  headline: string | null;
  synthesis: string | null;
  severity: { level: string; label: string; setByDoctor: boolean };
  confidence: { band: string; label: string; rationale: string | null } | null;
  evidence: EvidenceGroup[];
  /**
   * What the LEADING driver does to the follicle.
   *
   * Its label is the headline, so the label is not repeated — but this
   * sentence is not a repeat, and without it a single-driver case renders a
   * "Clinical interpretation" heading above nothing but an objective.
   */
  primaryDriverExplanation: string | null;
  drivers: SummaryDriver[];
  interpretations: SignalInterpretation[];
  clinicalObjective: string | null;
  patientGoals: string[];
  isEmpty: boolean;
}

// ── Fixed presentation labels ───────────────────────────────────────────────

const SEVERITY_LABELS: Record<string, string> = {
  MILD: "Mild",
  MODERATE: "Moderate",
  SEVERE: "Severe",
  UNKNOWN: "Severity not established",
};

const CONFIDENCE_LABELS: Record<string, string> = {
  high: "High confidence",
  moderate: "Moderate confidence",
  low: "Low confidence",
};

const CATEGORY = {
  HAIR: "Hair & shedding",
  SCALP: "Scalp",
  LIFESTYLE: "Lifestyle",
  MEDICAL: "Medical & metabolic",
  TREATMENTS: "Previous treatments",
} as const;

const LABEL = { DURATION: "Duration", PATTERN: "Pattern" } as const;

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Strip layout whitespace from a stored value.
 *
 * Option values were authored with hard line breaks so they wrapped correctly
 * in the patient's option card ("Hair on pillow /\nfloor / shower"). Those
 * newlines describe a button's width, not the clinical fact.
 */
function clean(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function cleanList(values: readonly unknown[] | null | undefined): string[] {
  return (values ?? []).map(clean).filter((v) => v.length > 0);
}

/**
 * Should this selection be visually emphasised?
 *
 * True only when the engine's clinical interpretation names this exact signal.
 * `clinicalInterpretation[].signal` is copied verbatim from the patient's
 * selection, so this is an identity match on the engine's own output — not an
 * inference this module makes. If the engine did not treat a selection as
 * contributing, it renders at normal weight; the UI never invents relevance
 * and never downgrades something the engine did flag.
 */
function makeEmphasiser(consultation: Consultation): (value: string) => EvidenceEmphasis {
  const flagged = new Set(
    (consultation.clinicalReport?.patientSummary?.clinicalInterpretation ?? [])
      .map((entry) => clean(entry?.signal).toLowerCase())
      .filter((s) => s.length > 0),
  );
  return (value: string) =>
    flagged.has(clean(value).toLowerCase()) ? "attention" : "normal";
}

/** Build one group, or null when the patient selected nothing in it. */
function group(
  key: EvidenceKey,
  category: string,
  values: string[],
  emphasise: (v: string) => EvidenceEmphasis,
): EvidenceGroup | null {
  if (values.length === 0) return null;
  return {
    key,
    category,
    items: values.map((value) => ({ label: null, value, emphasis: emphasise(value) })),
  };
}

// ── Builder ─────────────────────────────────────────────────────────────────

export function buildClinicalSummary(
  consultation: Consultation,
): ClinicalSummaryViewModel {
  const summary = consultation.clinicalReport?.patientSummary;
  const story = consultation.patientEducation?.story;
  const assessment = consultation.clinicalReport?.finalClinicalAssessment;
  const emphasise = makeEmphasiser(consultation);

  // ── Evidence ──────────────────────────────────────────────────────────────
  // Hair & shedding merges duration and pattern because a doctor reads them as
  // one statement. Every other category passes the engine's own bucket
  // through. Order is clinical: presentation, then site, then context.
  const duration = clean(summary?.hairLossDuration);
  const hairItems: EvidenceItem[] = [];
  if (duration) {
    hairItems.push({ label: LABEL.DURATION, value: duration, emphasis: emphasise(duration) });
  }
  for (const pattern of cleanList(summary?.hairLossPattern)) {
    hairItems.push({ label: LABEL.PATTERN, value: pattern, emphasis: emphasise(pattern) });
  }

  const evidence = [
    hairItems.length > 0
      ? { key: "HAIR" as const, category: CATEGORY.HAIR, items: hairItems }
      : null,
    group("SCALP", CATEGORY.SCALP, cleanList(summary?.scalpConcerns), emphasise),
    group("LIFESTYLE", CATEGORY.LIFESTYLE, cleanList(summary?.lifestyleFactors), emphasise),
    group("MEDICAL", CATEGORY.MEDICAL, cleanList(summary?.medicalFactors), emphasise),
    group("TREATMENTS", CATEGORY.TREATMENTS, cleanList(summary?.previousTreatments), emphasise),
  ].filter((g): g is EvidenceGroup => g !== null);

  // ── Drivers ───────────────────────────────────────────────────────────────
  // The engine orders these by internal tier, so the first is the leading
  // driver. It becomes the headline; the rest are the contributing list.
  const allDrivers: SummaryDriver[] = (story?.drivers ?? [])
    .map((d) => ({ label: clean(d?.label), explanation: clean(d?.hairImpact) || null }))
    .filter((d) => d.label.length > 0);

  // ── Headline ──────────────────────────────────────────────────────────────
  // Three candidates were rejected, and each rejection matters:
  //
  //   `diagnosis.primary`   — an engine ROUTING label. This record carries
  //                           primaryKey "DIABETES" rendered as "Metabolic —
  //                           polygenic drivers". Not a clinical statement.
  //   `story.yourHairStory` — the patient-voice opener, ~150 words addressed
  //                           to "you". As a headline it filled the hero with
  //                           a paragraph written for the wrong reader.
  //   any composed sentence — inventing "Mild lifestyle-associated concern"
  //                           here would be the UI authoring a conclusion.
  //
  // The leading driver label is authored, clinician-readable, one line, and is
  // already the engine's own statement of what is driving the case.
  const headline = allDrivers[0]?.label ?? null;

  // Its label is the headline, so the label is not repeated — but the
  // explanation is not a repeat, and dropping the whole driver emptied this
  // panel on every single-driver case.
  const primaryDriverExplanation = allDrivers[0]?.explanation ?? null;
  const drivers = allDrivers.slice(1);

  // Dermatologist-voice assessment; the patient-voice field is the fallback
  // for records composed before finalClinicalAssessment existed.
  const synthesis =
    clean(assessment?.scene1) || clean(story?.whyThisMayBeHappening) || null;

  // ── Signal to clinical pattern ────────────────────────────────────────────
  // Copied through verbatim. These are the same strings the patient's report
  // prints on its "Clinical Summary & Interpretation" page — nothing reworded,
  // reordered or filtered, because a doctor approving that report needs to
  // read what it will tell the patient.
  const interpretations: SignalInterpretation[] = (
    summary?.clinicalInterpretation ?? []
  )
    .map((entry) => ({
      signal: clean(entry?.signal),
      condition: clean(entry?.condition),
      interpretation: clean(entry?.interpretation),
    }))
    .filter((e) => e.signal.length > 0 && e.interpretation.length > 0);

  // The engine deduplicates treatment goals across drivers already; joining
  // them is presentation, and the strings themselves are untouched.
  const goals = cleanList(story?.treatmentGoals);
  const clinicalObjective = goals.length > 0 ? goals.join(" · ") : null;

  const severityLevel = consultation.diagnosis?.severity ?? "UNKNOWN";
  const confidenceBand = clean(consultation.confidence?.overall?.band).toLowerCase();

  return {
    headline,
    synthesis,
    severity: {
      level: severityLevel,
      label: SEVERITY_LABELS[severityLevel] ?? SEVERITY_LABELS.UNKNOWN,
      setByDoctor: consultation.diagnosis?.severitySource === "doctor_override",
    },
    confidence: confidenceBand
      ? {
          band: confidenceBand,
          label: CONFIDENCE_LABELS[confidenceBand] ?? confidenceBand,
          rationale: clean(consultation.confidence?.overall?.rationale) || null,
        }
      : null,
    evidence,
    primaryDriverExplanation,
    drivers,
    interpretations,
    clinicalObjective,
    patientGoals: cleanList(summary?.goal),
    isEmpty:
      evidence.length === 0 &&
      interpretations.length === 0 &&
      allDrivers.length === 0 &&
      !synthesis,
  };
}
