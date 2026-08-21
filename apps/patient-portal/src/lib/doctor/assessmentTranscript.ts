// Turning stored questionnaire answers into a clinical transcript.
//
// ── The defect this module exists to fix ────────────────────────────────────
// The doctor review rendered `Object.entries(rawAnswers)` directly. Three
// things were wrong with that, and all three were visible on screen:
//
//   1. ORDER. `rawAnswers` comes back from a Postgres `jsonb` column, and
//      jsonb does not preserve insertion order — it sorts keys by length, then
//      bytewise. So the doctor read the assessment as
//      "age, gut, sex, diet, goal, cause, count, grade, scalp, thyroid,
//      duration, hairtype…" — an ordering with no clinical meaning whatsoever,
//      which no clinician could scan and which changes shape between patients.
//
//   2. LABELS. The key was printed raw. `hairtype`, `count`, `grade` are
//      internal identifiers, not questions. The doctor was left inferring what
//      the patient had actually been asked.
//
//   3. SILENT BLANKS. A multi-select the patient left empty is stored as `[]`,
//      and `[].join(", ")` is the empty string. Eight of eighteen rows rendered
//      as a label with nothing beside it. "Not asked", "asked and denied" and
//      "answered, but the value failed to render" were indistinguishable —
//      on a screen a doctor uses to approve treatment.
//
// The protocol schema already holds the question text, the clinical section
// order, the patient-facing option labels and the visibility rules. This module
// reads answers back through it so the transcript says what was asked, in the
// order it was asked, and states plainly when there is no answer and why.
//
// PRESENTATION ONLY. Nothing here scores, ranks, diagnoses or feeds an engine.
// Answers are never rewritten — only mapped to the label the patient saw and
// cleaned of layout whitespace.

import questionnaireSchema from "@hairos/packages/ai-engine/questionnaire-engine/schema/questionnaire.schema.json";

// ── Why each row has no answer ──────────────────────────────────────────────
//
// These three are deliberately distinct. Collapsing them is the original bug:
// "we never asked this patient" and "we asked and they reported nothing" carry
// opposite clinical weight, and neither is "the value is missing".
export type TranscriptAnswerState =
  | "answered"
  /** Asked, and the patient selected nothing. A negative, not a gap. */
  | "none_reported"
  /** Never shown — a visibility rule excluded it (e.g. hormonal for a male). */
  | "not_applicable"
  /** Shown, and no value was stored. A genuine gap in the record. */
  | "unanswered";

export interface TranscriptRow {
  /** Protocol question id. Stable; used as the React key. */
  id: string;
  /** The question as the patient read it. */
  label: string;
  state: TranscriptAnswerState;
  /** Display-ready selected options. Empty unless `state === "answered"`. */
  values: string[];
  /** Free-text answers (text / textarea) render as prose, not as a chip. */
  freeText: string | null;
  /** Why the question did not apply. Only set for `not_applicable`. */
  notApplicableReason: string | null;
}

export interface TranscriptSection {
  id: string;
  title: string;
  rows: TranscriptRow[];
}

export interface AssessmentTranscript {
  sections: TranscriptSection[];
  /**
   * Answers present in storage that the current protocol does not define.
   *
   * Rendered rather than dropped: a key we cannot explain is still something
   * the patient told the clinic, and silently discarding it would repeat the
   * mistake this module fixes. Older records legitimately land here after a
   * protocol revision.
   */
  additional: TranscriptRow[];
  answered: number;
  /** Questions actually put to this patient — excludes `not_applicable`. */
  asked: number;
}

// ── Schema shapes ───────────────────────────────────────────────────────────
// Narrow local types. The JSON carries far more (scoring signals, clinical
// mappings, source references) and none of it belongs on a doctor's screen.

interface SchemaOption {
  label?: string;
  value?: string;
}

interface SchemaVisibilityRule {
  dependsOn?: string;
  operator?: string;
  value?: unknown;
}

interface SchemaQuestion {
  id: string;
  type?: string;
  label?: string;
  options?: SchemaOption[];
  visibilityRules?: SchemaVisibilityRule[];
}

