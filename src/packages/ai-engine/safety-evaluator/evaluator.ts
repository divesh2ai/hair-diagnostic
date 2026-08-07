// Canonical safety / eligibility evaluator.
//
// Every rule encoded here mirrors an existing enforcement point in either the
// live topical engine (recommendTopicals.ts), the live kit-scorer interaction
// resolver (resolveKitInteractions.ts), or the previously-dead but explicit
// contraindications module (validateContraindications.ts /
// checkTherapyEligibility.ts). No new medical rules or thresholds are
// invented here — see W7 decision table for the rule↔source map.

import type { PatientAnswers } from '../../types';
import type {
  SafetyEvaluationInput,
  SafetyEvaluationResult,
  SafetyFinding,
  SafetyDoctorView,
  SafetyPatientView,
  SafetySeverity,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Small predicate helpers. Deliberately duplicated (not imported from
// legacy signal files) so the evaluator's inputs are auditable in one place.

function toLowerFlat(ans: PatientAnswers): string {
  return Object.values(ans)
    .flat()
    .map((v) => String(v ?? ''))
    .join(' ')
    .toLowerCase();
}

function includesAny(hay: string, needles: string[]): boolean {
  return needles.some((n) => hay.includes(n));
}

function arrIncludesAny(arr: unknown, needles: string[]): boolean {
  const list = Array.isArray(arr) ? arr : arr == null ? [] : [arr];
  const lower = list.map((v) => String(v).toLowerCase());
  return lower.some((v) => needles.some((n) => v.includes(n)));
}

function normaliseSex(s: string | undefined): 'male' | 'female' | 'other' {
  const t = (s ?? '').toLowerCase();
  if (t.includes('female')) return 'female';
  if (t.includes('male')) return 'male';
  return 'other';
}

// Minoxidil products we may see in a proposed topical set. Verbatim strings
// used by recommendTopicals.ts; kept here so blockedTopicals matches exactly.
const MINOXIDIL_PRODUCTS = [
  'Minoxidil 5%',
  'Minoxidil 2%',
  'Minoxidil 2% Topical',
  'Minoxidil 2% + Finasteride 0.25% Topical',
  'Minoxidil + Spironolactone Topical',
  'Oral Minoxidil 1.25mg',
  'Oral Minoxidil 2.5mg',
  'Oral Minoxidil 1.25–2.5mg',
  'Oral Minoxidil + Spironolactone',
  'Oral Minoxidil + Bicalutamide',
] as const;

const PREGNANCY_BLOCKED_TOPICALS = [
  'Minoxidil 5%',
  'Minoxidil 2%',
  'Minoxidil 2% Topical',
  'Minoxidil 2% + Finasteride 0.25% Topical',
  'Minoxidil + Spironolactone Topical',
  'Finasteride 0.25% Topical',
  'Finasteride 2.5% Topical',
  'Finasteride 0.1% Gel',
  'F-Emugrow MCRD',
  'F-Emugrow MCR',
  'Trichonourish EVA / FHA-Andro+',
  'Oral Minoxidil 1.25mg',
  'Oral Minoxidil 2.5mg',
  'Oral Minoxidil + Spironolactone',
  'Oral Minoxidil + Bicalutamide',
] as const;

const HYPERTENSION_SAFE_ALTERNATIVES = [
  'F-Emugrow MCRD',
  'Trichogain Serum',
  'CR Serum',
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Input derivation — the ONE place these safety-critical flags are computed
// for eligibility decisions. Both the kit engine (via scoreKits) and the
// topical engine (via recommendTopicals) consume this evaluator, so any
// divergence in interpretation is impossible by construction.

interface DerivedInputs {
  age: number;
  sex: 'male' | 'female' | 'other';
  isPregnant: boolean;
  isPregnantConfirmedByStructuredFlag: boolean;
  planningPregnancy: boolean;
  hasHypertensionStructured: boolean;
  hasHypertensionFreeText: boolean;
  femaleOfReproductiveAge: boolean;
  pregnancyInputUnknown: boolean;
}

function derive(ans: PatientAnswers, patient: { age: number; sex: string }): DerivedInputs {
  const age = Number.isFinite(patient.age) ? Math.trunc(patient.age) : 0;
  const sex = normaliseSex(ans.gender ?? ans.sex ?? patient.sex);

  const flat = toLowerFlat(ans);

  const isPregnantConfirmedByStructuredFlag = ans.is_pregnant === true;
  const isPregnantByFreeText =
    arrIncludesAny(ans.hormonal ?? ans.hormonal_issues, ['pregnan']) ||
    arrIncludesAny(ans.cause, ['currently pregnant']);
  const isPregnant = isPregnantConfirmedByStructuredFlag || isPregnantByFreeText;

  const planningPregnancy =
    ans.planning_pregnancy === true ||
    /planning\s*to\s*conceiv|trying\s*to\s*conceiv|trying\s*to\s*pregn|conception/i.test(
      `${flat} ${ans.medical_detail ?? ''}`,
    );

  const hasHypertensionStructured = ans.hasHypertension === true;
  const hasHypertensionFreeText =
    !hasHypertensionStructured &&
    includesAny(flat, ['hypertension', 'blood pressure', 'antihypertensive']);

  // Reproductive-age gate mirrors the questionnaire's "heavy bleeding" female
  // 18–50 selector (see feedback: questionnaire changes 2026-06-15). No new
  // threshold — same bracket already used elsewhere.
  const femaleOfReproductiveAge = sex === 'female' && age >= 18 && age <= 50;
  const pregnancyInputUnknown =
    femaleOfReproductiveAge && !isPregnant && !planningPregnancy && ans.is_pregnant === undefined;

  return {
    age,
    sex,
    isPregnant,
    isPregnantConfirmedByStructuredFlag,
    planningPregnancy,
    hasHypertensionStructured,
    hasHypertensionFreeText,
    femaleOfReproductiveAge,
    pregnancyInputUnknown,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Rule implementations. Each rule is a pure predicate over DerivedInputs +
// SafetyEvaluationInput; it returns 0 or 1 SafetyFinding. NEVER mutates.

function rulePregnancyKitLock(i: DerivedInputs): SafetyFinding | null {
  if (!i.isPregnant) return null;
  return {
    ruleId: 'SAFETY_PREGNANCY_KIT_LOCK',
    severity: 'BLOCK',
    audience: 'BOTH',
    title: 'Pregnancy — kit protocol locked to pregnancy-safe kit',
    doctorRationale:
      'Patient reports current pregnancy. Only the pregnancy-safe supplement kit ' +
      'is permitted; all pattern-loss, DHT-blockade, and anti-androgen kits are ' +
      'contraindicated (teratogenic or systemic-absorption risk).',
    patientMessage:
      'Because you have shared that you are pregnant, our system will only ' +
      'offer pregnancy-safe supplements. Any other treatment options will be ' +
      'reviewed with your doctor.',
    // Kit-lock is enforced upstream by resolveKitInteractions PREGNANCY_LOCK
    // (single HEALTHY-9). We do NOT re-list a kit id here so the evaluator
    // never overrides sequencing — it only affirms the block.
    escalation:
      'Confirm gestational stage with the patient before finalising the report. ' +
      'Consider deferring topical / systemic pattern-loss therapy until post-partum.',
    sourceFields: ['is_pregnant', 'hormonal', 'cause'],
  };
}

function rulePregnancyTopicalBlock(i: DerivedInputs): SafetyFinding | null {
  if (!i.isPregnant) return null;
  return {
    ruleId: 'SAFETY_PREGNANCY_TOPICAL_BLOCK',
    severity: 'BLOCK',
    audience: 'DOCTOR',
    title: 'Pregnancy — all standard topicals blocked',
    doctorRationale:
      'Pregnancy: Minoxidil (topical + oral), Finasteride, Dutasteride, and ' +
      'Spironolactone are contraindicated. No standard topical is safe. Defer ' +
      'topical therapy until post-partum or breastfeeding cessation per clinical judgement.',
    patientMessage: '',
    blockedTopicals: PREGNANCY_BLOCKED_TOPICALS,
    safeAlternatives: [],
    escalation: 'Doctor consultation required before any topical.',
    sourceFields: ['is_pregnant', 'hormonal', 'cause'],
  };
}

function rulePlanningPregnancy(i: DerivedInputs): SafetyFinding | null {
  if (i.isPregnant) return null; // pregnancy rule already covers everything
  if (!i.planningPregnancy) return null;
  return {
    ruleId: 'SAFETY_PLANNING_PREGNANCY_TOPICAL_BLOCK',
    severity: 'BLOCK',
    audience: 'BOTH',
    title: 'Planning pregnancy — teratogenic topicals blocked',
    doctorRationale:
      'Patient reports planning pregnancy. Minoxidil, Finasteride, Dutasteride, ' +
      'and Spironolactone-containing topicals are teratogenic or carry systemic ' +
      'absorption risk to a future foetus. Non-hormonal, non-pharmaceutical ' +
      'topicals only until conception planning window closes.',
    patientMessage:
      'Since you have shared that you are planning a pregnancy, our system ' +
      'will avoid any treatment that could affect a future pregnancy. Your ' +
      'doctor will confirm the safest options for you.',
    blockedTopicals: PREGNANCY_BLOCKED_TOPICALS,
    safeAlternatives: ['Trichogain Serum', 'CR Serum', 'Ketoconazole Lotion / Shampoo'],
    escalation:
      'Confirm conception timeline. If actively trying, treat as pregnancy-caution; ' +
      'if planning within 3 months, maintain non-pharmaceutical topicals only.',
    sourceFields: ['planning_pregnancy', 'medical_detail'],
  };
}

function ruleHypertensionMinoxidilBlock(
  i: DerivedInputs,
  proposedTopicals: readonly string[],
): SafetyFinding | null {
  if (!i.hasHypertensionStructured && !i.hasHypertensionFreeText) return null;
  const includesMinox = proposedTopicals.some((t) =>
    /minoxidil/i.test(t),
  );
  return {
    ruleId: 'SAFETY_HYPERTENSION_MINOXIDIL_BLOCK',
    severity: 'BLOCK',
    audience: 'BOTH',
    title: 'Hypertension — Minoxidil blocked',
    doctorRationale:
      'Hypertension detected. Minoxidil is a vasodilator; topical or oral ' +
      'Minoxidil compounds antihypertensive medication effects and can cause ' +
      'dangerous BP fluctuation. Use non-Minoxidil pattern-loss support (Emugrow / ' +
      'Trichogain / CR Serum).' +
      (includesMinox
        ? ' Note: an upstream branch proposed a Minoxidil topical — stripped.'
        : ''),
    patientMessage:
      'Because your answers mention high blood pressure or blood-pressure ' +
      'medication, our system will avoid Minoxidil-based options. Your doctor ' +
      'will recommend safer alternatives.',
    blockedTopicals: MINOXIDIL_PRODUCTS,
    safeAlternatives: HYPERTENSION_SAFE_ALTERNATIVES,
    escalation:
      'If oral Minoxidil is clinically necessary, confirm BP control on current ' +
      'antihypertensive regimen and start at 1.25mg with monitoring — DOCTOR DECISION.',
    sourceFields: i.hasHypertensionStructured
      ? ['hasHypertension']
      : ['medical_detail (free-text)'],
  };
}

function ruleHypertensionFreeTextOnly(i: DerivedInputs): SafetyFinding | null {
  if (i.hasHypertensionStructured) return null;
  if (!i.hasHypertensionFreeText) return null;
  return {
    ruleId: 'SAFETY_INPUT_HYPERTENSION_FREE_TEXT_ONLY',
    severity: 'MISSING_INPUT',
    audience: 'DOCTOR',
    title: 'Hypertension detected only from free-text — confirm with patient',
    doctorRationale:
      'Structured `hasHypertension` flag is not set. Detection came from ' +
      'free-text scanning of questionnaire answers (regex: hypertension / blood ' +
      'pressure / antihypertensive). Confirm blood-pressure status before ' +
      'finalising any therapy choice — false positives (e.g. family history ' +
      'mention) may over-block Minoxidil.',
    patientMessage: '',
    escalation: 'Confirm patient blood-pressure status verbally or via a structured questionnaire item.',
    sourceFields: ['medical_detail (free-text)'],
  };
}

function ruleFinasterideMaleUnder18(i: DerivedInputs): SafetyFinding | null {
  if (i.sex !== 'male') return null;
  if (i.age <= 0 || i.age >= 18) return null;
  return {
    ruleId: 'SAFETY_FINASTERIDE_MALE_UNDER_18',
    severity: 'BLOCK',
    audience: 'DOCTOR',
    title: 'Male under 18 — Finasteride contraindicated',
    doctorRationale:
      'Androgenic axis is not fully developed in males under 18. Finasteride-mediated ' +
      '5-alpha reductase inhibition can cause irreversible hormonal effects during ' +
      'development. Non-hormonal topicals only.',
    patientMessage: '',
    blockedTopicals: [
      'Finasteride 0.1% Gel',
      'Finasteride 0.25% Topical',
      'Finasteride 2.5% Topical',
      'Minoxidil 2% + Finasteride 0.25% Topical',
    ],
    safeAlternatives: ['F-Emugrow MCRD', 'Trichogain Serum', 'CR Serum'],
    escalation: 'Advanced grade at this age requires specialist supervision.',
    sourceFields: ['age', 'sex'],
  };
}

function ruleFinasterideFemalePregnancyPotential(
  i: DerivedInputs,
  proposedTopicals: readonly string[],
): SafetyFinding | null {
  if (i.sex !== 'female') return null;
  if (i.isPregnant || i.planningPregnancy) return null; // covered by dedicated rules
  if (!i.femaleOfReproductiveAge) return null;
  const proposesFin = proposedTopicals.some((t) => /finasteride|dutasteride/i.test(t));
  if (!proposesFin) return null;
  return {
    ruleId: 'SAFETY_FINASTERIDE_FEMALE_PREGNANCY_POTENTIAL',
    severity: 'CAUTION',
    audience: 'DOCTOR',
    title: 'Female of reproductive age — Finasteride/Dutasteride pregnancy caution',
    doctorRationale:
      'Female patient in reproductive-age bracket (18–50) with a Finasteride or ' +
      'Dutasteride-containing topical proposed. These agents are teratogenic. ' +
      'Confirm no pregnancy, no planning pregnancy, and contraception status ' +
      'before prescribing.',
    patientMessage: '',
    escalation: 'Verify pregnancy status and contraception plan before dispensing.',
    sourceFields: ['sex', 'age', 'is_pregnant', 'planning_pregnancy'],
  };
}

function ruleOralMinoxidilOver60Cardiac(
  i: DerivedInputs,
  proposedTopicals: readonly string[],
): SafetyFinding | null {
  if (i.age <= 60) return null;
  const proposesOral = proposedTopicals.some((t) => /oral\s*minoxidil/i.test(t));
  return {
    ruleId: 'SAFETY_ORAL_MINOXIDIL_OVER_60_CARDIAC',
    severity: proposesOral ? 'BLOCK' : 'CAUTION',
    audience: 'DOCTOR',
    title: 'Age > 60 — Oral Minoxidil cardiac evaluation required',
    doctorRationale:
      'Systemic vasodilation from oral Minoxidil is significantly amplified in ' +
      'patients over 60 due to reduced cardiac reserve and concurrent ' +
      'antihypertensive medications. Mandatory cardiac evaluation before ' +
      'initiation. Increased risk of orthostatic hypotension.',
    patientMessage: '',
    blockedTopicals: proposesOral
      ? ['Oral Minoxidil 1.25mg', 'Oral Minoxidil 2.5mg', 'Oral Minoxidil 1.25–2.5mg']
      : undefined,
    escalation: 'Cardiac clearance required before oral Minoxidil initiation.',
    sourceFields: ['age'],
  };
}

function rulePregnancyInputUnknown(i: DerivedInputs): SafetyFinding | null {
  if (!i.pregnancyInputUnknown) return null;
  return {
    ruleId: 'SAFETY_INPUT_PREGNANCY_UNKNOWN_FEMALE_REPRODUCTIVE_AGE',
    severity: 'MISSING_INPUT',
    audience: 'DOCTOR',
    title: 'Pregnancy status not confirmed — female of reproductive age',
    doctorRationale:
      'Female patient in reproductive-age bracket (18–50) with no structured ' +
      'answer to the pregnancy / planning-pregnancy questions. Confirm status ' +
      'before dispensing any Finasteride, Dutasteride, or Spironolactone product.',
    patientMessage: '',
    escalation: 'Ask the patient explicitly about current or planned pregnancy.',
    sourceFields: ['is_pregnant', 'planning_pregnancy'],
  };
}

function ruleDrugInteractionsNotEvaluated(): SafetyFinding {
  return {
    ruleId: 'SAFETY_DRUG_INTERACTIONS_NOT_EVALUATED',
    severity: 'NOT_EVALUATED',
    audience: 'DOCTOR',
    title: 'Drug–drug interactions were NOT evaluated',
    doctorRationale:
      'This system does not maintain a medication list or drug-interaction ' +
      'database. It has NOT screened the recommended kits or topicals for ' +
      'interactions with the patient\'s concurrent medications. The prescribing ' +
      'doctor MUST perform a manual medication review before dispensing.',
    patientMessage:
      'Please share the full list of medicines you are currently taking with ' +
      'your doctor. Our system does not check for interactions with other ' +
      'medicines — your doctor will do that review.',
    escalation: 'Perform a manual medication reconciliation prior to dispensing.',
  };
}

// Turn resolveKitInteractions.applied strings into audit-only INFO findings so
// the eligibility surface reports every clinical action taken upstream.
function kitInteractionInfoFindings(audit: readonly string[]): SafetyFinding[] {
  return audit.map((line) => ({
    ruleId: 'SAFETY_KIT_COMBINATION_UNIFIED' as const,
    severity: 'INFO' as const,
    audience: 'DOCTOR' as const,
    title: 'Kit interaction rule applied',
    doctorRationale: line,
    patientMessage: '',
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Ordering + view projection

const SEVERITY_ORDER: Record<SafetySeverity, number> = {
  BLOCK: 0,
  CAUTION: 1,
  MISSING_INPUT: 2,
  INFO: 3,
  NOT_EVALUATED: 4,
};

function sortFindings(a: SafetyFinding, b: SafetyFinding): number {
  return SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
}

function buildDoctorView(findings: SafetyFinding[]): SafetyDoctorView {
  return {
    blocks: findings.filter((f) => f.severity === 'BLOCK'),
    cautions: findings.filter((f) => f.severity === 'CAUTION'),
    unresolvedChecks: findings.filter((f) => f.severity === 'MISSING_INPUT'),
    informational: findings.filter((f) => f.severity === 'INFO'),
    notEvaluated: findings.filter((f) => f.severity === 'NOT_EVALUATED'),
  };
}

function buildPatientView(findings: SafetyFinding[]): SafetyPatientView {
  const patientFacing = findings.filter(
    (f) => (f.audience === 'PATIENT' || f.audience === 'BOTH') && f.patientMessage.length > 0,
  );
  const gate = findings.some(
    (f) => f.severity === 'BLOCK' || f.severity === 'MISSING_INPUT',
  );
  return {
    messages: patientFacing.map((f) => f.patientMessage),
    awaitsDoctorConfirmation: gate,
  };
}

function unionBlocked(field: 'blockedKits' | 'blockedTopicals', findings: SafetyFinding[]): string[] {
  const out = new Set<string>();
  for (const f of findings) {
    if (f.severity !== 'BLOCK') continue;
    for (const k of f[field] ?? []) out.add(k);
  }
  return [...out];
}

// ─────────────────────────────────────────────────────────────────────────────
// Public entry point.

export function evaluateSafety(input: SafetyEvaluationInput): SafetyEvaluationResult {
  const derived = derive(input.answers, input.patient);
  const proposedTopicals = input.proposedKits; // treated as generic proposed item names

  const raw: (SafetyFinding | null)[] = [
    rulePregnancyKitLock(derived),
    rulePregnancyTopicalBlock(derived),
    rulePlanningPregnancy(derived),
    ruleHypertensionMinoxidilBlock(derived, proposedTopicals),
    ruleHypertensionFreeTextOnly(derived),
    ruleFinasterideMaleUnder18(derived),
    ruleFinasterideFemalePregnancyPotential(derived, proposedTopicals),
    ruleOralMinoxidilOver60Cardiac(derived, proposedTopicals),
    rulePregnancyInputUnknown(derived),
  ];

  const findings: SafetyFinding[] = raw.filter((f): f is SafetyFinding => f !== null);
  findings.push(...kitInteractionInfoFindings(input.kitInteractionAudit ?? []));
  // ALWAYS include the NOT_EVALUATED acknowledgement — drug-drug interactions
  // are never checked; making that explicit is the safety contract.
  findings.push(ruleDrugInteractionsNotEvaluated());
  findings.sort(sortFindings);

  const blockedKits = unionBlocked('blockedKits', findings);
  const blockedTopicals = unionBlocked('blockedTopicals', findings);

  return {
    findings,
    blockedKits,
    blockedTopicals,
    doctorView: buildDoctorView(findings),
    patientView: buildPatientView(findings),
    hasBlock: findings.some((f) => f.severity === 'BLOCK'),
    hasUnresolvedSafetyCheck: findings.some((f) => f.severity === 'MISSING_INPUT'),
  };
}
