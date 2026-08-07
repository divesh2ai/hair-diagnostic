import type { KitId } from '../../../types';

// ─────────────────────────────────────────────────────────────────────────────
// Kit prioritisation — clinical product sequencing rule (locked).
//
//   Principle: Root cause first → hormonal driver → terrain → metabolic →
//              cycle stabilisation → pattern correction.
//              (Menopause continuum is a hormonal DRIVER, not an age-related
//              afterthought — it precedes phenotype/META B when present.)
//
//   Order (head → tail):
//     0. ROOT-CAUSE HEAD — ALWAYS lead when present:
//          • HAIR FACT ALOPECIA AREATA   (autoimmune root cause)
//          • HAIR FACT TTM (OCD)         (behavioural / neuro root cause)
//        Terrain and absorption kits sit beneath the root-cause correction.
//
//     1. HORMONAL KITS (menopause continuum) — placed AFTER root-cause and
//        acute-trigger heads but BEFORE phenotype / disease / META B.
//        Rationale: perimenopausal / menopausal endocrine shift is itself the
//        driver — inflammation and metabolic correction chase this driver.
//
//     2. PHENOTYPE INFLAMATION      — clears the inflammatory terrain so
//                                     downstream therapy can take hold.
//
//     2. DISEASE KITS (in this order, irrespective of major concern):
//          a. PRO FACT META B PCOS      — PCOS metabolic+androgen kit
//          b. F-PCOS -1 / F-PCOS VEG -1 — PCOS standalone
//          c. PRO FACT META B HYPOTHYROID — thyroid metabolic kit
//          d. PRO FACT THYROID CARE     — hyperthyroid
//        Rule: PCOS variants always precede thyroid variants.
//
//     3. PRO FACT META B (generic)   — generic metabolic correction; when no
//                                      disease-specific META B variant is
//                                      present this leads everything after
//                                      PHENOTYPE (or first absolutely when no
//                                      inflammation and no acute shedding).
//
//     4. HAIR FACT TE GOLD           — telogen arrest. ALWAYS precedes
//                                      PRO IMMUNE: shedding must be stabilised
//                                      before immune consolidation.
//     5. PRO IMMUNE 5V (GOLD / VEG)  — immune restoration after TE arrest.
//
//     6. AGE-RELATED HORMONAL KITS:
//          a. HAIR FACT PERI MENOPAUSE
//          b. PRO FACT META B MENOPAUSE / POSTMENOPAUSE
//        Rule: these come AFTER disease kits because disease is treated first.
//
//     7. Upstream support  — GI GOLD, IRON UP.
//     8. Other kits        — preserved relative order.
//     9. FPHL / MPHL       — pattern correction is ALWAYS LAST.
//
// Exceptions:
//   • Acute shedding (duration ≤ 3 months) AND inflammation
//       → TE GOLD leads (clinical urgency), THEN PHENOTYPE INFLAMATION,
//         THEN disease kits, THEN META B, etc.
//   • Acute shedding (duration ≤ 3 months) AND no inflammation
//       → TE GOLD leads, then disease kits, then META B, etc.
//   • No acute shedding AND no inflammation
//       → META B (disease variant first, else generic) leads absolutely.
// ─────────────────────────────────────────────────────────────────────────────

// Disease-priority kits (locked clinical rule):
// Disease tier = Thyroid + PCOS/PMOS + Menopause continuum only.
// PCOS variants precede Thyroid variants. F-PCOS -1 retired — META B PCOS replaces it.
const DISEASE_KITS: KitId[] = [
  'PRO FACT META B PCOS',
  'PRO FACT META B HYPOTHYROID',
  'PRO FACT THYROID CARE',
];

// Endometriosis is a dedicated hormonal-inflammatory root-cause kit.
const ENDOMETRIOSIS_KITS: KitId[] = [
  'FH WELL 3',
];

// Root-cause kits that lead absolutely — placed at the very head of every
// branch. Post-hysterectomy reset leads whenever selected so surgical recovery
// and abrupt endocrine transition are addressed before downstream support.
const ROOT_CAUSE_HEAD: KitId[] = [
  'PRO FACT POST HYSTERECTOMY RESET',
  'HAIR FACT ALOPECIA AREATA',
  'HAIR FACT TTM (OCD)',
];