interface SchemaSection {
  sectionId: string;
  title?: string;
  questions?: SchemaQuestion[];
}

const SECTIONS = (questionnaireSchema as { sections?: SchemaSection[] }).sections ?? [];

/**
 * Keys that are transport, not clinical content.
 *
 * `__meta` carries the locale and the concern the assessment was started
 * under. Real, but not a question the patient answered, so it must not appear
 * in a transcript of their answers.
 */
function isInternalKey(key: string): boolean {
  return key.startsWith("__");
}

/**
 * Strip layout whitespace out of a stored answer.
 *
 * Several option values were authored with hard line breaks so they would wrap
 * correctly in the patient's option card — `"~50–100 strands\n(Noticeable)"`,
 * `"Hair on pillow /\nfloor / shower"`. Those newlines are a fact about a
 * button's width, and rendering them in a clinical transcript makes the answer
 * look truncated or corrupted.
 */
function clean(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Case- and whitespace-insensitive key for matching a stored value. */
function matchKey(text: string): string {
  return clean(text).toLowerCase();
}

/**
 * Per-question map from stored option value to the label the patient read.
 *
 * The two differ by design for several questions: `goal` stores
 * "Reduce hair fall and improve growth" but the patient chose a card reading
 * "Reduce hair fall and improve quality & growth". The doctor should see the
 * patient's words.
 *
 * Built once at module load — the schema is a static import.
 */
const OPTION_LABELS: Map<string, Map<string, string>> = (() => {
  const byQuestion = new Map<string, Map<string, string>>();
  for (const section of SECTIONS) {
    for (const q of section.questions ?? []) {
      const labels = new Map<string, string>();
      for (const opt of q.options ?? []) {
        const label = typeof opt.label === "string" ? clean(opt.label) : null;
        if (!label) continue;
        // Index by BOTH spellings. A record written before an option's label
        // and value diverged stores the label; a current one stores the value.
        if (typeof opt.value === "string") labels.set(matchKey(opt.value), label);
        labels.set(matchKey(label), label);
      }
      if (labels.size > 0) byQuestion.set(q.id, labels);
    }
  }
  return byQuestion;
})();

/** Map one stored value to its patient-facing label, or clean it as-is. */
function displayValue(questionId: string, raw: unknown): string {
  const text = clean(String(raw ?? ""));
  if (!text) return "";
  // Unrecognised values are shown verbatim rather than dropped. Seeded and
  // pre-protocol records hold option text that no longer exists in the schema,
  // and hiding it would tell the doctor the patient answered nothing.
  return OPTION_LABELS.get(questionId)?.get(matchKey(text)) ?? text;
}

/**
 * Evaluate one visibility rule against the stored answers.
 *
 * Conservative by construction: an unknown operator, or a dependency with no
 * stored answer, returns `true`. The cost of guessing wrong runs one way —
 * marking a question "not applicable" when it was in fact asked and left blank
 * hides a real gap in the record, whereas showing it as unanswered merely
 * states that we do not have the answer.
 */
function ruleHolds(rule: SchemaVisibilityRule, answers: Record<string, unknown>): boolean {
  const dependsOn = rule.dependsOn;
  if (!dependsOn) return true;
  if (!(dependsOn in answers)) return true;

  const actual = answers[dependsOn];
  if (actual === null || actual === undefined) return true;

  const expected = matchKey(String(rule.value ?? ""));
  if (!expected) return true;

  const actualValues = (Array.isArray(actual) ? actual : [actual]).map((v) =>
    matchKey(String(v)),
  );

  switch (rule.operator) {
    case "equals":
      return actualValues.some((v) => v === expected);
    case "includes":
      // Substring, deliberately: `medical_detail` depends on `medical`
      // including "Yes", and the stored answer is the full option text
      // "Yes, currently on medication".
      return actualValues.some((v) => v.includes(expected));
    case "notEquals":
      return !actualValues.some((v) => v === expected);
    default:
      return true;
  }
}

/** Human sentence for why a question never reached this patient. */
function notApplicableReason(
  rules: SchemaVisibilityRule[],
  answers: Record<string, unknown>,
): string | null {
  const failed = rules.find((r) => !ruleHolds(r, answers));
  if (!failed?.dependsOn) return null;
  const label = questionLabel(failed.dependsOn) ?? failed.dependsOn;
  return `Not asked — depends on "${label}"`;
}

/** The question text for an id, if the protocol defines one. */
function questionLabel(questionId: string): string | null {
  for (const section of SECTIONS) {
    for (const q of section.questions ?? []) {
      if (q.id === questionId) return q.label ? clean(q.label) : null;
    }
  }
  return null;
}

/** Ids the protocol defines, for separating known answers from stray ones. */
const KNOWN_QUESTION_IDS = new Set<string>(
  SECTIONS.flatMap((s) => (s.questions ?? []).map((q) => q.id)),
);

const FREE_TEXT_TYPES = new Set(["text", "textarea"]);

/**
 * Build the transcript.
 *
 * Every question in the protocol produces exactly one row, in protocol order,
 * whether or not the patient answered it. That is the point: a doctor scanning
 * the transcript is reading the questionnaire, not a filtered projection of it,
 * so a missing answer is visible as a missing answer.
 */
export function buildAssessmentTranscript(
  rawAnswers: Record<string, unknown> | null | undefined,
): AssessmentTranscript {
  const answers = (rawAnswers ?? {}) as Record<string, unknown>;

  let answered = 0;
  let asked = 0;

  const sections: TranscriptSection[] = SECTIONS.map((section) => {
    const rows = (section.questions ?? []).map((q) => {
      const row = buildRow(q, answers);
      if (row.state !== "not_applicable") asked += 1;
      if (row.state === "answered") answered += 1;
      return row;
    });
    return {
      id: section.sectionId,
      title: section.title ? clean(section.title) : section.sectionId,
      rows,
    };
  }).filter((s) => s.rows.length > 0);

  const additional: TranscriptRow[] = Object.keys(answers)
    .filter((key) => !KNOWN_QUESTION_IDS.has(key) && !isInternalKey(key))
    .sort()
    .map((key) => {
      const row = buildRow({ id: key, label: key }, answers);
      if (row.state !== "not_applicable") asked += 1;
      if (row.state === "answered") answered += 1;
      return row;
    });

  return { sections, additional, answered, asked };
}

function buildRow(q: SchemaQuestion, answers: Record<string, unknown>): TranscriptRow {
  const label = q.label ? clean(q.label) : q.id;
  const rules = q.visibilityRules ?? [];

  if (rules.length > 0 && !rules.every((r) => ruleHolds(r, answers))) {
    return {
      id: q.id,
      label,
      state: "not_applicable",
      values: [],
      freeText: null,
      notApplicableReason: notApplicableReason(rules, answers),
    };
  }

  const base = {
    id: q.id,
    label,
    values: [] as string[],
    freeText: null as string | null,
    notApplicableReason: null,
  };

  if (!(q.id in answers)) {
    return { ...base, state: "unanswered" };
  }

  const raw = answers[q.id];

  if (raw === null || raw === undefined) {
    return { ...base, state: "unanswered" };
  }

  if (Array.isArray(raw)) {
    const values = raw
      .map((v) => displayValue(q.id, v))
      .filter((v) => v.length > 0);
    // The empty array is the case that used to render as a blank line. It is
    // an answer — the patient was shown the question and selected nothing.
    return values.length === 0
      ? { ...base, state: "none_reported" }
      : { ...base, state: "answered", values };
  }

  if (typeof raw === "object") {
    // Not expected from the current protocol, but a stored object must still
    // be shown rather than silently dropped.
    let serialised: string;
    try {
      serialised = JSON.stringify(raw);
    } catch {
      serialised = String(raw);
    }
    return { ...base, state: "answered", freeText: serialised };
  }

  const text = clean(String(raw));
  if (!text) return { ...base, state: "none_reported" };

  if (FREE_TEXT_TYPES.has(q.type ?? "")) {
    return { ...base, state: "answered", freeText: text };
  }

  return { ...base, state: "answered", values: [displayValue(q.id, text)] };
}
