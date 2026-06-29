import type { KitId } from '../../../types';

// ─────────────────────────────────────────────────────────────────────────────
// Kit prioritisation — clinical product sequencing rule (locked).
//
//   Principle: Disease is always treated before age-related hormonal change.
//
//   Order (head → tail):
//     0. HAIR FACT ALOPECIA AREATA  — root-cause autoimmune kit. ALWAYS leads
//                                     when present; terrain and absorption
//                                     kits only sit beneath the root-cause
//                                     correction for an AA diagnosis.
//
//     1. PHENOTYPE INFLAMATION      — first when present and no root-cause
//                                     kit is leading (clear the inflammatory
//                                     terrain so downstream therapy can take
//                                     hold).
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
// branch. These target a specific aetiology (autoimmune AA) that must drive
// the protocol over any terrain or absorption kit.
const ROOT_CAUSE_HEAD: KitId[] = [
  'HAIR FACT ALOPECIA AREATA',
];

// LACTIHEALTH and RAPID WEIGHT LOSS SHIELD are acute-trigger Phase-1 kits.
// They sit at the very head (right after root-cause AA) because the upstream
// trigger they target (lactation demand, GLP-1 / nutrient deficit) is the
// causal driver that must be stabilised before terrain or pattern correction.
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

// Age-related hormonal kits — strictly AFTER disease kits.
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
   *  Set by scoreKits when the patient declared Heavy menstrual bleeding —
   *  active iron loss makes ferritin repletion a Phase-1 priority. */
  liftIronUpToHead: boolean = false,
): KitId[] {
  const isAcuteShedding = !!duration && /1[–-]3|0[–-]3|under 3|less than 3/i.test(duration);
  const phenotypePresent = phases.includes('PHENOTYPE INFLAMATION');
  const ironUpInjection = liftIronUpToHead ? IRON_UP_HEAD : [];

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
        ...ACUTE_TRIGGER_HEAD,
        ...GI_GOLD_HEAD,
        ...ironUpInjection,
        teGoldKit,
        'PHENOTYPE INFLAMATION',
        ...ENDOMETRIOSIS_KITS,
        ...DISEASE_KITS,
        ...META_B_GENERIC,
        ...PRO_IMMUNE,
        ...HORMONAL_KITS,
      ];
    }
    if (isAcuteShedding && !phenotypePresent) {
      return [
        ...ROOT_CAUSE_HEAD,
        ...ACUTE_TRIGGER_HEAD,
        ...GI_GOLD_HEAD,
        ...ironUpInjection,
        teGoldKit,
        ...ENDOMETRIOSIS_KITS,
        ...DISEASE_KITS,
        ...META_B_GENERIC,
        ...PRO_IMMUNE,
        ...HORMONAL_KITS,
      ];
    }
    if (phenotypePresent) {
      return [
        ...ROOT_CAUSE_HEAD,
        ...ACUTE_TRIGGER_HEAD,
        ...GI_GOLD_HEAD,
        ...ironUpInjection,
        ...ENDOMETRIOSIS_KITS,
        'PHENOTYPE INFLAMATION',
        ...DISEASE_KITS,
        ...META_B_GENERIC,
        ...TE_GOLD_KITS,
        ...PRO_IMMUNE,
        ...HORMONAL_KITS,
      ];
    }
    // No inflammation, not acute → AA, GI GOLD, IRON UP (if lifted), META B + disease; TE GOLD then PRO IMMUNE.
    return [
      ...ROOT_CAUSE_HEAD,
      ...ACUTE_TRIGGER_HEAD,
      ...GI_GOLD_HEAD,
      ...ironUpInjection,
      ...ENDOMETRIOSIS_KITS,
      ...DISEASE_KITS,
      ...META_B_GENERIC,
      ...TE_GOLD_KITS,
      ...PRO_IMMUNE,
      ...HORMONAL_KITS,
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