// LACTIHEALTH and RAPID WEIGHT LOSS SHIELD are acute-trigger Phase-1 kits.
// They sit at the very head (right after root-cause AA) because the upstream
// trigger they target (lactation demand, GLP-1 / nutrient deficit) is the
// causal driver that must be stabilised before terrain or pattern correction.
//
// LACTIHEALTH is a hard absolute — pregnant / breastfeeding patients always
// get it first, regardless of any other rule. RAPID WEIGHT LOSS SHIELD is
// second by default, but when the patient reports acute shedding driven by
// Stress / Anxiety, TE GOLD is lifted between LACTIHEALTH and RWL (locked
// clinical rule 2026-07-08 — the psychogenic driver has to be arrested
// before nutrient rescue can hold).
const LACTIHEALTH_HEAD: KitId[] = ['LACTIHEALTH'];
const RAPID_WEIGHT_LOSS_HEAD: KitId[] = ['RAPID WEIGHT LOSS SHIELD'];
const ACUTE_TRIGGER_HEAD: KitId[] = [
  'LACTIHEALTH',
  'RAPID WEIGHT LOSS SHIELD',
];

// GI GOLD always leads Phase 1 when present (locked clinical rule), unless a
// root-cause kit is present in which case GI GOLD sits immediately after it.
// Gut-axis correction precedes terrain/nutrient kits because absorption gates
// every downstream nutrient kit.
const GI_GOLD_HEAD: KitId[] = [
  'PRO FACT GI GOLD',
  'PRO FACT GI GOLD VEG',
];

// IRON UP GOLD head position — activated only when the patient declared
// Heavy menstrual bleeding (chronic iron loss). Sits immediately after GI GOLD
// because absorption-restoration still precedes iron-uptake.
const IRON_UP_HEAD: KitId[] = ['IRON UP GOLD'];

// Generic metabolic kit.
const META_B_GENERIC: KitId[] = [
  'PRO FACT META B',
];

// Telogen-effluvium arrest — ALWAYS sits between META B and PRO IMMUNE.
// Shedding must be stabilised before immune consolidation can take hold.
const TE_GOLD_KITS: KitId[] = [
  'HAIR FACT TE GOLD',
  'HAIR FACT TE GOLD VEG',
];

// Immune restoration (Pro Immune 5V family).
const PRO_IMMUNE: KitId[] = [
  'PRO IMMUNE GOLD',
  'PRO IMMUNE VEG',
];

// Hormonal-driver kits — menopause continuum. Placed BEFORE phenotype and
// disease kits when present, because the endocrine shift is the causal driver
// that inflammation and metabolic correction chase.
const HORMONAL_KITS: KitId[] = [
  'HAIR FACT PERI MENOPAUSE',
  'HAIR FACT PERI MENOPAUSE VEG',
  'PRO FACT META B POSTMENOPAUSE',
  'PRO FACT META B MENOPAUSE',
];

// Mid-tier (upstream support). TE GOLD is no longer here — it's in the head
// right before PRO IMMUNE so shedding arrest always precedes immune restoration.
// GI GOLD moved to head (Phase 1) per locked clinical rule.
const MID_SUPPORT: KitId[] = [
  'IRON UP GOLD',
];

// Pattern correction — always last.
const PATTERN_KITS_LAST: KitId[] = [
  'FPHL',
  'FPHL PLUS',
  'FPHL VEG',
  'MPHL',
  'MPHL PLUS',
];

function isPatternKit(k: KitId): boolean {
  return PATTERN_KITS_LAST.includes(k) || /^(MPHL|FPHL)(\s|$|\sPLUS|\sVEG)/.test(k);
}

