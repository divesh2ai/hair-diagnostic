/**
 * Builds a ClinicalFacts object from raw PatientAnswers + the inferred
 * ClinicalProfile. This is the only place where questionnaire answers
 * are interpreted into evidence flags; downstream composers must read
 * facts from here rather than re-parse answer strings.
 */

import type { PatientAnswers, ScalpState } from '../../types';
import type { ClinicalProfile } from '../clinical-engine/types';
import type { ClinicalFacts, ReportedFindings, ClinicalInferences } from './types';

// ── Helpers ────────────────────────────────────────────────────────────────

function lowerAll(arr: readonly string[] | undefined): string[] {
  return (arr ?? []).map((s) => String(s).toLowerCase());
}

function anyMatch(arr: readonly string[] | undefined, re: RegExp): boolean {
  return lowerAll(arr).some((s) => re.test(s));
}

const NONE_RE = /^(none|no$|no\s|nothing|na\b|n\/a|normal\b|no\s+(scalp|symptom|issue|concern))/i;

function stripNone(arr: readonly string[] | undefined): string[] {
  return (arr ?? []).filter((s) => !NONE_RE.test(String(s)));
}

// ── Scalp mapping ──────────────────────────────────────────────────────────

const SCALP_PATTERNS: Array<{ state: ScalpState; re: RegExp }> = [
  { state: 'DANDRUFF',        re: /dandruff|flak/i },
  { state: 'OILY_SCALP',      re: /oily|seborrh|greasy/i },
  { state: 'DRY_SCALP',       re: /dry/i },
  { state: 'INFLAMED_SCALP',  re: /inflam|redness|burning|irritat|folliculit|boils/i },
  { state: 'PSORIATIC_SCALP', re: /psoriat/i },
  { state: 'SENSITIVE_SCALP', re: /sensitive/i },
];

function deriveScalpStates(ans: PatientAnswers): ScalpState[] {
  const raw = stripNone(ans.scalp);
  const detected = new Set<ScalpState>();
  for (const sig of raw) {
    for (const { state, re } of SCALP_PATTERNS) {
      if (re.test(sig)) detected.add(state);
    }
  }
  return Array.from(detected);
}

// ── Diet mapping ───────────────────────────────────────────────────────────

function deriveDiet(ans: PatientAnswers): ReportedFindings['diet'] {
  const raw = lowerAll(ans.diet).join(' | ');
  if (!raw) return 'UNKNOWN';
  if (/vegan/.test(raw)) return 'VEGAN';
  if (/jain/.test(raw)) return 'JAIN';
  if (/pescatar/.test(raw)) return 'PESCATARIAN';
  if (/vegetarian/.test(raw)) return 'VEGETARIAN';
  if (/irregular|outside|skipping|crash|restrict/.test(raw)) return 'IRREGULAR';
  if (/balanced|normal|omnivore|standard/.test(raw)) return 'NORMAL';
  return 'UNKNOWN';
}

// ── Builders ───────────────────────────────────────────────────────────────

function buildReported(ans: PatientAnswers, profile: ClinicalProfile): ReportedFindings {
  const scalpStates = deriveScalpStates(ans);
  const hasAnyNonNormalScalp = scalpStates.length > 0;
  const explicitNormal = anyMatch(ans.scalp, /^normal/i) || anyMatch(ans.scalp, /no\s+scalp/i);
  const hasNormalScalp = !hasAnyNonNormalScalp && (explicitNormal || (ans.scalp ?? []).length === 0);

  return {
    scalpStates,
    hasNormalScalp,

    hasStress:              anyMatch(ans.lifestyle, /stress|anxiet|burnout/i)
                            || anyMatch(ans.cause, /stress/i),
    hasPCOS:                anyMatch(ans.hormonal, /pcos|polycystic/i)
                            || anyMatch(ans.hormonal_issues, /pcos|polycystic/i),
    hasThyroidHistory:      Boolean(ans.thyroid)
                            && (Array.isArray(ans.thyroid)
                                ? ans.thyroid.some((s) => /hypo|hyper|hashimoto|graves|thyroid/i.test(String(s))
                                    && !/no$|none/i.test(String(s)))
                                : /hypo|hyper|hashimoto|graves|thyroid/i.test(String(ans.thyroid))
                                  && !/no$|none/i.test(String(ans.thyroid))),
    hasMetabolicHistory:    anyMatch(ans.hormonal, /diabet|prediabet|insulin|metabolic/i)
                            || (typeof ans.medical === 'string' && /diabet|insulin/i.test(ans.medical))
                            || anyMatch(ans.hormonal_issues, /diabet|insulin|metabolic/i),
    hasIronRisk:            anyMatch(ans.hormonal, /heavy bleed|heavy period|menorrhag/i)
                            || anyMatch(ans.deficiency, /iron|ferritin|anaem|anem/i),
    hasPostpartum:          anyMatch(ans.hormonal, /post.?partum|post.?delivery|breastfeed|lactat/i)
                            || anyMatch(ans.cause, /post.?partum|post.?delivery|breastfeed/i),
    hasMenopauseState:      anyMatch(ans.hormonal, /menopaus/i),
    hasGISymptoms:          anyMatch(ans.gut, /gerd|ibs|crohn|reflux|bloat|constipat|indigest|acidity/i),
    hasRecentIllness:       anyMatch(ans.cause, /illness|surgery|hospital|fever|infection/i)
                            || anyMatch(ans.treatment, /chemo|radiat/i),
    hasGLP1:                anyMatch(ans.treatment, /glp.?1|ozempic|wegovy|semaglutide|mounjaro|tirzepatide/i),
    hasRapidWeightLoss:     anyMatch(ans.cause, /rapid weight|crash diet|sudden weight/i)
                            || anyMatch(ans.lifestyle, /crash diet|rapid weight/i),
    hasCircadianDisruption: anyMatch(ans.lifestyle, /night.?shift|frequent fly|sleep|insomni|jet.?lag/i),
    hasOxidativeLoad:       anyMatch(ans.lifestyle, /smok|vap|alcohol|drink|pollution|hard water/i),
    hasFamilyHistory:       anyMatch(ans.cause, /family|hereditar|genetic/i)
                            || anyMatch(ans.hairtype, /family|hereditar/i),
    hasPullingBehaviour:    anyMatch(ans.cause, /pulling|trichotillomania|ttm/i),
    hasAutoimmune:          anyMatch(ans.immunity, /autoimmune|alopecia areata|vitiligo|lupus|psoriasis/i),

    diet: deriveDiet(ans),

    hasActiveShedding: profile.flags.hasActiveShedding,

    sex: deriveSex(ans, profile),
    isPregnant: Boolean(ans.is_pregnant),
    isPlanningPregnancy: Boolean(ans.planning_pregnancy),
  };
}

