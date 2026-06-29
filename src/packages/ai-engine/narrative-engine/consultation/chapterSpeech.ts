import {
  getUnderstandingProblemSpeech,
  getWhyFolliclesWeakenedSpeech,
  getWhatTriggeredSheddingSpeech,
  getHowTherapiesWorkSpeech,
  getHowKitsHelpSpeech,
  getRecoveryExpectationsSpeech,
  getComplianceSpeech,
} from '../formatters/formatAvatarSpeech';
import { ROOT_CAUSE_LABELS } from '../constants';
import { joinWithAnd } from '../utils';
import type { ClinicalProfile } from '../../clinical-engine/types';
import type { RootCause, Severity } from '../../../types';

// ─── Chapter speech composers ─────────────────────────────────────────────────
//
// These functions consolidate the existing 7-scene speech helpers into the
// 5-chapter consultation structure WITHOUT rewriting any of the underlying
// content. Each composer takes the same primitive inputs the original scene
// builders took, and concatenates their output with natural connectors.
//
// Chapter 3 (biology / "inside your body") is the only chapter that needs new
// copy — the legacy avatar script had no biology scene. It is derived from
// the clinical profile's root causes via the BIOLOGY_LINES map below.
// ─────────────────────────────────────────────────────────────────────────────

/** Joins two narrations with a natural breath; trims trailing space. */
function join(...parts: readonly string[]): string {
  return parts.map(p => p.trim()).filter(Boolean).join(' ');
}

// ── Chapter 1 — What is happening to my hair? ────────────────────────────────
export function composeChapter1Narration(
  patientName: string,
  diagnosisLabel: string,
  severity: Severity,
): string {
  return getUnderstandingProblemSpeech(diagnosisLabel, severity, patientName);
}

// ── Chapter 2 — Why is this happening? ───────────────────────────────────────
// Collapses the legacy `why-follicles-weakened` + `what-triggered-shedding`
// scenes into one flowing explanation.
export function composeChapter2Narration(
  rootCauseLabels: readonly string[],
  hasActiveShedding: boolean,
): string {
  return join(
    getWhyFolliclesWeakenedSpeech(rootCauseLabels),
    getWhatTriggeredSheddingSpeech(rootCauseLabels, hasActiveShedding),
  );
}

// ── Chapter 3 — What is happening inside my body? (NEW) ──────────────────────
// Per-root-cause biology line. Plain-English, no jargon dump. Picks the top
// three causes from the profile so the chapter stays focused.
const BIOLOGY_LINES: Record<RootCause, string> = {
  STRESS: 'a stress response that pushes a large group of follicles into the resting phase at the same time, leading to diffuse shedding a few months later',
  DHT: 'a heightened follicle sensitivity to DHT — a hormone that gradually shrinks susceptible follicles cycle by cycle',
  GENETICS: 'an inherited follicle sensitivity that lowers the threshold at which DHT and other hormones start to miniaturise the hair shaft',
  IRON_DEFICIENCY: 'low iron stores, which starve the rapidly dividing cells at the base of the follicle of the oxygen and ferritin they need to build a strong shaft',
  HYPOTHYROID: 'an underactive thyroid, which slows the entire hair growth cycle and produces thinner, weaker shafts across the scalp',
  HYPERTHYROID: 'an overactive thyroid, which accelerates the cycle and pushes too many follicles into the shedding phase at once',
  PCOS: 'PCOS-driven androgen excess, which raises DHT exposure at the follicle and shortens each growth phase',
  METABOLIC: 'metabolic dysregulation — insulin resistance and inflammation — that disrupts the energy supply and signalling around the follicle',
  POOR_NUTRITION: 'a nutritional gap that starves the follicle of the raw materials — protein, iron, B-vitamins, zinc — it needs to build the hair shaft',
  POST_PARTUM: 'a postpartum hormonal shift that briefly synchronises follicles into the resting phase, producing a heavier shed roughly three months on',
  GUT_MALABSORPTION: 'compromised gut absorption, so even with a good diet the follicle does not actually receive the nutrients it depends on',
  OXIDATIVE_STRESS: 'oxidative stress at the follicle, damaging the stem cells responsible for producing each new hair',
  MEDICATION: 'a medication-driven disruption of the normal hair cycle, which typically resolves once the trigger is removed or compensated for',
  ILLNESS: 'a recent illness or systemic stress event, which can push a synchronised group of follicles into shedding a few months later',
  RAPID_WEIGHT_LOSS: 'rapid weight loss that deprived the follicle of energy and protein, pausing growth across the scalp',
  AUTOIMMUNE: 'an autoimmune response in which the immune system mistakenly targets the hair follicle and interrupts growth',
  CIRCADIAN_DISRUPTION: 'circadian disruption — disturbed sleep and shift work — that throws off the hormonal rhythms governing the follicle cycle',
  TRICHOTILLOMANIA: 'a behavioural pulling pattern that mechanically interrupts growth and inflames the follicle over time',
  HORMONAL_SHIFT: 'a hormonal shift that disrupts the chemical signals telling your follicles when to grow and when to rest',
} as const;

