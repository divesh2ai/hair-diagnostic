/**
 * Evidence-grounding validator.
 *
 * Enforces Rule 2 (never mention symptoms the patient did not report) and
 * Rule 7 (no contradictory statements) on narrative text. Scans a piece
 * of finished narrative for "banned-when-absent" terms and reports
 * violations tied to the missing evidence.
 *
 * This is a defensive backstop. Composers should already gate their
 * fragments by facts; this validator catches anything that slipped past.
 */

import type { ClinicalFacts } from './types';
import { hasFact } from './buildClinicalFacts';
import type { FactKey } from './types';

// ── Rules ──────────────────────────────────────────────────────────────────
//
// Each rule says: "If the text matches `pattern`, the patient must have
// `requires` (any of). If they don't, that's a violation." Patterns are
// scanned case-insensitively against the whole-word body of each section.

export interface GroundingRule {
  readonly id: string;
  /** Plain description of the claim the matching text makes. */
  readonly claim: string;
  /** Pattern that surfaces the claim in narrative prose. */
  readonly pattern: RegExp;
  /**
   * Either "requires" mode (claim is only valid when one of these facts is
   * present) or "forbiddenWhen" mode (claim is contradicted when one of
   * these facts is present — e.g. "nutritional deficiency" mentioned but
   * patient has `diet.normal`). Exactly one of these must be specified.
   */
  readonly requires?: readonly FactKey[];
  readonly forbiddenWhen?: readonly FactKey[];
  /** Optional: text that may falsely fire the pattern (e.g. "no dandruff"); skip if matches. */
  readonly exemptIfPrefixed?: RegExp;
}

export const GROUNDING_RULES: readonly GroundingRule[] = [
  // ── Scalp symptoms ──
  {
    id: 'scalp.dandruff',
    claim: 'mentions dandruff or flaking',
    pattern: /\b(dandruff|flak(?:e|ing|y))\b/i,
    requires: ['scalp.dandruff'],
  },
  {
    id: 'scalp.itching',
    claim: 'mentions itching',
    pattern: /\bitch(?:ing|y|iness)?\b/i,
    requires: ['scalp.inflamed', 'scalp.dandruff', 'scalp.sensitive', 'scalp.psoriatic'],
  },
  {
    id: 'scalp.oily',
    claim: 'mentions oily / greasy / seborrhoeic scalp',
    pattern: /\b(oily|oiliness|greasy|seborrh(?:oe|e)ic|seborrh(?:oe|e)a)\b/i,
    requires: ['scalp.oily'],
  },
  {
    id: 'scalp.dry',
    claim: 'mentions dry scalp',
    pattern: /\bdry\s+scalp\b/i,
    requires: ['scalp.dry'],
  },
  {
    id: 'scalp.inflamed',
    claim: 'mentions scalp inflammation / redness / burning',
    // Don't trip on generic "perifollicular inflammation" microscopic claims —
    // those are inferred-biology, not reported-symptom. Only block when the
    // text claims the *patient* has visible scalp inflammation.
    pattern: /\b(scalp\s+(?:inflammation|inflamed|redness|burning|irritation))\b/i,
    requires: ['scalp.inflamed', 'scalp.anyNonNormal'],
  },
  {
    id: 'scalp.psoriatic',
    claim: 'mentions psoriasis on the scalp',
    pattern: /\bpsoriasis\b|\bpsoriatic\b/i,
    requires: ['scalp.psoriatic'],
  },

  // ── Diet ──
  {
    id: 'diet.poor',
    claim: 'mentions poor diet / nutritional deficiency',
    pattern: /\bpoor\s+(?:diet|nutrition)\b|\bnutritional\s+deficien(?:cy|cies)\b|\bprotein\s+deficien(?:cy|t)\b/i,
    requires: ['diet.restricted', 'inferred.nutritionDriver', 'history.ironRisk'],
  },

  // ── Endocrine / history ──
  {
    id: 'history.thyroid',
    claim: 'attributes hair loss to thyroid',
    // Only block specific thyroid-driver claims, not e.g. "thyroid panel at follow-up".
    pattern: /\bthyroid\s+(?:insufficien|imbalance|driver|disease|dysfunction|is\s+(?:driving|impact|caus|slowing))/i,
    requires: ['history.thyroid'],
  },
  {
    id: 'history.pcos',
    claim: 'attributes hair loss to PCOS',
    pattern: /\bPCOS\b/i,
    requires: ['history.pcos'],
  },
  {
    id: 'history.postpartum',
    claim: 'mentions post-partum / breastfeeding hair loss',
    pattern: /\bpost.?partum\b|\bpost.?delivery\b|\bbreastfeed(?:ing)?\b|\blactat(?:ion|ing)\b/i,
    requires: ['history.postpartum'],
  },
  {
    id: 'history.menopause',
    claim: 'mentions menopausal / peri-menopausal change',
    pattern: /\bmenopaus(?:e|al)\b|\bperi.?menopaus/i,
    requires: ['history.menopause'],
  },
  {
    id: 'history.gi',
    claim: 'attributes hair loss to GI symptoms',
    pattern: /\b(?:GERD|IBS|Crohn|reflux|gut\s+inflam|leaky\s+gut|gut\s+(?:disruption|malabsorption))\b/i,
    requires: ['history.gi'],
  },
  {
    id: 'history.glp1',
    claim: 'mentions GLP-1 medication',
    pattern: /\bGLP.?1\b|\bsemaglutide\b|\bozempic\b|\bwegovy\b|\bmounjaro\b|\btirzepatide\b/i,
    requires: ['history.glp1'],
  },
  {
    id: 'history.pulling',
    claim: 'mentions pulling / trichotillomania',
    pattern: /\b(pulling\s+(?:behaviour|behavior)|trichotillomania|TTM)\b/i,
    requires: ['history.pulling'],
  },
  {
    id: 'history.smoking',
    claim: 'mentions smoking as a driver',
    pattern: /\bsmoking\b|\bvaping\b/i,
    requires: ['history.oxidative'],
  },

  // ── Contradiction rules (forbiddenWhen) ──
  // Patient explicitly negated this finding, so the narrative must not
  // re-introduce it. These are stricter than "requires" rules — they fail
  // even when an inference might otherwise justify the term, because the
  // patient's reported state directly contradicts the claim.
  {
    id: 'contradiction.normalDiet',
    claim: 'attributes hair loss to poor diet despite reported normal diet',
    pattern: /\bnutritional\s+deficien(?:cy|cies|t)\b|\bpoor\s+(?:diet|nutrition)\b|\bprotein\s+deficien/i,
    forbiddenWhen: ['diet.normal'],
  },
  {
    id: 'contradiction.malePatientFemaleLanguage',
    claim: 'uses female-only framing for a male patient',
    pattern: /\b(your\s+(?:menstrual|menopaus|peri.?menopaus|post.?partum)|female\s+pattern\s+hair\s+loss|FPHL)\b/i,
    forbiddenWhen: ['sex.male'],
  },
  {
    id: 'contradiction.femalePatientMaleLanguage',
    claim: 'uses male-only framing for a female patient',
    pattern: /\b(male\s+pattern\s+hair\s+loss|MPHL|your\s+(?:beard|temples\s+receding))\b/i,
    forbiddenWhen: ['sex.female'],
  },
  {
    id: 'contradiction.pregnancyContraindicated',
    claim: 'mentions a pregnancy-contraindicated therapy',
    pattern: /\b(finasteride|dutasteride|minoxidil|retinoid|spironolactone)\b/i,
    forbiddenWhen: ['state.pregnant'],
  },
  {
    id: 'contradiction.normalScalp',
    claim: 'attributes visible scalp inflammation despite reported normal scalp',
    pattern: /\byour\s+(?:scalp\s+(?:is\s+inflamed|shows\s+inflammation|signs)|dandruff|itchy\s+scalp|oily\s+scalp)\b/i,
    forbiddenWhen: ['scalp.normal'],
  },
];

