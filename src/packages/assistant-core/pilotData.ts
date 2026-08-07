export type PilotComponent = {
  productId: string;
  productName: string;
  schedule: string;
  sourceRow: number;
};

export type PilotKit = {
  id: string;
  name: string;
  aliases: string[];
  mrp: number;
  purpose: string;
  components: PilotComponent[];
};

const c = (productId: string, productName: string, schedule: string, sourceRow: number): PilotComponent => ({
  productId,
  productName,
  schedule,
  sourceRow,
});

export const PILOT_SOURCE = {
  file: "DrFACT_RAG_Pilot_Knowledge_Master_v0.1.xlsx",
  kitSheet: "Kits",
  componentSheet: "Kit Components",
  status: "PROVISIONAL",
  knowledgeStatus: "MEDICAL_REVIEW",
} as const;

export const PILOT_KITS: PilotKit[] = [
  {
    id: "KIT_TE_GOLD", name: "TE GOLD", aliases: ["TE", "TE Gold"], mrp: 2818,
    purpose: "A stabilisation-oriented pilot kit described for telogen-effluvium support; it does not determine whether the kit is suitable for a particular patient.",
    components: [
      c("F_IMMUSURGE", "F-IMMUSurge", "Monday and Thursday", 361),
      c("F_TRICHORISE", "F-TRICHORISE", "Monday and Thursday", 362),
      c("F_LACTOCOL", "F-LACTOCOL", "Tuesday and Friday", 363),
      c("F_TRICHO_FERRUM", "F-TRICHO FERRUM", "Tuesday and Friday", 364),
      c("F_TRICHO_STRONG", "F-TRICHO STRONG", "Wednesday and Saturday", 365),
      c("F_TRICHO_CUMIN", "F-TRICHO CUMIN", "Wednesday and Saturday", 366),
      c("F_SOLSHINE_TABLETS", "F-SOLSHINE TABLETS", "Sunday", 367),
      c("FC_NOURISH", "FC-NOURISH", "Monday, Wednesday and Friday", 368),
      c("F_MELASURGE_JV", "F-MELASURGE JV", "Once in 3 days", 369),
    ],
  },
  {
    id: "KIT_GI_GOLD", name: "GI GOLD", aliases: ["GI", "GI Gold"], mrp: 3296,
    purpose: "A gut-axis support pilot kit. Its educational narrative discusses digestion, absorption and inflammatory signalling without diagnosing a patient.",
    components: [
      c("F_IMMUSURGE", "F-IMMUSurge", "Monday and Thursday", 1010),
      c("F_TRICHO_CUMIN", "F-TRICHO CUMIN", "Monday and Thursday", 1011),
      c("F_LACTOCOL", "F-LACTOCOL", "Tuesday and Friday", 1012),
      c("F_TRICHORISE", "F-TRICHORISE", "Tuesday and Friday", 1013),
      c("F_TRICHO_STRONG", "F-TRICHO STRONG", "Wednesday and Saturday", 1014),
      c("F_KINTOX_HYA", "F-KINTOX HYA", "Wednesday and Saturday", 1015),
      c("F_B_SHINE", "F-B SHINE", "Sunday", 1016),
      c("F_D_ENZYSTIVE", "F-D-ENZYSTIVE", "Alternate day", 1017),
      c("F_DAILY_D", "F-DAILY D", "Daily", 1018),
    ],
  },
  {
    id: "KIT_PRO_IMMUNE_GOLD", name: "Pro Immune GOLD", aliases: ["Pro Immune", "Pro-Immune Gold"], mrp: 2349,
    purpose: "An immune-support pilot kit described for recovery support; suitability remains governed by the approved clinical plan.",
    components: [
      c("F_IMMUSURGE", "F-IMMUSurge", "Monday and Thursday", 1409),
      c("F_TRICHORISE", "F-TRICHORISE", "Monday and Thursday", 1410),
      c("F_LACTOCOL", "F-LACTOCOL", "Tuesday and Friday", 1411),
      c("F_TRICHOFLAX", "F-TRICHOFLAX", "Tuesday and Friday", 1412),
      c("F_TRICHO_STRONG", "F-TRICHO STRONG", "Wednesday and Saturday", 1413),
      c("F_TRICHO_CUMIN", "F-TRICHO CUMIN", "Wednesday and Saturday", 1414),
      c("FC_NOURISH", "FC-NOURISH", "Monday, Wednesday and Friday", 1415),
      c("F_SOLSHINE", "F-SOLSHINE", "Sunday", 1416),
    ],
  },
  {
    id: "KIT_INFLAMMATION_PHENOTYPE", name: "Phenotype Inflammation", aliases: ["Inflammation", "Inflammation Phenotype"], mrp: 3254,
    purpose: "An inflammation-phenotype pilot kit. Explanatory material is educational and cannot establish a patient's phenotype.",
    components: [
      c("F_CUMIKIN", "F-CUMIKIN", "Monday and Thursday", 1060),
      c("F_TRICHOGROW_PLUS", "F-TRICHOGROW PLUS", "Monday and Thursday", 1061),
      c("F_NICO_R_M", "F-NICO R M", "Tuesday and Friday", 1062),
      c("F_SPRIRULUX", "F-SPRIRULUX", "Tuesday and Friday", 1063),
      c("F_IMMUSURGE", "F-IMMUSurge", "Wednesday and Saturday", 1064),
      c("F_RESVA_M", "F-RESVA M", "Wednesday and Saturday", 1065),
      c("FC_NOURISH", "FC-NOURISH", "Monday, Wednesday and Friday", 1066),
      c("F_SOLSHINE_TABLETS", "F-SOLSHINE TABLETS", "Sunday", 1067),
    ],
  },
  {
    id: "KIT_PRO_FACT_META_B", name: "PRO FACT META B", aliases: ["Meta B", "Profact Meta B", "Pro Fact Meta B"], mrp: 2745,
    purpose: "The standalone PRO FACT META B base kit is a governed metabolic-support entity. Its educational content does not choose between Meta B variants for a patient.",
    components: [
      c("F_IMMUSURGE", "F-IMMUSurge", "Monday and Thursday", 192),
      c("F_EASME", "F-EASME", "Monday and Thursday", 193),
      c("F_TRICHO_CUMIN", "F-TRICHO CUMIN", "Tuesday and Friday", 194),
      c("FM_BOLIC", "FM-BOLIC", "Tuesday and Friday", 195),
      c("F_TRICHO_INO", "F-TRICHO-INO", "Wednesday and Saturday", 196),
      c("F_RESVA_M", "F-RESVA M", "Wednesday and Saturday", 197),
      c("F_SOLSHINE_TABLETS", "F-SOLSHINE TABLETS", "Sunday", 198),
      c("F_TRICHO_STRONG", "F-TRICHO STRONG", "Sunday", 199),
    ],
  },
  {
    id: "KIT_PRO_FACT_META_B_PCOS", name: "PRO FACT META B PCOS", aliases: ["Meta B PCOS", "Profact Meta B PCOS", "Pro Fact Meta B PCOS"], mrp: 0,
    purpose: "The PRO FACT META B PCOS variant is a distinct governed entity and must not inherit patient-visible explanations or composition from the base Meta B kit.",
    components: [
      c("F_TRICHO_CUMIN", "F-TRICHO CUMIN", "Monday and Thursday", 177),
      c("F_NAT_TX", "F-NAT-TX", "Monday and Thursday", 178),
      c("F_RESVA_M", "F-RESVA-M", "Tuesday and Friday", 179),
      c("F_NICO_R_M", "F-NICO R-M", "Tuesday and Friday", 180),
      c("FM_BOLIC", "FM BOLIC", "Wednesday and Saturday", 181),
      c("F_TRICHO_INO", "F-TRICHO-INO", "Wednesday and Saturday", 182),
      c("F_SOLSHINE_TABLETS", "F-SOLSHINE TABLETS", "Sunday", 183),
    ],
  },
  {
    id: "KIT_PRO_FACT_META_B_THYROID", name: "PRO FACT META B THYROID", aliases: ["Meta B Thyroid", "Profact Meta B Thyroid", "Pro Fact Meta B Thyroid", "Meta B Hypothyroid"], mrp: 0,
    purpose: "The PRO FACT META B THYROID variant is a distinct governed entity and must not inherit patient-visible explanations or composition from the base Meta B kit.",
    components: [
      c("F_IMMUSURGE", "F-IMMUSurge", "Monday and Thursday", 169),
      c("F_TRICHOSHIELD", "F-TRICHOSHIELD", "Monday and Thursday", 170),
      c("F_TRICHO_PROTEIN", "F-TRICHO PROTEIN", "Tuesday and Friday", 171),
      c("F_TRICHORISE", "F-TRICHORISE", "Tuesday and Friday", 172),
      c("FM_BOLIC", "FM BOLIC", "Wednesday and Saturday", 173),
      c("F_TRICHO_CUMIN", "F-TRICHO CUMIN", "Wednesday and Saturday", 174),
      c("FC_NOURISH", "FC-NOURISH", "Sunday", 175),
      c("F_SOLSHINE_TABLETS", "F-SOLSHINE TABLETS", "Sunday", 176),
    ],
  },
  {
    id: "KIT_PRO_FACT_META_B_MENOPAUSE", name: "PRO FACT META B MENOPAUSE", aliases: ["Meta B Menopause", "Profact Meta B Menopause", "Pro Fact Meta B Menopause", "Meta B Post M 2"], mrp: 0,
    purpose: "The PRO FACT META B MENOPAUSE variant is a distinct governed entity and must not inherit patient-visible explanations or composition from the base Meta B kit.",
    components: [
      c("F_RESVA_M", "F-RESVA-M", "Monday and Thursday", 184),
      c("F_EASME", "F-EASME", "Monday and Thursday", 185),
      c("F_TRICHOSHIELD", "F-TRICHOSHIELD", "Tuesday and Friday", 186),
      c("FM_BOLIC", "FM BOLIC", "Tuesday and Friday", 187),
      c("F_CAL_D3", "F-CAL D3", "Wednesday and Saturday", 188),
      c("F_TRICHO_STRONG", "F-TRICHO STRONG", "Wednesday and Saturday", 189),
      c("F_LACTIHEALTH", "F-LACTIHEALTH", "Sunday", 190),
      c("F_SOLSHINE_TABLETS", "F-SOLSHINE TABLETS", "Sunday", 191),
    ],
  },
];

export function normalizeLookup(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function resolvePilotKit(input: string): PilotKit | undefined {
  const normalized = normalizeLookup(input);
  return PILOT_KITS.find((kit) =>
    [kit.id, kit.name, ...kit.aliases].some((name) => (` ${normalized} `).includes(` ${normalizeLookup(name)} `)),
  );
}

export function kitsContainingProduct(input: string): PilotKit[] {
  const normalized = normalizeLookup(input);
  return PILOT_KITS.filter((kit) => kit.components.some((item) =>
    normalizeLookup(item.productId) === normalized || normalizeLookup(item.productName) === normalized,
  ));
}