export function composeChapter3Narration(
  rootCauses: readonly RootCause[],
  profile: ClinicalProfile,
): string {
  if (rootCauses.length === 0) {
    return 'Let me show you what is happening inside your body. The hair follicle is one of the most metabolically active structures in the human body. Whenever its supply chain — hormones, blood flow, nutrients, or immune signals — is disrupted, the growth phase shortens and the follicle produces a thinner, weaker shaft. Your protocol is built to restore each of those inputs.';
  }

  const topThree = rootCauses.slice(0, 3);
  const causeBiology = topThree
    .map((cause, i) => {
      const line = BIOLOGY_LINES[cause];
      if (i === 0) return `At the follicle level, what your assessment points to is ${line}.`;
      if (i === topThree.length - 1) return `And alongside that, ${line}.`;
      return `Layered on top is ${line}.`;
    })
    .join(' ');

  const closing = profile.flags.hasActiveShedding
    ? 'The good news is that each of these mechanisms is biologically reversible when the right inputs are restored. That is exactly what your protocol does.'
    : 'Each of these processes is biologically reversible when the underlying input is restored — which is exactly what your protocol is designed to do.';

  return join(
    'Let me show you what is actually happening inside your body.',
    causeBiology,
    closing,
  );
}

// ── Chapter 4 — Can my hair recover? ─────────────────────────────────────────
export function composeChapter4Narration(
  typicalOutcome: string,
  recoveryWindow: string,
  severity: Severity,
): string {
  return getRecoveryExpectationsSpeech(typicalOutcome, recoveryWindow, severity);
}

// ── Chapter 5 — What should I do next? ───────────────────────────────────────
// Collapses the legacy `how-therapies-work` + `how-kits-support` +
// `compliance-motivation` scenes into one closing instruction.
export function composeChapter5Narration(args: {
  patientName: string;
  therapyLabels: readonly string[];
  primaryKitName: string | null;
  primaryKitPurpose: string | null;
  primaryKitTimeline: string | null;
}): string {
  const { patientName, therapyLabels, primaryKitName, primaryKitPurpose, primaryKitTimeline } = args;

  const therapiesPart = getHowTherapiesWorkSpeech(therapyLabels);
  const kitsPart = primaryKitName && primaryKitPurpose && primaryKitTimeline
    ? getHowKitsHelpSpeech(primaryKitName, primaryKitPurpose, primaryKitTimeline)
    : '';
  const compliancePart = getComplianceSpeech(patientName);

  return join(therapiesPart, kitsPart, compliancePart);
}

// ── Helpers also used by the builder ────────────────────────────────────────
export function rootCauseLabelsFromProfile(profile: ClinicalProfile): readonly string[] {
  return profile.rootCauses.map(rc => ROOT_CAUSE_LABELS[rc]);
}

export function topRootCauseLabelSentence(profile: ClinicalProfile): string {
  return joinWithAnd(rootCauseLabelsFromProfile(profile).slice(0, 3));
}