export function prioritizeKits(
  phases: KitId[],
  teGoldKit: KitId,
  duration?: string,
  /** When true, IRON UP GOLD is lifted to the head (right after GI GOLD).
   *  Set by buildKitSequence when the patient declares Iron / Anaemia
   *  deficiency or Heavy menstrual bleeding; ferritin repletion is Phase 1. */
  liftIronUpToHead: boolean = false,
  /** When true, TE GOLD is lifted between LACTIHEALTH and RAPID WEIGHT LOSS
   *  SHIELD in the acute branches. Set by buildKitSequence when the patient
   *  is in the ≤3-month acute window AND declared Stress or Anxiety —
   *  psychogenic shedding takes head priority over nutrient rescue. */
  liftTeGoldForStress: boolean = false,
  /** When true, PHENOTYPE INFLAMATION is driven purely by oxidative-lifestyle
   *  signals (Smoking / Vaping / Alcohol) with no visible scalp condition and
   *  no active shedding. META B leads (metabolic-systemic root), PHENOTYPE
   *  clears residual inflammation, PRO IMMUNE consolidates, MPHL / FPHL last.
   *  Set by buildKitSequence — locked clinical rule. */
  oxidativeOnlyInflammation: boolean = false,
): KitId[] {
  const isAcuteShedding = !!duration && /1[–-]3|0[–-]3|under 3|less than 3/i.test(duration);
  const phenotypePresent = phases.includes('PHENOTYPE INFLAMATION');
  const ironUpInjection = liftIronUpToHead ? IRON_UP_HEAD : [];
  const teGoldStressLift: KitId[] = liftTeGoldForStress ? [teGoldKit] : [];

  // Compute the head of the sequence according to the clinical rule.
  //
  //   Acute shedding + inflammation     → TE GOLD leads (clinical urgency),
  //                                       then PHENOTYPE, then disease + META B.
  //   Acute shedding + no inflammation  → TE GOLD leads, then disease + META B.
  //   Inflammation only (not acute)     → PHENOTYPE leads, then disease + META B.
  //   No inflammation + no acute        → META B leads absolutely (disease
  //                                       variants first, then generic).
  // TE GOLD is always placed BEFORE PRO IMMUNE — shedding stabilisation
  // precedes immune consolidation. When acute shedding is the clinical
  // urgency, TE GOLD jumps to head 1; otherwise it sits between META B and
  // PRO IMMUNE in every branch.
  const head: KitId[] = (() => {
    if (isAcuteShedding && phenotypePresent) {
      return [
        ...ROOT_CAUSE_HEAD,
        ...LACTIHEALTH_HEAD,
        ...teGoldStressLift,
        ...RAPID_WEIGHT_LOSS_HEAD,
        ...GI_GOLD_HEAD,
        ...ironUpInjection,
        teGoldKit,
        ...HORMONAL_KITS,
        'PHENOTYPE INFLAMATION',
        ...ENDOMETRIOSIS_KITS,
        ...DISEASE_KITS,
        ...META_B_GENERIC,
        ...PRO_IMMUNE,
      ];
    }
    if (isAcuteShedding && !phenotypePresent) {
      return [
        ...ROOT_CAUSE_HEAD,
        ...LACTIHEALTH_HEAD,
        ...teGoldStressLift,
        ...RAPID_WEIGHT_LOSS_HEAD,
        ...GI_GOLD_HEAD,
        ...ironUpInjection,
        teGoldKit,
        ...HORMONAL_KITS,
        ...ENDOMETRIOSIS_KITS,
        ...DISEASE_KITS,
        ...META_B_GENERIC,
        ...PRO_IMMUNE,
      ];
    }
    if (phenotypePresent) {
      // Oxidative-only inflammation branch — META B leads BEFORE PHENOTYPE
      // because the driver is a systemic metabolic root, not a localised scalp
      // condition. Sequence: DISEASE (if any) → META B → PHENOTYPE → PRO IMMUNE.
      if (oxidativeOnlyInflammation) {
        return [
          ...ROOT_CAUSE_HEAD,
          ...ACUTE_TRIGGER_HEAD,
          ...GI_GOLD_HEAD,
          ...ironUpInjection,
          ...HORMONAL_KITS,
          ...ENDOMETRIOSIS_KITS,
          ...DISEASE_KITS,
          ...META_B_GENERIC,
          'PHENOTYPE INFLAMATION',
          ...TE_GOLD_KITS,
          ...PRO_IMMUNE,
        ];
      }
      return [
        ...ROOT_CAUSE_HEAD,
        ...ACUTE_TRIGGER_HEAD,
        ...GI_GOLD_HEAD,
        ...ironUpInjection,
        ...HORMONAL_KITS,
        ...ENDOMETRIOSIS_KITS,
        'PHENOTYPE INFLAMATION',
        ...DISEASE_KITS,
        ...META_B_GENERIC,
        ...TE_GOLD_KITS,
        ...PRO_IMMUNE,
      ];
    }
    // No inflammation, not acute → AA/TTM, GI GOLD, IRON UP (if lifted), hormonal, then META B + disease; TE GOLD then PRO IMMUNE.
    return [
      ...ROOT_CAUSE_HEAD,
      ...ACUTE_TRIGGER_HEAD,
      ...GI_GOLD_HEAD,
      ...ironUpInjection,
      ...HORMONAL_KITS,
      ...ENDOMETRIOSIS_KITS,
      ...DISEASE_KITS,
      ...META_B_GENERIC,
      ...TE_GOLD_KITS,
      ...PRO_IMMUNE,
    ];
  })();

  const PRIORITY_ORDER: KitId[] = [...head, ...MID_SUPPORT];

  const prioritized: KitId[] = [];
  const remaining = [...phases];

  // Lift kits in clinical priority order.
  for (const kitName of PRIORITY_ORDER) {
    const idx = remaining.indexOf(kitName);
    if (idx >= 0) {
      const removed = remaining.splice(idx, 1);
      if (removed[0] !== undefined) prioritized.push(removed[0]);
    }
  }

  // Split remaining into "other" and "pattern" (must go last).
  const others: KitId[] = [];
  const patterns: KitId[] = [];
  for (const k of remaining) {
    if (isPatternKit(k)) patterns.push(k);
    else others.push(k);
  }

  return [...prioritized, ...others, ...patterns];
}