function deriveSex(ans: PatientAnswers, profile: ClinicalProfile): ReportedFindings['sex'] {
  const raw = String(ans.sex ?? ans.gender ?? '').toLowerCase();
  if (/female|f$|woman/i.test(raw)) return 'FEMALE';
  if (/male|m$|man/i.test(raw))     return 'MALE';
  // Fall back to the engine's flag when the raw answer is ambiguous.
  return profile.flags.isMale ? 'MALE' : 'FEMALE';
}

function buildInferred(profile: ClinicalProfile): ClinicalInferences {
  return {
    rootCauses: profile.rootCauses,
    primaryDiagnosis: profile.primaryDiagnosis,
    severity: profile.severity,
  };
}

// ── Public entry point ─────────────────────────────────────────────────────

export function buildClinicalFacts(
  ans: PatientAnswers,
  profile: ClinicalProfile,
): ClinicalFacts {
  return {
    reported: buildReported(ans, profile),
    inferred: buildInferred(profile),
  };
}

// ── FactKey resolver ───────────────────────────────────────────────────────

import type { FactKey } from './types';

/** Returns true iff the patient's facts support claiming the given key. */
export function hasFact(facts: ClinicalFacts, key: FactKey): boolean {
  const r = facts.reported;
  const i = facts.inferred;
  switch (key) {
    case 'scalp.dandruff':       return r.scalpStates.includes('DANDRUFF');
    case 'scalp.oily':           return r.scalpStates.includes('OILY_SCALP');
    case 'scalp.dry':            return r.scalpStates.includes('DRY_SCALP');
    case 'scalp.inflamed':       return r.scalpStates.includes('INFLAMED_SCALP');
    case 'scalp.psoriatic':      return r.scalpStates.includes('PSORIATIC_SCALP');
    case 'scalp.sensitive':      return r.scalpStates.includes('SENSITIVE_SCALP');
    case 'scalp.anyNonNormal':   return r.scalpStates.length > 0;
    case 'scalp.normal':         return r.hasNormalScalp;

    case 'history.stress':       return r.hasStress;
    case 'history.pcos':         return r.hasPCOS;
    case 'history.thyroid':      return r.hasThyroidHistory;
    case 'history.metabolic':    return r.hasMetabolicHistory;
    case 'history.ironRisk':     return r.hasIronRisk;
    case 'history.postpartum':   return r.hasPostpartum;
    case 'history.menopause':    return r.hasMenopauseState;
    case 'history.gi':           return r.hasGISymptoms;
    case 'history.illness':      return r.hasRecentIllness;
    case 'history.glp1':         return r.hasGLP1;
    case 'history.weightLoss':   return r.hasRapidWeightLoss;
    case 'history.circadian':    return r.hasCircadianDisruption;
    case 'history.oxidative':    return r.hasOxidativeLoad;
    case 'history.family':       return r.hasFamilyHistory;
    case 'history.pulling':      return r.hasPullingBehaviour;
    case 'history.autoimmune':   return r.hasAutoimmune;

    case 'diet.normal':          return r.diet === 'NORMAL';
    case 'diet.restricted':      return r.diet !== 'NORMAL' && r.diet !== 'UNKNOWN';

    case 'sex.male':              return r.sex === 'MALE';
    case 'sex.female':            return r.sex === 'FEMALE';
    case 'state.pregnant':        return r.isPregnant;
    case 'state.planningPregnancy': return r.isPlanningPregnancy;

    case 'inferred.dhtDriver':       return i.rootCauses.includes('DHT') || i.rootCauses.includes('GENETICS');
    case 'inferred.stressDriver':    return i.rootCauses.includes('STRESS');
    case 'inferred.nutritionDriver': return i.rootCauses.includes('POOR_NUTRITION') || i.rootCauses.includes('IRON_DEFICIENCY');
    case 'inferred.activeShedding':  return r.hasActiveShedding;
  }
}

export function hasAllFacts(facts: ClinicalFacts, keys: readonly FactKey[]): boolean {
  return keys.every((k) => hasFact(facts, k));
}
