// ─────────────────────────────────────────────────────────────────────────────
// Compose Monitoring Plan
//
// Aggregates baseline tests, follow-up tests, expected outcomes, warning signals,
// and escalation triggers from:
//   • therapy-engine/needsMatrix (per-therapy monitoring parameters)
//   • kb/ingredients/* (per-ingredient contraindications + side effects)
//   • kb/conditions/* (per-condition progression markers)
//   • cause + diagnosis context
//
// No new content authored at runtime — all output is a deterministic projection
// of existing structured knowledge.
// ─────────────────────────────────────────────────────────────────────────────

import type { ExplanationContext } from '../types';
import type { ComposeOptions, ComposedNarrative, ComposedSegment } from './types';
import { TARGET_CONSTRAINTS }      from './types';
import { INGREDIENTS_KB }          from '../../knowledge-engine/kb/ingredients';
import { CONDITIONS_KB }           from '../../knowledge-engine/kb/conditions';
import { KITS_KB }                 from '../../knowledge-engine/kb/kits';
import { buildComposedNarrative, makeSegment } from './_composeUtils';
import type { TherapyNeed, DiagnosisKey, IngredientKnowledge } from '../../knowledge-engine/types';

// ─── Therapy-need → monitoring guidance (canonical from needsMatrix) ──────────

