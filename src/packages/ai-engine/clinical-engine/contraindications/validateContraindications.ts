import type { PatientAnswers } from '../../../types';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ContraindictionSeverity = 'HARD_STOP' | 'ABSOLUTE' | 'CAUTION' | 'PREFER_ALTERNATIVE';

export interface ContraindictionViolation {
  ruleId: string;
  name: string;
  severity: ContraindictionSeverity;
  message: string;
  blockedKits?: string[];
  blockedTopicals?: string[];
  allowedKits?: string[];
  allowedTopicals?: string[];
  clinicalRationale: string;
}

export interface ContraindictionResult {
  hasHardStop: boolean;
  violations: ContraindictionViolation[];
  allowedKitOverride?: string[];
  pregnancySingleKitLock?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Signal derivation helpers — mirrors clinical engine derivedSignals exactly
// ─────────────────────────────────────────────────────────────────────────────

function has(arr: unknown, v: string): boolean {
  if (!arr) return false;
  const target = v.toLowerCase();
  if (Array.isArray(arr)) return arr.some(x => String(x).toLowerCase().includes(target));
  return String(arr).toLowerCase().includes(target);
}

function ansText(ans: PatientAnswers): string {
  return Object.values(ans)
    .flat()
    .map(v => String(v ?? ''))
    .join(' ')
    .toLowerCase();
}

// ─────────────────────────────────────────────────────────────────────────────
// AC_001 / AC_002 — Pregnancy (absolute, both kit and topical engines)
// Source: clinical-engine.schema.json absoluteLocks; topical-engine.schema.json PREGNANCY_OVERRIDE
// ─────────────────────────────────────────────────────────────────────────────

function checkPregnancy(ans: PatientAnswers): ContraindictionViolation | null {
  const hormonal = ans.hormonal ?? ans.hormonal_issues ?? [];
  const cause = ans.cause ?? [];

  const isPregnant =
    ans.is_pregnant === true ||
    has(hormonal, 'pregnant') ||
    has(hormonal, 'Pregnancy') ||
    has(hormonal, 'Currently pregnant') ||
    has(cause, 'Currently pregnant');

  const planningPregnancy =
    ans.planning_pregnancy === true ||
    has(ansText(ans), 'planning to conceive') ||
    has(ansText(ans), 'conception');

  if (!isPregnant && !planningPregnancy) return null;

  if (isPregnant) {
    return {
      ruleId: 'AC_001',
      name: 'PREGNANCY_ABSOLUTE_LOCK',
      severity: 'HARD_STOP',
      message: isPregnant
        ? 'Patient is currently pregnant — HEALTHY-9 is the only permitted kit. No other kits may be prescribed.'
        : 'Patient is planning pregnancy — all Minoxidil, Finasteride, Dutasteride, and anti-androgen topicals are contraindicated.',
      blockedKits: isPregnant ? ['ALL_OTHERS'] : undefined,
      blockedTopicals: [
        'Minoxidil 5%',
        'Minoxidil 2% + Finasteride 0.25% Topical',
        'Minoxidil + Spironolactone Topical',
        'F-Emugrow MCRD',
        'Trichonourish EVA / FHA-Andro+',
      ],
      allowedKits: isPregnant ? ['HEALTHY - 9'] : undefined,
      allowedTopicals: [],
      clinicalRationale:
        'HEALTHY-9 is PREGNANCY ONLY — single kit, no other kits during pregnancy. ' +
        'Minoxidil, Finasteride, Dutasteride, and Spironolactone are teratogenic or carry systemic absorption risk to the foetus.',
    };
  }

  // Planning pregnancy — topical block only, no kit hard stop
  return {
    ruleId: 'AC_002',
    name: 'PLANNING_PREGNANCY_TOPICAL_BLOCK',
    severity: 'ABSOLUTE',
    message: 'Patient is planning pregnancy — all Minoxidil, Finasteride, Dutasteride, and anti-androgen topicals are contraindicated.',
    blockedTopicals: [
      'Minoxidil 5%',
      'Minoxidil 2% + Finasteride 0.25% Topical',
      'Minoxidil + Spironolactone Topical',
      'F-Emugrow MCRD',
      'Trichonourish EVA / FHA-Andro+',
    ],
    allowedTopicals: ['Trichogain Serum', 'CR Serum', 'Ketoconazole Lotion / Shampoo'],
    clinicalRationale:
      'Minoxidil, Finasteride, Dutasteride, and Spironolactone are teratogenic or carry systemic absorption risk. ' +
      'Non-hormonal, non-pharmaceutical topicals only during conception planning.',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HT_001 — Hypertension topical early return
// Source: topical-engine.schema.json HYPERTENSION_OVERRIDE; hiddenCouplings[TC_04]
// WARNING: detection is free-text only — structural gap documented in HS_006
// ─────────────────────────────────────────────────────────────────────────────

function checkHypertension(ans: PatientAnswers): ContraindictionViolation | null {
  const text = ansText(ans);

  // Structured field check first (recommended fix for TC_04)
  const hasHypertensionFlag = ans.hasHypertension === true;

  // Free-text fallback — the only detection path in current schema
  const hypertensionInText =
    text.includes('hypertension') ||
    text.includes('blood pressure') ||
    text.includes('bp medication') ||
    text.includes('antihypertensive');

  if (!hasHypertensionFlag && !hypertensionInText) return null;

  return {
    ruleId: 'HT_001',
    name: 'HYPERTENSION_TOPICAL_EARLY_RETURN',
    severity: 'HARD_STOP',
    message:
      'Hypertension detected — all standard Minoxidil formulations are contraindicated due to systemic vasodilation risk. ' +
      'Non-minoxidil topicals only. Oral Minoxidil may be considered at low dose (1.25 mg) ONLY if BP is currently controlled — doctor decision required.',
    blockedTopicals: [
      'Minoxidil 5%',
      'Minoxidil 2% + Finasteride 0.25% Topical',
      'Minoxidil + Spironolactone Topical',
    ],
    allowedTopicals: ['F-Emugrow MCRD', 'Trichogain Serum'],
    clinicalRationale:
      'Minoxidil is a vasodilator — systemic absorption (topical or oral) compounds antihypertensive medication effects and can cause dangerous BP fluctuation. ' +
      'F-Emugrow MCRD (Dutasteride + Redensyl) provides DHT blockade without vasodilatory effect.',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// FR_002 — Finasteride absolute block for males under 18
// Source: topical-engine.schema.json MALE_UNDER_18; topicalProtocolRows
// ─────────────────────────────────────────────────────────────────────────────

function checkMaleUnder18Finasteride(ans: PatientAnswers): ContraindictionViolation | null {
  const age = parseInt(String(ans.age ?? '0'), 10);
  const isMale = String(ans.sex ?? ans.gender ?? '').toLowerCase() === 'male';

  if (!isMale || age >= 18) return null;

  return {
    ruleId: 'FR_002',
    name: 'FINASTERIDE_MALE_UNDER_18_BLOCK',
    severity: 'ABSOLUTE',
    message:
      'Patient is male and under 18 — Finasteride is absolutely contraindicated. ' +
      'Mild non-hormonal topicals only: F-Emugrow MCRD or Trichogain Serum. ' +
      (age <= 18 && has(ans.grade ?? '', 'Grade 3') || has(ans.grade ?? '', 'Grade 4') || has(ans.grade ?? '', 'Grade 5')
        ? 'Grade 3+ at this age requires strict specialist supervision.'
        : ''),
    blockedTopicals: [
      'Minoxidil 2% + Finasteride 0.25% Topical',
    ],
    allowedTopicals: ['F-Emugrow MCRD', 'Trichogain Serum', 'CR Serum'],
    clinicalRationale:
      'Androgenic axis not fully developed in males under 18. Finasteride-mediated 5-alpha reductase inhibition can cause irreversible hormonal effects during development.',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// AG_003 — Oral Minoxidil cardiac caution over 60
// Source: topical-engine.schema.json MALE_OVER_55
// ─────────────────────────────────────────────────────────────────────────────

function checkOralMinoxidilOver60(ans: PatientAnswers): ContraindictionViolation | null {
  const age = parseInt(String(ans.age ?? '0'), 10);
  if (age <= 60) return null;

  return {
    ruleId: 'AG_003',
    name: 'ORAL_MINOXIDIL_OVER_60_CARDIAC_CAUTION',
    severity: 'CAUTION',
    message:
      'Patient is over 60 — oral Minoxidil requires mandatory cardiac evaluation before prescribing. ' +
      'Increased risk of orthostatic hypotension and systemic vasodilation in elderly patients.',
    blockedTopicals: [],
    allowedTopicals: [],
    clinicalRationale:
      'Systemic vasodilation from oral Minoxidil is significantly amplified in patients over 60 due to reduced cardiac reserve and concurrent antihypertensive medications.',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// TC_004 PVR_001 — F-Emugrow MCRD vs MCR for females under 30
// Source: topical-engine.schema.json hiddenCouplings[TC_02]; decisionTree branches
// ─────────────────────────────────────────────────────────────────────────────

function checkEmugrowVariant(ans: PatientAnswers): ContraindictionViolation | null {
  const age = parseInt(String(ans.age ?? '0'), 10);
  const isFemale = String(ans.sex ?? ans.gender ?? '').toLowerCase() === 'female';

  if (!isFemale || age >= 30) return null;

  return {
    ruleId: 'TC_004_PVR_001',
    name: 'FEMUGROW_MCRD_PREFER_MCR_UNDER_30',
    severity: 'PREFER_ALTERNATIVE',
    message:
      'Female patient under 30 — F-Emugrow MCR (without Dutasteride) is preferred over F-Emugrow MCRD. ' +
      'Dutasteride (0.5%) is not indicated for females under 30 whose follicles are not yet miniaturised enough for dual 5-alpha reductase blockade.',
    blockedTopicals: ['F-Emugrow MCRD'],
    allowedTopicals: ['F-Emugrow MCR'],
    clinicalRationale:
      'F-Emugrow MCR provides Redensyl 3% stem cell activation and Emu Oil penetration without Dutasteride. ' +
      'MCRD is appropriate once pattern miniaturisation is clinically confirmed (typically female 30+).',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates patient answers against all absolute contraindications and hard therapy blocks.
 *
 * Returns violations in severity order: HARD_STOP first, then ABSOLUTE, then CAUTION.
 * Callers MUST check hasHardStop before proceeding to recommendation logic.
 * If pregnancySingleKitLock is true, no kit other than HEALTHY-9 may be prescribed.
 */
export function validateContraindications(ans: PatientAnswers): ContraindictionResult {
  const violations: ContraindictionViolation[] = [];

  const pregnancy = checkPregnancy(ans);
  if (pregnancy) violations.push(pregnancy);

  const hypertension = checkHypertension(ans);
  if (hypertension) violations.push(hypertension);

  const maleUnder18 = checkMaleUnder18Finasteride(ans);
  if (maleUnder18) violations.push(maleUnder18);

  const oralMinoxidilAge = checkOralMinoxidilOver60(ans);
  if (oralMinoxidilAge) violations.push(oralMinoxidilAge);

  const emugrowVariant = checkEmugrowVariant(ans);
  if (emugrowVariant) violations.push(emugrowVariant);

  const hardStops = violations.filter(v => v.severity === 'HARD_STOP');
  const hasHardStop = hardStops.length > 0;

  const pregnancyLock = violations.find(v => v.ruleId === 'AC_001');
  const pregnancySingleKitLock = !!pregnancyLock;
  const allowedKitOverride = pregnancySingleKitLock ? ['HEALTHY - 9'] : undefined;

  return {
    hasHardStop,
    violations,
    pregnancySingleKitLock,
    allowedKitOverride,
  };
}

/**
 * Quick boolean check for pregnancy — used by topical auto-inject rules
 * to skip AUTO_01_FBIWASH and AUTO_02_EMUGROW_PATTERN.
 */
export function isPregnantOrPlanning(ans: PatientAnswers): boolean {
  const result = validateContraindications(ans);
  return result.violations.some(v =>
    v.ruleId === 'AC_001' || v.ruleId === 'AC_002'
  );
}

/**
 * Returns all topical product names that are blocked for this patient.
 * Aggregates across all violation types.
 */
export function getBlockedTopicals(ans: PatientAnswers): string[] {
  const { violations } = validateContraindications(ans);
  const blocked = new Set<string>();
  for (const v of violations) {
    if (v.severity === 'HARD_STOP' || v.severity === 'ABSOLUTE') {
      (v.blockedTopicals ?? []).forEach(t => blocked.add(t));
    }
  }
  return Array.from(blocked);
}