export type KitBucket =
  | 'ROOT_CAUSE_HEAD'
  | 'ACUTE_TRIGGER_HEAD'
  | 'GI_GOLD_HEAD'
  | 'IRON_UP_HEAD'
  | 'ENDOMETRIOSIS_KITS'
  | 'DISEASE_KITS'
  | 'HORMONAL_KITS'
  | 'PHENOTYPE_INFLAMATION'
  | 'META_B_GENERIC'
  | 'TE_GOLD_KITS'
  | 'PRO_IMMUNE'
  | 'MID_SUPPORT'
  | 'PATTERN_KITS_LAST';

const PHENOTYPE_KITS: KitId[] = ['PHENOTYPE INFLAMATION'];

const DIAGNOSTICS_PRIORITY_ORDER: readonly KitId[] = [
  ...ROOT_CAUSE_HEAD,
  ...ACUTE_TRIGGER_HEAD,
  ...GI_GOLD_HEAD,
  ...IRON_UP_HEAD,
  ...HORMONAL_KITS,
  ...ENDOMETRIOSIS_KITS,
  ...PHENOTYPE_KITS,
  ...DISEASE_KITS,
  ...META_B_GENERIC,
  ...TE_GOLD_KITS,
  ...PRO_IMMUNE,
  ...MID_SUPPORT,
  ...PATTERN_KITS_LAST,
];

export interface PriorityDiagnostics {
  bucket: KitBucket | null;
  priorityOrderIndex?: number;
}

export function getPriorityDiagnostics(kitId: KitId): PriorityDiagnostics {
  const idx = DIAGNOSTICS_PRIORITY_ORDER.indexOf(kitId);
  let bucket: KitBucket | null = null;
  if (ROOT_CAUSE_HEAD.includes(kitId)) bucket = 'ROOT_CAUSE_HEAD';
  else if (ACUTE_TRIGGER_HEAD.includes(kitId)) bucket = 'ACUTE_TRIGGER_HEAD';
  else if (GI_GOLD_HEAD.includes(kitId)) bucket = 'GI_GOLD_HEAD';
  else if (IRON_UP_HEAD.includes(kitId)) bucket = 'IRON_UP_HEAD';
  else if (ENDOMETRIOSIS_KITS.includes(kitId)) bucket = 'ENDOMETRIOSIS_KITS';
  else if (DISEASE_KITS.includes(kitId)) bucket = 'DISEASE_KITS';
  else if (HORMONAL_KITS.includes(kitId)) bucket = 'HORMONAL_KITS';
  else if (PHENOTYPE_KITS.includes(kitId)) bucket = 'PHENOTYPE_INFLAMATION';
  else if (META_B_GENERIC.includes(kitId)) bucket = 'META_B_GENERIC';
  else if (TE_GOLD_KITS.includes(kitId)) bucket = 'TE_GOLD_KITS';
  else if (PRO_IMMUNE.includes(kitId)) bucket = 'PRO_IMMUNE';
  else if (MID_SUPPORT.includes(kitId)) bucket = 'MID_SUPPORT';
  else if (PATTERN_KITS_LAST.includes(kitId) || isPatternKit(kitId)) {
    bucket = 'PATTERN_KITS_LAST';
  }
  return {
    bucket,
    priorityOrderIndex: idx === -1 ? undefined : idx,
  };
}
