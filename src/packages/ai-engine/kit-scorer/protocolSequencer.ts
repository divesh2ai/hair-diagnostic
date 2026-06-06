import type { DiagnosisKey } from '../../types';
import type { ProtocolEntry } from './types';

// Clinical protocol sequencer — extracted from PROTOCOL_SEQUENCER in DrFACT_revamp_v44.html.
// Maps every DiagnosisKey to its base kit sequence and clinical rationale.
// This data can be stored per-clinic in the database; the engine reads it at runtime.
export const PROTOCOL_SEQUENCER: Record<DiagnosisKey, ProtocolEntry> = {

  // ── TELOGEN EFFLUVIUM ──────────────────────────────────────────────────────
  TE_STRESS: {
    label: 'Telogen Effluvium (Stress / Anxiety / Depression)',
    rationale: 'TE GOLD stops active shedding first (non-negotiable Phase 1); Phenotype Inflammation clears the chronic stress-driven scalp inflammatory load in Phase 2',
    phases: ['HAIR FACT TE GOLD', 'PHENOTYPE INFLAMATION'],
  },
  TE_NUTRITION: {
    label: 'Telogen Effluvium (Nutritional deficiency)',
    rationale: 'Correct active shedding first; inflammation clears the residual nutritional-stress inflammatory load. PRO IMMUNE only if immunity flags are separately triggered',
    phases: ['HAIR FACT TE GOLD', 'PHENOTYPE INFLAMATION'],
  },
  TE_POSTPREG: {
    label: 'Telogen Effluvium (Post-pregnancy / Breastfeeding)',
    rationale: 'LACTIHEALTH first (breastfeeding nutritional demand is highest priority); TE GOLD stops shedding in Ph2; PRO IMMUNE rebuilds post-partum immunity in Ph3',
    phases: ['LACTIHEALTH', 'HAIR FACT TE GOLD', 'PRO IMMUNE GOLD'],
  },
  TE_DELIVERY: {
    label: 'Post-delivery / Not Breastfeeding',
    rationale: 'Post-natal TE shedding stopped first; PRO IMMUNE rebuilds immunity depleted by delivery',
    phases: ['HAIR FACT TE GOLD', 'PRO IMMUNE GOLD'],
  },
  TE_ILLNESS: {
    label: 'Telogen Effluvium (Illness / Surgery / Medication)',
    rationale: 'PRO IMMUNE GOLD first — post-illness inflammation must be cleared before TE kit can be effective; TE GOLD second; PHENOTYPE INFLAMATION third',
    phases: ['PRO IMMUNE GOLD', 'HAIR FACT TE GOLD', 'PHENOTYPE INFLAMATION'],
  },

  // ── MALE / FEMALE PATTERN HAIR LOSS ───────────────────────────────────────
  AGA_MALE_123: {
    label: 'Male Pattern Hair Loss — MPHL (Grade 1-2-3)',
    rationale: 'Phase 1 TE GOLD arrests active shedding; Phase 2 PHENOTYPE clears NF-kB/TNF-alpha inflammatory terrain so DHT-blockade nutrients can reach follicles; Phase 3 MPHL corrects DHT; Phase 4 META B corrects insulin-androgen axis; Phase 5 PRO IMMUNE last — nutritional regrowth supply into a clean environment',
    phases: ['HAIR FACT TE GOLD', 'PHENOTYPE INFLAMATION', 'MPHL', 'PRO FACT META B', 'PRO IMMUNE GOLD'],
  },
  AGA_MALE_45: {
    label: 'Male Pattern Hair Loss — MPHL (Grade 4-5 Advanced)',
    rationale: 'PRO IMMUNE primes follicle rescue environment first; MPHL DHT blockade second; PHENOTYPE INFLAMATION clears microenvironment in Phase 3',
    phases: ['PRO IMMUNE GOLD', 'MPHL', 'PHENOTYPE INFLAMATION'],
  },
  AGA_FEMALE_123: {
    label: 'Female Pattern Hair Loss — FPHL (Grade 1-2-3)',
    rationale: 'Phase 1 TE GOLD arrests shedding; Phase 2 PHENOTYPE clears inflammatory terrain; Phase 3 FPHL corrects androgenetic miniaturisation; Phase 4 META B corrects metabolic terrain; Phase 5 PRO IMMUNE last',
    phases: ['HAIR FACT TE GOLD', 'PHENOTYPE INFLAMATION', 'FPHL', 'PRO FACT META B', 'PRO IMMUNE GOLD'],
  },
  AGA_FEMALE_45: {
    label: 'Female Pattern Hair Loss — FPHL (Grade 4-5 Advanced)',
    rationale: 'PRO IMMUNE primes environment; FPHL corrects androgenetic pattern; PHENOTYPE INFLAMATION clears scalp microenvironment',
    phases: ['PRO IMMUNE GOLD', 'FPHL', 'PHENOTYPE INFLAMATION'],
  },

  // ── PCOS ──────────────────────────────────────────────────────────────────
  PCOS_ONLY: {
    label: 'PCOS — Hormonal Hair Loss',
    rationale: 'F-PCOS-1 corrects androgen excess and insulin-AMPK pathway (Phase 1); PHENOTYPE clears inflammation (Phase 2); TE GOLD addresses concurrent shedding (Phase 3)',
    phases: ['F-PCOS -1', 'PHENOTYPE INFLAMATION', 'HAIR FACT TE GOLD'],
  },
  PCOS_OBESITY: {
    label: 'PCOS + Metabolic (Insulin Resistance)',
    rationale: 'PRO FACT META B PCOS is the single primary kit — combines AMPK/insulin correction (Berberine) with androgen suppression (Inositol+D-Chiro+Spearmint). F-PCOS-1 NOT prescribed — duplicates ingredients entirely',
    phases: ['PRO FACT META B PCOS', 'PHENOTYPE INFLAMATION'],
  },

  // ── THYROID ───────────────────────────────────────────────────────────────
  THYROID_HYPO: {
    label: 'Thyroid (Hypothyroid)',
    rationale: 'Thyroid metabolic correction unlocks cellular metabolism first; PHENOTYPE clears hypothyroid-driven inflammation; TE GOLD stops concurrent diffuse shedding. OVERRIDE: if obesity/sedentary also present, PRO FACT META B (2-condition integrated kit) replaces PRO FACT META B HYPOTHYROID at runtime',
    phases: ['PRO FACT META B HYPOTHYROID', 'PHENOTYPE INFLAMATION', 'HAIR FACT TE GOLD'],
  },
  THYROID_HYPER: {
    label: 'Thyroid (Hyperthyroid)',
    rationale: 'PRO FACT THYROID CARE corrects hyperthyroid metabolic overactivity first; TE GOLD addresses concurrent diffuse shedding; PRO IMMUNE rebuilds immunity depleted by hyperthyroid-driven oxidative stress',
    phases: ['PRO FACT THYROID CARE', 'HAIR FACT TE GOLD', 'PRO IMMUNE GOLD'],
  },

  // ── ALOPECIA AREATA ───────────────────────────────────────────────────────
  ALOPECIA_AREATA: {
    label: 'Alopecia Areata (Autoimmune)',
    rationale: 'AA-specific kit (autoimmune hair loss first); META B supports metabolic terrain; PHENOTYPE clears inflammation; PRO IMMUNE rebuilds immune balance',
    phases: ['HAIR FACT ALOPECIA AREATA', 'PRO FACT META B', 'PHENOTYPE INFLAMATION', 'PRO IMMUNE GOLD'],
  },

  // ── PERI / MENO / POST-MENO ───────────────────────────────────────────────
  PERI_MENOPAUSE: {
    label: 'Peri-Menopause',
    rationale: 'PERI kit stabilises hormonal fluctuation first; FPHL corrects androgenetic pattern driven by oestrogen decline; TE GOLD stops active shedding; PRO IMMUNE last. PRO FACT META B injected at runtime when metabolic signals present',
    phases: ['HAIR FACT PERI MENOPAUSE', 'FPHL', 'HAIR FACT TE GOLD', 'PRO IMMUNE GOLD'],
  },
  MENOPAUSE: {
    label: 'Menopause',
    rationale: 'META B MENOPAUSE corrects sustained oestrogen decline and metabolic shift; FPHL corrects androgenetic pattern; TE GOLD addresses concurrent shedding',
    phases: ['PRO FACT META B MENOPAUSE', 'FPHL', 'HAIR FACT TE GOLD'],
  },
  POST_MENOPAUSE: {
    label: 'Post-Menopause',
    rationale: 'META B POSTMENOPAUSE corrects post-menopausal metabolic shift; FPHL corrects androgenetic pattern; TE GOLD addresses shedding; PRO IMMUNE last',
    phases: ['PRO FACT META B POSTMENOPAUSE', 'FPHL', 'HAIR FACT TE GOLD', 'PRO IMMUNE GOLD'],
  },

  // ── ENDOMETRIOSIS ─────────────────────────────────────────────────────────
  ENDOMETRIOSIS: {
    label: 'Endometriosis',
    rationale: 'FH WELL 3 targets endometriotic hormonal-inflammatory balance; PHENOTYPE clears systemic inflammation; PRO IMMUNE modulates immune response',
    phases: ['FH WELL 3', 'PHENOTYPE INFLAMATION', 'PRO IMMUNE GOLD'],
  },

  // ── PREGNANCY ─────────────────────────────────────────────────────────────
  PREGNANCY: {
    label: 'Pregnancy',
    rationale: 'HEALTHY-9 is PREGNANCY ONLY — single kit, no other kits prescribed during pregnancy',
    phases: ['HEALTHY - 9'],
  },

  // ── IRON DEFICIENCY ───────────────────────────────────────────────────────
  IRON_DEFICIENCY: {
    label: 'Iron Deficiency / Anaemia',
    rationale: 'IRON UP GOLD restores ferritin first (non-negotiable); TE GOLD stops shedding once iron is corrected; PRO IMMUNE explicitly indicated for iron deficiency cases',
    phases: ['IRON UP GOLD', 'HAIR FACT TE GOLD', 'PRO IMMUNE GOLD'],
  },

  // ── SCALP INFLAMMATION ────────────────────────────────────────────────────
  SCALP_INFLAM: {
    label: 'Scalp Inflammation (Dandruff / Oily / Seborrhoea)',
    rationale: 'Inflammation must be cleared before AGA correction; AGA_GENDER resolves to MPHL or FPHL at runtime',
    phases: ['PHENOTYPE INFLAMATION', 'AGA_GENDER'],
  },

  // ── HAIR BREAKAGE ─────────────────────────────────────────────────────────
  HAIR_BREAKAGE: {
    label: 'Hair Breakage (Chemical / Heat / Hard water)',
    rationale: 'HBR repairs shaft damage first; PHENOTYPE clears scalp inflammation',
    phases: ['HAIR FACT HAIR BREAKAGE REPAIR(HBR)', 'PHENOTYPE INFLAMATION'],
  },

  // ── NIGHT SHIFT ───────────────────────────────────────────────────────────
  NIGHT_SHIFT: {
    label: 'Night Shift / Circadian Disruption',
    rationale: 'Circadian reset is the primary driver (NIGHT SHIFT first); TE GOLD repairs concurrent shedding; PHENOTYPE clears oxidative/inflammatory load from chronic sleep disruption',
    phases: ['HAIR FACT NIGHT SHIFT', 'HAIR FACT TE GOLD', 'PHENOTYPE INFLAMATION'],
  },

  // ── FREQUENT FLYING ───────────────────────────────────────────────────────
  FREQUENT_FLYING: {
    label: 'Frequent Flying / Circadian + Immune Stress',
    rationale: 'Circadian and travel stress corrected first (FREQUENT FLYERS); TE GOLD repairs concurrent shedding; PHENOTYPE clears cabin radiation and passive smoke oxidative load',
    phases: ['HAIR FACT FREQUENT FLYERS', 'HAIR FACT TE GOLD', 'PHENOTYPE INFLAMATION'],
  },

  // ── OXIDATIVE STRESS ──────────────────────────────────────────────────────
  OXIDATIVE: {
    label: 'Smoking / Alcohol / Vaping / Oxidative Stress',
    rationale: 'PHENOTYPE INFLAMATION enables the OXIDATIVE STRESS kit; PRO IMMUNE rebuilds immune defence depleted by chronic oxidative load',
    phases: ['PHENOTYPE INFLAMATION', 'OXIDATIVE STRESS', 'PRO IMMUNE GOLD'],
  },

  // ── RAPID WEIGHT LOSS ─────────────────────────────────────────────────────
  WEIGHT_LOSS: {
    label: 'Sudden Weight Loss (Crash diet / GLP-1 / Illness)',
    rationale: 'RAPID WEIGHT LOSS SHIELD arrests shedding at the GLP-1/nutrient-deficit trigger level; TE GOLD used in reduced scope (Phase 2) — iron/ferritin repletion + residual stress-TE support only (avoid ingredient overlap); PRO IMMUNE rebuilds immunity depleted by rapid nutrient loss',
    phases: ['RAPID WEIGHT LOSS SHIELD', 'HAIR FACT TE GOLD', 'PRO IMMUNE GOLD'],
  },

  // ── TRICHOTILLOMANIA ──────────────────────────────────────────────────────
  TTM: {
    label: 'Trichotillomania (Hair Pulling / OCD)',
    rationale: 'TTM kit (NAC+Inositol+Magnesium+B6+Zinc+Ashwagandha) addresses neurological OCD-driven pulling urge first; TE GOLD repairs follicle damage and shedding caused by repeated pulling; PHENOTYPE clears scalp trauma-induced inflammatory load',
    phases: ['HAIR FACT TTM (OCD)', 'HAIR FACT TE GOLD', 'PHENOTYPE INFLAMATION'],
  },

  // ── CHRONIC MEDICAL ───────────────────────────────────────────────────────
  CHRONIC_MEDICAL: {
    label: 'Chronic Medical Condition (BP / other)',
    rationale: 'PRO IMMUNE rebuilds immune resilience first (chronic medication often depletes immunity); PHENOTYPE clears chronic inflammation. PRO FACT META B added only when true metabolic signal is present',
    phases: ['PRO IMMUNE GOLD', 'PHENOTYPE INFLAMATION'],
  },

  // ── DIABETES ──────────────────────────────────────────────────────────────
  DIABETES: {
    label: 'Diabetes / Pre-Diabetes (Metabolic Hair Loss)',
    rationale: 'META B corrects insulin-AMPK pathway first; PHENOTYPE clears hyperglycaemia-driven chronic low-grade inflammation; PRO IMMUNE rebuilds immune resilience',
    phases: ['PRO FACT META B', 'PHENOTYPE INFLAMATION', 'PRO IMMUNE GOLD'],
  },

  // ── GUT ISSUES ────────────────────────────────────────────────────────────
  GUT_ISSUES: {
    label: 'Gut Issues (GERD / IBS / Bloating / Crohn\'s)',
    rationale: 'GI GOLD clears gut-hair axis first; PHENOTYPE addresses gut-driven systemic inflammation; PRO IMMUNE rebuilds gut-depleted immunity; TE GOLD addresses TE shedding last once gut absorption is restored',
    phases: ['PRO FACT GI GOLD', 'PHENOTYPE INFLAMATION', 'PRO IMMUNE GOLD', 'HAIR FACT TE GOLD'],
  },

  // ── MOUTH ULCERS ──────────────────────────────────────────────────────────
  MOUTH_ULCERS: {
    label: 'Mouth / Tongue Ulcers (Immune-Gut link)',
    rationale: 'Gut-immune inflammation cleared first; PRO IMMUNE rebuilds defence and reduces recurrent mucosal inflammation; OXIDATIVE STRESS kit addresses free radical load driving ulceration',
    phases: ['PHENOTYPE INFLAMATION', 'PRO IMMUNE GOLD', 'OXIDATIVE STRESS'],
  },

  // ── MULTI-FACTORIAL ───────────────────────────────────────────────────────
  MULTI: {
    label: 'Multi-factorial (Stress + Gut + Pattern combined)',
    rationale: 'Inflammation is the universal terrain for multi-factorial — always Phase 1; TE GOLD stops active shedding; GI GOLD restores absorption; AGA_GENDER corrects pattern loss last',
    phases: ['PHENOTYPE INFLAMATION', 'HAIR FACT TE GOLD', 'PRO FACT GI GOLD', 'AGA_GENDER'],
  },

  // ── EARLY GREYING ─────────────────────────────────────────────────────────
  EARLY_GREY: {
    label: 'Early / Premature Greying',
    rationale: 'EARLY GREYING CARE corrects root cause and specific nutritional deficiencies; OXIDATIVE STRESS addresses free radical damage driving premature pigment loss; PRO IMMUNE builds immunity to protect melanocytes',
    phases: ['EARLY GREYING CARE GOLD', 'OXIDATIVE STRESS', 'PRO IMMUNE GOLD'],
  },

  // ── REGROW ONLY ───────────────────────────────────────────────────────────
  REGROW_ONLY: {
    label: 'Hair Regrowth — Active Shedding Stopped',
    rationale: 'No active shedding — TE GOLD is NEVER prescribed. PRO IMMUNE stimulates follicle re-entry into anagen (EGF/Colostrum/Lactoferrin); PHENOTYPE clears residual scalp inflammation blocking new growth; META B corrects metabolic terrain sustaining dormancy',
    phases: ['PRO IMMUNE GOLD', 'PHENOTYPE INFLAMATION', 'PRO FACT META B'],
  },
};