const THERAPY_NEED_MONITORING: Partial<Record<TherapyNeed, {
  baseline: string[];
  followup: string[];
  outcomes: string[];
  warnings: string[];
  escalations: string[];
}>> = {
  DHT_SUPPRESSION: {
    baseline: ['Serum DHT, total testosterone, SHBG', 'PSA in males ≥ 40 years', 'Pregnancy status in females of reproductive age'],
    followup: ['Serum DHT at 12 weeks (target reduction ≥ 60%)', 'Hair shedding count and trichoscopy at 24 weeks'],
    outcomes: ['Halt of hairline progression', 'Stable sexual function PRO', 'Improved trichoscopy diameter diversity'],
    warnings: ['New sexual dysfunction', 'Mood changes', 'Gynecomastia'],
    escalations: ['Post-finasteride syndrome PRO → discontinue and refer to dermatology'],
  },
  INFLAMMATION_CONTROL: {
    baseline: ['hs-CRP', 'Scalp clinical photograph + erythema score', 'Pruritus VAS'],
    followup: ['Erythema score at 8 weeks', 'hs-CRP at 12 weeks'],
    outcomes: ['Reduced scalp redness and pruritus', 'Reduced systemic inflammatory markers'],
    warnings: ['New pustules', 'Rapid scalp lesion expansion', 'Signs of scarring (loss of ostia)'],
    escalations: ['Suspected scarring → dermatology referral for biopsy'],
  },
  METABOLIC_SUPPORT: {
    baseline: ['Fasting insulin', 'HbA1c', 'Lipid panel', 'Waist circumference'],
    followup: ['Repeat HbA1c and fasting insulin at 12 weeks'],
    outcomes: ['HbA1c reduction 0.3–0.5%', 'Improved HOMA-IR'],
    warnings: ['Hypoglycaemia if concurrent sulfonylureas/insulin'],
    escalations: ['Worsening glycaemic control → endocrinology referral'],
  },
  IRON_REPLETION: {
    baseline: ['Ferritin', 'CBC', 'Transferrin saturation'],
    followup: ['Ferritin at 8 and 12 weeks (target ≥ 40 ng/mL)'],
    outcomes: ['Ferritin improvement', 'Shedding reduction'],
    warnings: ['GI intolerance', 'Black/tarry stools'],
    escalations: ['Persistent low ferritin → GI workup'],
  },
  IMMUNE_MODULATION: {
    baseline: ['CBC', 'TSH and TPO antibodies', 'ANA if clinical suspicion', 'Vitamin D'],
    followup: ['Comorbidity reassessment at 12 weeks', 'SALT score in AA cases'],
    outcomes: ['Patch stabilisation or regrowth in AA', 'Reduced flare frequency'],
    warnings: ['Rapid disease extension', 'Onset of nail pitting', 'AT/AU conversion'],
    escalations: ['SALT > 50 or rapid progression → dermatology for JAK-inhibitor evaluation'],
  },
  HORMONAL_REBALANCING: {
    baseline: ['Free testosterone', 'SHBG', 'LH:FSH', 'Prolactin', 'TSH'],
    followup: ['Free androgens and SHBG at 12 weeks', 'Climacteric symptom score (MRS) if peri/post-meno'],
    outcomes: ['Reduced free androgens', 'Improved cycle regularity (PCOS)', 'Reduced climacteric symptoms (meno)'],
    warnings: ['Hyperkalaemia (spironolactone-class)', 'Pregnancy detected on anti-androgen'],
    escalations: ['Pregnancy planning → discontinue anti-androgens; gynae-endo referral'],
  },
  ANTIOXIDANT_SUPPORT: {
    baseline: ['Baseline oxidative-load risk assessment (smoking, sleep, BMI)'],
    followup: ['Subjective vitality PRO at 8 weeks'],
    outcomes: ['Reduced fatigue', 'Improved hair fragility PRO'],
    warnings: ['None routine'],
    escalations: ['Refractory greying or fragility → review systemic causes'],
  },
  GUT_RESTORATION: {
    baseline: ['Stool form (Bristol)', 'Subjective bloating PRO'],
    followup: ['GI symptom PRO at 4 and 12 weeks'],
    outcomes: ['Improved bowel regularity', 'Reduced bloating'],
    warnings: ['Worsening symptoms suggesting SIBO'],
    escalations: ['Suspected SIBO → GI referral; pause probiotic'],
  },
  THYROID_SUPPORT: {
    baseline: ['TSH', 'Free T4', 'TPO antibodies'],
    followup: ['TSH at 8–12 weeks'],
    outcomes: ['TSH normalisation', 'Reduced cold intolerance / fatigue'],
    warnings: ['Iodine excess in Hashimoto profile'],
    escalations: ['Persistent thyroid dysfunction → endocrinology'],
  },
  CIRCADIAN_RESET: {
    baseline: ['Sleep PRO (PSQI)', 'Subjective stress (PSS-10)'],
    followup: ['Sleep PRO at 4 weeks'],
    outcomes: ['Improved sleep onset and quality', 'Reduced perceived stress'],
    warnings: ['Excessive morning sedation'],
    escalations: ['Persistent insomnia or mood concern → mental health referral'],
  },
  SHAFT_REPAIR: {
    baseline: ['Hair tensile / fragility PRO', 'Brittleness assessment'],
    followup: ['Tensile PRO at 12 weeks'],
    outcomes: ['Reduced breakage', 'Improved shaft caliber'],
    warnings: [],
    escalations: [],
  },
  SHEDDING_ARREST: {
    baseline: ['Daily shed count', 'Pull test'],
    followup: ['Pull test and shed count at 12 weeks'],
    outcomes: ['Negative pull test by 12 weeks', 'Sustained reduction in daily shed'],
    warnings: ['Persistent shedding beyond 6 months'],
    escalations: ['Chronic TE workup; rule out concurrent driver'],
  },
  FOLLICLE_STIMULATION: {
    baseline: ['Trichoscopy', 'Hair diameter diversity'],
    followup: ['Trichoscopy at 24 weeks'],
    outcomes: ['Increased hair diameter', 'Density improvement'],
    warnings: ['Initial shedding phase (4–6 weeks; resolves)'],
    escalations: ['No response at 24 weeks → escalate topical / oral options'],
  },
  MELANOCYTE_PROTECTION: {
    baseline: ['Baseline greying assessment'],
    followup: ['Greying progression at 24 weeks'],
    outcomes: ['Slowed greying progression'],
    warnings: [],
    escalations: [],
  },
  ANDROGENIC_CORRECTION: {
    baseline: ['Free testosterone', 'DHEA-S', 'SHBG'],
    followup: ['Free androgens at 12 weeks'],
    outcomes: ['Reduced free androgens'],
    warnings: ['Menstrual irregularity changes'],
    escalations: ['Worsening hyperandrogenism → endocrinology'],
  },
  NEUROLOGICAL_OCD_SUPPORT: {
    baseline: ['PHQ-9, GAD-7', 'OCD symptom inventory'],
    followup: ['Repeat at 12 weeks'],
    outcomes: ['Reduced anxiety / OCD score'],
    warnings: ['Worsening mood symptoms'],
    escalations: ['Significant psychiatric symptoms → mental health referral'],
  },
  WEIGHT_LOSS_RECOVERY: {
    baseline: ['Weight, BMI, body composition', 'Ferritin, vitamin D, B12'],
    followup: ['Nutrient panel at 12 weeks'],
    outcomes: ['Nutrient repletion', 'Reduced shedding'],
    warnings: ['Continued rapid weight loss'],
    escalations: ['Refractory shedding → reassess GLP-1 regimen with prescriber'],
  },
  LACTATION_SUPPORT: {
    baseline: ['Maternal nutrient panel', 'Lactation comfort PRO'],
    followup: ['Nutrient panel at 12 weeks'],
    outcomes: ['Maintained lactation', 'Reduced post-partum shedding'],
    warnings: ['Inadequate milk supply'],
    escalations: ['Refer to lactation consultant'],
  },
  PREGNANCY_SUPPORT: {
    baseline: ['Pregnancy nutrient panel'],
    followup: ['Per obstetric schedule'],
    outcomes: ['Sustained nutritional adequacy'],
    warnings: ['Use only pregnancy-safe ingredients'],
    escalations: ['Coordinate with obstetrician'],
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function unique(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of arr) {
    const key = item.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item.trim());
  }
  return out;
}