// ── Validator ──────────────────────────────────────────────────────────────

export interface GroundingViolation {
  readonly ruleId: string;
  readonly claim: string;
  readonly section: string;
  readonly matchedText: string;
  readonly missingEvidence: readonly FactKey[];
}

export interface GroundingResult {
  readonly valid: boolean;
  readonly violations: readonly GroundingViolation[];
}

export interface SectionInput {
  readonly section: string;
  readonly text: string;
}

export function validateEvidenceGrounding(
  sections: readonly SectionInput[],
  facts: ClinicalFacts,
): GroundingResult {
  const violations: GroundingViolation[] = [];
  for (const { section, text } of sections) {
    if (!text) continue;
    for (const rule of GROUNDING_RULES) {
      const m = rule.pattern.exec(text);
      if (!m) continue;

      // Two-mode evaluation:
      //   requires       — claim is valid only if at least one fact is present.
      //   forbiddenWhen  — claim is invalid if any of the listed facts is present.
      let isViolation = false;
      let missing: readonly FactKey[] = [];

      if (rule.requires && rule.requires.length > 0) {
        const supported = rule.requires.some((k) => hasFact(facts, k));
        if (!supported) {
          isViolation = true;
          missing = rule.requires;
        }
      }
      if (!isViolation && rule.forbiddenWhen && rule.forbiddenWhen.length > 0) {
        const contradicted = rule.forbiddenWhen.some((k) => hasFact(facts, k));
        if (contradicted) {
          isViolation = true;
          missing = rule.forbiddenWhen;
        }
      }

      if (!isViolation) continue;
      violations.push({
        ruleId: rule.id,
        claim: rule.claim,
        section,
        matchedText: m[0],
        missingEvidence: missing,
      });
    }
  }
  return { valid: violations.length === 0, violations };
}

export function formatViolations(result: GroundingResult): string {
  if (result.valid) return '';
  return result.violations
    .map(
      (v) =>
        `  • [${v.section}] "${v.matchedText}" — ${v.claim}, but none of [${v.missingEvidence.join(', ')}] are present on the patient's facts.`,
    )
    .join('\n');
}