function ingredientWarnings(ing: IngredientKnowledge): string[] {
  const warningPattern = /(palpitations|severe|seek medical|hypotension|hyperkalemia|hypoglycaemia|hypoglycemia|hepatotoxic|allergic|bleeding|chest pain|fluid retention)/i;
  return ing.sideEffects.filter((s) => warningPattern.test(s));
}

function ingredientEscalations(ing: IngredientKnowledge): string[] {
  if (ing.contraindications.length === 0) return [];
  return ing.contraindications
    .filter((c) => /pregnancy|cancer|severe|active|hepatic|renal|bleeding|disorder/i.test(c))
    .map((c) => `Contraindication trigger: ${c} → discontinue and reassess`);
}

// ─── Composer ─────────────────────────────────────────────────────────────────

export function composeMonitoringPlan(
  context: ExplanationContext,
  options: ComposeOptions = {}
): ComposedNarrative {
  const { clinicalProfile, therapyNeeds, kitRecommendation } = context;
  const target      = options.target  ?? 'doctor-dashboard';
  const constraints = TARGET_CONSTRAINTS[target];
  const length      = options.length  ?? constraints.defaultLength;
  const locale      = options.locale  ?? 'en';

  // ── 1. Aggregate from therapy needs ────────────────────────────────────────
  const baseline:    string[] = [];
  const followup:    string[] = [];
  const outcomes:    string[] = [];
  const warnings:    string[] = [];
  const escalations: string[] = [];

  for (const need of therapyNeeds.needs) {
    const monitor = THERAPY_NEED_MONITORING[need];
    if (!monitor) continue;
    baseline.push(...monitor.baseline);
    followup.push(...monitor.followup);
    outcomes.push(...monitor.outcomes);
    warnings.push(...monitor.warnings);
    escalations.push(...monitor.escalations);
  }

  // ── 2. Aggregate from kits → ingredients ───────────────────────────────────
  const kitIds = kitRecommendation?.kits?.map((k: { kitId: string }) => k.kitId) ?? [];
  const ingredientIds = new Set<string>();
  for (const kitId of kitIds) {
    const kit = KITS_KB[kitId];
    if (!kit) continue;
    for (const ingId of kit.keyIngredients) ingredientIds.add(ingId);
  }
  for (const ingId of ingredientIds) {
    const ing = INGREDIENTS_KB[ingId];
    if (!ing) continue;
    warnings.push(...ingredientWarnings(ing));
    escalations.push(...ingredientEscalations(ing));
  }

  // ── 3. Aggregate from condition KB ─────────────────────────────────────────
  const condition = CONDITIONS_KB[clinicalProfile.primaryDiagnosis as DiagnosisKey];
  if (condition) {
    // Progression markers become follow-up checkpoints
    for (const stage of condition.progression) {
      followup.push(`Watch for transition to ${stage.label.toLowerCase()}: ${stage.clinicalMarkers.slice(0, 2).join(', ')}`);
    }
    // Condition-level contraindications become escalation rules
    for (const contra of condition.contraindications) {
      if (contra.severity === 'ABSOLUTE' || contra.severity === 'RELATIVE') {
        escalations.push(`${contra.label} (${contra.severity.toLowerCase()}): ${contra.description}`);
      }
    }
    // Prognosis caveats surface as warnings
    for (const p of condition.prognosis) {
      if (p.caveat) warnings.push(p.caveat);
    }
  }

  // ── 4. Build labelled sections ─────────────────────────────────────────────
  const sectionDefs = [
    { label: 'Baseline Tests',     items: unique(baseline) },
    { label: 'Follow-Up Tests',    items: unique(followup) },
    { label: 'Expected Outcomes',  items: unique(outcomes) },
    { label: 'Warning Signals',    items: unique(warnings) },
    { label: 'Escalation Triggers', items: unique(escalations) },
    {
      label: 'Review Timeline',
      items: [
        'Week 4: tolerance check and adherence review',
        'Week 8: early-marker reassessment (shedding, scalp, sleep, stress)',
        'Week 12: mid-protocol biomarker reassessment per therapy needs',
        'Week 24: density / trichoscopy / outcome assessment',
      ],
    },
  ];

  const segments: ComposedSegment[] = sectionDefs
    .filter(({ items }) => items.length > 0)
    .map(({ label, items }) => {
      const text = items.map((i) => `• ${i}`).join('\n');
      return makeSegment(label, text);
    })
    .filter((s): s is ComposedSegment => s !== null);

  // Guarantee a non-degenerate narrative — adds a baseline review reminder when
  // upstream produced no actionable monitoring content (highly unusual but
  // possible for sparse profiles).
  if (segments.length === 0) {
    segments.push({
      label: 'Review Timeline',
      text:
        '• Week 4: tolerance and adherence review\n' +
        '• Week 8: early-marker reassessment\n' +
        '• Week 12: biomarker reassessment\n' +
        '• Week 24: outcome assessment',
    });
  }

  return buildComposedNarrative(segments, length, target, locale, constraints);
}
