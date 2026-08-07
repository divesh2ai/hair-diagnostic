import type {
  ClinicalReport,
  RootCauseCategory,
  RootCauseCondition,
  TreatmentPhase,
  UniversalRecoveryMilestone,
} from "@hairos/packages/ai-engine/report-engine/types";
import type { PatientImageResolution, ProductAsset } from "./productAssets";
import { conditionCodeForText, getConditionAsset, getProductAsset, getRecoveryStageIllustration, getTopicalAsset, resolvePatientImageAsset } from "./productAssets";
import type { ClinicalOptionAssetStatus } from "./clinicalOptionAssets";
import { isClinicalOptionExcluded, resolveClinicalOptionAsset } from "./clinicalOptionAssets";

export type PrintClinicalSnapshotItem = {
  optionCode: string;
  label: string;
  asset: ProductAsset;
  assetStatus: ClinicalOptionAssetStatus;
};

function snapshotTileFor(label: string): PrintClinicalSnapshotItem {
  const resolved = resolveClinicalOptionAsset({ label });
  return { optionCode: resolved.optionCode, label, asset: resolved.asset, assetStatus: resolved.status };
}

function buildKeyClinicalSnapshot(report: ClinicalReport): PrintClinicalSnapshotItem[] {
  const seen = new Set<string>();
  const rows: PrintClinicalSnapshotItem[] = [];
  const push = (raw: string) => {
    const label = cleanText(raw);
    if (!label) return;
    const key = label.toLowerCase().replace(/\s+/g, " ").trim();
    if (seen.has(key)) return;
    // Filter out non-clinical fillers that would just be noise on the tile
    // grid. Non-selection tags ("Not flagged", "Not recorded", "None", etc.)
    // must never surface as tiles — the spec requires every tile to be
    // traceable to an actual patient response or doctor-added finding.
    if (/^(yes|no|none|normal|not (recorded|applicable|flagged|sure)|female|male|assessment-linked)$/i.test(key)) return;
    // Broad "no <anything> history / issues / concern" match — questionnaire
    // options like "No thyroid history", "No hormonal issues", "No scalp
    // concerns", "No gut issues" are non-selections and must not surface as
    // clinical findings.
    if (/^no\s+\w+/i.test(key) && /(history|issues|issue|concern|concerns|deficiencies|allergies|major|significant|visible|fall)/i.test(key)) return;
    if (isClinicalOptionExcluded(label)) return;
    seen.add(key);
    rows.push(snapshotTileFor(label));
  };
  const selections = (report.patientSummary.questionnaireSelections ?? {}) as Record<string, unknown>;
  // "From your responses" — every clinically-meaningful patient selection
  // surfaces as a tile. Field order controls tile placement (clinical
  // drivers first, softer context tags after). No cap so multi-signal
  // patients (Vaer, Ravsharan) are fully represented rather than truncated.
  // The renderer downshifts tile density when the count is high.
  //
  // Duration ("3–6 months") and grade ("Norwood III" / "Ludwig 2") are
  // deliberately excluded — they're already stated in the patient card on
  // the left and inside the Doctor-Reviewed Result diagnosis title, so a
  // snapshot tile for either would just duplicate information and eat
  // space that a real clinical signal could use.
  // "count" is deliberately omitted — the ~50-100 strands / shedding figure is
  // already rendered in the patient-details card (see PatientBlock), and
  // duplicating it as a snapshot tile burns real estate for a driver we
  // already show. Every other selected clinical option remains visible.
  const priority = [
    "hairtype",
    "scalp",
    "hormonal",
    "thyroid",
    "immunity",
    "gut",
    "deficiency",
    "metabolic",
    "cause",
    "lifestyle",
    "behavioural",
    "diet",
    "treatment",
    "goal",
  ];
  for (const field of priority) for (const value of collectEvidenceStrings(selections[field])) push(value);
  return rows;
}

function buildTopicalCareWithValidation(report: ClinicalReport): {
  topicals: PrintTopical[];
  validation: TopicalValidationReport[];
} {
  const raw = toArray<{ name?: unknown; usage?: unknown; note?: unknown }>(report.topicalRecommendations);
  const validation: TopicalValidationReport[] = [];
  const topicals: PrintTopical[] = [];
  const seenCodes = new Set<string>();
  const cautionedNames = new Set(
    toArray<{ name?: unknown }>(report.topicalCautions)
      .map((item) => cleanText(item.name).toLowerCase())
      .filter(Boolean),
  );
  for (const item of raw) {
    const rawName = shortText(item.name, "", LIMITS.topicalName);
    const topicalCode = topicalAssetCode(rawName);
    const name = canonicalTopicalName(rawName, topicalCode);
    if (!name) {
      validation.push({ topicalCode, name: "", status: "suppressed_missing_name" });
      continue;
    }
    if (seenCodes.has(topicalCode)) {
      validation.push({ topicalCode, name, status: "duplicate_support" });
      continue;
    }
    if (cautionedNames.has(name.toLowerCase())) {
      validation.push({
        topicalCode,
        name,
        status: "suppressed_not_approved",
        reason: "The clinical report lists this topical in topical cautions",
      });
      continue;
    }
    const asset = getTopicalAsset(topicalCode);
    if (!asset) {
      validation.push({ topicalCode, name, status: "suppressed_missing_asset" });
      continue;
    }
    seenCodes.add(topicalCode);
    validation.push({ topicalCode, name, status: "valid" });
    topicals.push({
      name,
      topicalCode,
      purpose: shortText(topicalPurpose(name), "Adjunct topical support", LIMITS.topicalPurpose),
      usage: topicalUsage(name, item.usage || item.note),
      asset,
    });
    if (topicals.length >= 3) break;
  }
  return { topicals, validation };
}

export type OnePageReportContext = {
  assessmentId: string;
  patient?: { name?: string | null; age?: number | null; gender?: string | null; imageUrl?: string | null; phone?: string | null };
  clinic?: { name?: string | null; address?: string | null; phone?: string | null; logoUrl?: string | null };
  clinician?: { name?: string | null; title?: string | null; signatureUrl?: string | null };
  approval?: {
    status?: string | null;
    approvedAt?: Date | string | null;
    approvedBy?: string | null;
    nextReviewDate?: Date | string | null;
    wasModified?: boolean | null;
  };
  guideUrl?: string | null;
  generatedAt?: Date | string | null;
};

export type DoctorState = "DRAFT" | "REVIEWED" | "MODIFIED" | "APPROVED";
export type IllustrationKey = "follicle" | "scalp" | "hormonal" | "metabolic" | "nutrition" | "immune" | "stress" | "recovery";
export type PrintDensityMode = "standard" | "dense" | "compact";
export type DriverPriority = "Primary Driver" | "Secondary Driver" | "Supporting Contributor" | "Lifestyle Contributor";

export type PrintDriverCard = {
  id: string;
  title: string;
  priority: DriverPriority;
  trigger: string;
  explanation: string;
  illustration: IllustrationKey;
  conditionCode: string;
  asset: ProductAsset | null;
  tone: "gold" | "teal" | "coral" | "mint";
};

export type PrintTreatmentKit = {
  id: string;
  sequence: string;
  role: string;
  priority: DriverPriority;
  name: string;
  kitCode: string;
  selectedBecause: string;
  mappedDriverId: string;
  mappedCondition: string;
  mappedInterpretation: string | null;
  linkedDrivers: string[];
  benefits: string[];
  asset: ProductAsset | null;
  /**
   * True when the kit was approved by the doctor without a direct patient
   * trigger. `linkedDrivers[0]` then holds a benefit-oriented fallback
   * chip (e.g. "Improves immunity") from clinicianAddedLabelForKit().
   */
  clinicianAdded?: boolean;
};

export type PrintTopical = {
  name: string;
  topicalCode: string;
  purpose: string;
  usage: string;
  asset: ProductAsset | null;
};

export type PrintTimelineStage = {
  window: string;
  title: string;
  outcomes: string[];
  illustration: IllustrationKey;
  stageCode: string;
  asset: ProductAsset | null;
};
export type PrintPatternScaleStage = {
  label: string;
  value: string;
  asset: ProductAsset;
  selected: boolean;
};

export type PrintPatternScale = {
  type: "Ludwig" | "Norwood";
  patientStage: string;
  stages: PrintPatternScaleStage[];
};


export type OnePageReportViewModel = {
  assessmentId: string;
  layoutMode: PrintDensityMode;
  generatedAt: string;
  patient: { name: string; age: string; gender: string; imageUrl: string | null; imageAsset: PatientImageResolution; goal: string; phone: string | null };
  clinic: { name: string; address: string; phone: string; logoUrl: string | null };
  clinician: { name: string; title: string };
  clinicalResult: { primary: string; supportingLine: string; conclusion: string; reviewedBy: string };
  /**
   * Structured narrative used to compose the Doctor-Reviewed Result. Exposed
   * so validation can enforce the "one connected clinical story" invariant:
   * the underlying pattern is stated separately from the current active
   * trigger, kit #1 is explicitly justified, and every approved kit is
   * covered in the treatment strategy in the doctor-approved order.
   */
  narrative: OnePageReportNarrative;
  driverStory: PrintDriverCard[];
  snapshotStrip: Array<{ label: string; value: string; illustration: IllustrationKey }>;
  patternScale: PrintPatternScale | null;
  /**
   * Reference-design decision: the default patient one-pager renders the
   * patient's *exact* grade (in the diagnosis title) rather than the full
   * Ludwig/Norwood ladder. `patternScale` is retained on the view model so a
   * future doctor-facing variant can opt-in behind a flag, but the standard
   * component intentionally does not render the strip.
   */
  treatmentPlan: PrintTreatmentKit[];
  /**
   * Secondary supportive kits (HBR / hair-shaft repair) partitioned out of
   * the primary matrix so the main table stays focused on the drivers of
   * hair loss.
   */
  additionalCare: PrintTreatmentKit[];
  topicalCare: PrintTopical[];
  topicalNote: string;
  /** Up to 10 evidence-backed clinical signals from the patient's report. */
  keyClinicalSnapshot: PrintClinicalSnapshotItem[];
  recoveryJourney: PrintTimelineStage[];
  lifestyleSupport: { supports: string[]; slows: string[] };
  guideUrl: string | null;
  doctorApproval: { state: DoctorState; approvedAt: string; approvedBy: string; nextReviewDate: string; signatureUrl: string | null };
  disclaimer: string;
  validation: OnePageReportValidation;
};

export type OnePageReportNarrative = {
  /** Diagnosis + stage, e.g. "Male Pattern Hair Loss at Norwood III". Empty
   *  string if no Ludwig/Norwood grade was captured. */
  underlyingPattern: string;
  /** "noticeable shedding of approximately 50-100 strands over the past 3-6
   *  months" — composed from questionnaire count + duration. */
  activityLine: string;
  /** The active shedding trigger linked to approved kit #1. Null only if the
   *  approved lineup is empty or kit #1 is the pattern kit itself (in which
   *  case the pattern IS the primary driver — no separate active trigger). */
  primaryActiveDriver: {
    kitCode: string;
    /** Short label ("rapid weight change following GLP-1 therapy"). */
    label: string;
    /** One-line simple clinical effect ("place sudden stress on the
     *  follicles and increase shedding"). */
    effect: string;
    /** Composed sentence rendered into the conclusion paragraph. */
    sentence: string;
    /** True when kit #1 was clinician-added (no patient signal supports it).
     *  In that case the sentence uses "Your doctor has added <purpose> as
     *  part of your recovery plan" and validation surfaces a warning. */
    doctorAdded: boolean;
  } | null;
  /** Contributor labels for the additional-drivers sentence, in
   *  clinical-weight order. Excludes the primary active driver so it never
   *  double-counts. */
  secondaryDrivers: string[];
  /** One phrase per approved kit in doctor-approved order. Feeds the closing
   *  "Your plan therefore begins with X, followed by Y…" sentence. */
  treatmentStrategy: Array<{ kitCode: string; phrase: string }>;
};

export type KitValidationStatus =
  | "valid"
  | "clinician_added"
  | "suppressed_missing_trigger"
  | "suppressed_missing_interpretation"
  | "suppressed_missing_asset"
  | "suppressed_not_approved"
  | "duplicate_support";

export type TopicalValidationStatus =
  | "valid"
  | "suppressed_missing_asset"
  | "suppressed_missing_name"
  | "suppressed_not_approved"
  | "duplicate_support";

export type KitValidationReport = {
  kitCode: string;
  name: string;
  status: KitValidationStatus;
  reason?: string;
};

export type TopicalValidationReport = {
  topicalCode: string;
  name: string;
  status: TopicalValidationStatus;
  reason?: string;
};

export type ClinicalIconValidationReport = {
  optionCode: string;
  label: string;
  status: ClinicalOptionAssetStatus;
  assetPath: string;
};

export type OnePageReportValidation = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  kits?: KitValidationReport[];
  topicals?: TopicalValidationReport[];
  clinicalIcons?: ClinicalIconValidationReport[];
};

const UNSUPPORTED_METRICS = [/hair health score/i, /confidence score/i, /biological hair age/i, /regrowth forecast/i, /\b\d{1,3}%\b/];
const GUARANTEED_CLAIMS = [/\bguarantee[ds]?\b/i, /\bwill regrow\b/i, /\bpermanent cure\b/i, /\b100%\b/i];
const CATEGORY_ORDER: Record<string, number> = { Primary: 0, Secondary: 1, Amplifier: 2, Contributing: 3 };

const LIMITS = {
  patientName: 40,
  primaryResult: 75,
  conclusion: 280,
  driverTitle: 55,
  driverTrigger: 75,
  driverExplanation: 150,
  kitName: 65,
  selectedBecause: 120,
  benefit: 75,
  topicalName: 55,
  topicalPurpose: 85,
  topicalUsage: 110,
  timelineTitle: 65,
  timelineOutcome: 75,
  lifestyleItem: 55,
};

function cleanText(value: unknown, fallback = ""): string {
  const text = typeof value === "string" ? value : fallback;
  return text
    .replace(/\bwill improve\b/gi, "may improve")
    .replace(/\bwill reduce\b/gi, "may reduce")
    .replace(/\bvisible regrowth\b/gi, "visible improvement")
    .replace(/\bregrowth achieved\b/gi, "improvement observed")
    .replace(/\bguaranteed\b/gi, "expected")
    .replace(/\s+/g, " ")
    .trim();
}

function shortText(value: unknown, fallback: string, max = 88): string {
  const text = cleanText(value, fallback);
  if (text.length <= max) return text;
  const clipped = text.slice(0, max + 1);
  const lastStop = Math.max(clipped.lastIndexOf(". "), clipped.lastIndexOf("; "));
  if (lastStop > 45) return clipped.slice(0, lastStop + 1).trim();
  const lastSpace = clipped.lastIndexOf(" ");
  return clipped.slice(0, lastSpace > 45 ? lastSpace : max).trim();
}

function shortSentence(value: unknown, fallback: string, max = 120): string {
  const text = shortText(value, fallback, max).replace(/[,:;\-\s]+$/g, "");
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function toArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function uniq(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.toLowerCase();
    if (!value || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function shortList(values: unknown[], fallback: string, max = 42, count = 2): string {
  const text = uniq(values.map((item) => cleanText(item)).filter(Boolean)).slice(0, count).join(", ");
  return shortText(text, fallback, max);
}

function formatDate(value: Date | string | null | undefined, fallback = "To be scheduled"): string {
  if (!value) return fallback;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function buildPatternScale(grade: unknown): PrintPatternScale | null {
  const patientStage = cleanText(grade);
  if (!patientStage || !/ludwig|norwood/i.test(patientStage)) return null;

  const type = /ludwig/i.test(patientStage) ? "Ludwig" : "Norwood";
  const definitions = type === "Ludwig" ? [
    ["1", "Ludwig 1", "grade1.jpg"],
    ["2", "Ludwig 2", "grade2.jpg"],
    ["III", "Ludwig III", "iii.jpg"],
    ["I-1", "Ludwig I-1", "i1.jpg"],
    ["II-1", "Ludwig II-1", "ii1.jpg"],
    ["III-1", "Ludwig III-1", "iii1.jpg"],
  ] as const : [
    ["I", "Norwood I", "i.jpg"], ["II", "Norwood II", "ii.jpg"],
    ["IIa", "Norwood IIa", "iia.jpg"], ["III", "Norwood III", "iii.jpg"],
    ["III V", "Norwood III vertex", "iii_vertex.jpg"], ["IIIa", "Norwood IIIa", "iiia.jpg"],
    ["IV", "Norwood IV", "iv.jpg"], ["IVa", "Norwood IVa", "iva.jpg"],
    ["V", "Norwood V", "v.jpg"], ["Va", "Norwood Va", "va.jpg"],
    ["VI", "Norwood VI", "vi.jpg"], ["VII", "Norwood VII", "vii.jpg"],
  ] as const;
  const normalize = (value: string) => value.toLowerCase().replace(/[\u2014\u2013-]/g, " ").replace(/\s+/g, " ");
  const normalizedScaleStage = normalize(patientStage).replace(/^grade \d+ /, "");

  const stages = definitions.map(([label, value, file]) => ({
    label,
    value,
    selected: normalizedScaleStage === normalize(value),
    asset: {
      key: `${type.toUpperCase()}_${label.replace(/[^A-Z0-9]/gi, "_").toUpperCase()}`,
      src: `/clinical-visuals/grade/${type.toLowerCase()}/${file}`,
      alt: `${value} clinical hair-loss scale stage`,
    },
  }));
  const selectedStage = stages.find((stage) => stage.selected)
    ?? stages.find((stage) => normalizedScaleStage.includes(normalize(stage.value)))
    ?? stages[0];

  // Return the first three canonical stages so the reference layout can render
  // a 1 / 2 / 3 strip with the patient's stage highlighted. The selected stage
  // is forced to selected=true even when the questionnaire wrote a slightly
  // different spelling (e.g. "Grade 2 - Ludwig 2").
  const baseStages = stages.slice(0, 3).map((stage) => ({
    ...stage,
    selected: selectedStage ? stage.label === selectedStage.label : stage.selected,
  }));
  // When the doctor-approved grade sits outside the canonical 1/2/3 strip
  // (e.g. Ludwig I-1 / II-1 / III-1), append it so the snapshot chip and any
  // downstream "selected stage" consumer read the actual approved value
  // instead of silently falling back to stages[0] (Ludwig 1) and creating a
  // headline↔snapshot mismatch.
  const canonicalStages = selectedStage && !baseStages.some((s) => s.label === selectedStage.label)
    ? [...baseStages, { ...selectedStage, selected: true }]
    : baseStages;
  return { type, patientStage, stages: canonicalStages };
}

function illustrationFor(text: string): IllustrationKey {
  if (/scalp|dandruff|itch|inflam|sebum|flake/i.test(text)) return "scalp";
  if (/hormone|pcos|thyroid|androgen|dht|blood|bleed|menopause|iron|ferritin/i.test(text)) return "hormonal";
  if (/metabolic|insulin|weight|diabetes|prediabetes|glp/i.test(text)) return "metabolic";
  if (/nutrition|diet|deficien|gut|protein|vegetarian/i.test(text)) return "nutrition";
  if (/immune|autoimmune|areata|allerg/i.test(text)) return "immune";
  if (/stress|sleep|circadian|shift|smoking|vaping|alcohol|oxidative/i.test(text)) return "stress";
  return "follicle";
}

function kitAssetCode(raw: string): string {
  const text = cleanText(raw).toUpperCase();
  if (/IRON UP.*VEG/.test(text)) return "IRON_UP_GOLD_VEG";
  if (/IRON UP/.test(text)) return "IRON_UP_GOLD";
  if (/TE GOLD.*VEG/.test(text)) return "HAIR_FACT_TE_GOLD_VEG";
  if (/TE GOLD/.test(text)) return "HAIR_FACT_TE_GOLD";
  if (/PRO IMMUNE.*PLUS/.test(text)) return "PRO_IMMUNE_GOLD_PLUS";
  if (/PRO IMMUNE.*VEG/.test(text)) return "PRO_IMMUNE_VEG";
  if (/PRO IMMUNE/.test(text)) return "PRO_IMMUNE_GOLD";
  if (/PHENOTYPE.*INFLAM/.test(text)) return "PHENOTYPE_INFLAMMATION";
  if (/META[-\s]?B.*HYPOTHYROID.*VEG/.test(text)) return "PRO_FACT_META_B_HYPOTHYROID_VEG";
  if (/META[-\s]?B.*HYPOTHYROID/.test(text)) return "PRO_FACT_META_B_HYPOTHYROID";
  if (/META[-\s]?B.*PCOS/.test(text)) return "PRO_FACT_META_B_PCOS";
  if (/META[-\s]?B.*POST/.test(text)) return "PRO_FACT_META_B_POSTMENOPAUSE";
  if (/META[-\s]?B/.test(text)) return "PRO_FACT_META_B";
  if (/RAPID WEIGHT|RWL/.test(text)) return "RAPID_WEIGHT_LOSS_SHIELD";
  if (/FPHL.*PLUS/.test(text)) return "FPHL_PLUS";
  // Asset registry keys are the short codes (FPHL / MPHL); the space-suffixed
  // "FPHL Pro" was a typo that broke asset lookup.
  if (/\bFPHL\b|FEMALE PATTERN/.test(text)) return "FPHL";
  if (/MPHL.*PLUS/.test(text)) return "MPHL_PLUS";
  if (/\bMPHL\b|MALE PATTERN/.test(text)) return "MPHL";
  if (/ALOPECIA AREATA/.test(text)) return "HAIR_FACT_ALOPECIA_AREATA";
  if (/PERI MENOPAUSE/.test(text)) return "HAIR_FACT_PERI_MENOPAUSE";
  if (/GI GOLD/.test(text)) return "PRO_FACT_GI_GOLD";
  if (/THYROID/.test(text)) return "PRO_FACT_THYROID_CARE";
  if (/NIGHT SHIFT/.test(text)) return "HAIR_FACT_NIGHT_SHIFT";
  if (/FREQUENT FLY/.test(text)) return "HAIR_FACT_FREQUENT_FLYERS";
  if (/HBR|BREAKAGE/.test(text)) return "HBR";
  if (/TTM/.test(text)) return "TTM";
  if (/LACTI.*VEG/.test(text)) return "LACTIHEALTH_VEG";
  if (/LACTI/.test(text)) return "LACTIHEALTH";
  if (/EARLY GREYING/.test(text)) return "EARLY_GREYING_CARE";
  if (/POST[-\s]?HYSTERECTOMY|HYSTERECTOMY|\bHRT\b/.test(text)) return "PRO_FACT_POST_HYSTERECTOMY";
  if (/HEALTHY[-\s]?9|PREGNANCY/.test(text)) return "HEALTHY_9";
  return text.replace(/[\s-]+/g, "_").replace(/[^A-Z0-9_]/g, "");
}

/**
 * Canonical display name for topicals. Locks the anti-dandruff shampoo to
 * "F-Biwash Pro (Anti-Dandruff Shampoo)" so every report ships the same
 * label — regardless of whether the upstream data called it Biwash+ / Biwash
 * Plus / Anti-Dandruff Shampoo.
 */
function canonicalTopicalName(rawName: string, topicalCode: string): string {
  if (topicalCode === "F_BIWASH_PLUS" || topicalCode === "F_BIWASH") {
    return "F-Biwash Pro (Anti-Dandruff Shampoo)";
  }
  return rawName;
}

function topicalAssetCode(raw: string): string {
  const text = cleanText(raw).toUpperCase();
  if (/BIWASH|ANTI-DANDRUFF|SHAMPOO/.test(text)) return "F_BIWASH_PLUS";
  if (/EMUGROW.*MC R D|EMUGROW.*MCRD|MCRD/.test(text)) return "F_EMUGROW_MCRD";
  if (/EMUGROW.*MC R/.test(text)) return "F_EMUGROW_MC_R";
  if (/EMUGROW.*MCR/.test(text)) return "F_EMUGROW_MCR";
  if (/EMUGROW.*MC/.test(text)) return "F_EMUGROW_MC";
  if (/TRICHOSILK.*WITHOUT/.test(text)) return "F_TRICHOSILK_DF_WITHOUT_TREATMENT";
  if (/TRICHOSILK.*WITH/.test(text)) return "F_TRICHOSILK_DF_WITH_TREATMENT";
  if (/TRICHOSILK.*FNH/.test(text)) return "F_TRICHOSILK_FNH";
  if (/TRICHOSILK/.test(text)) return "F_TRICHOSILK";
  if (/TRICHOGAIN/.test(text)) return "F_TRICHOGAIN";
  // ── Oral combination tablets — MUST precede the generic MINOXIDIL branch ──
  // "Oral Minoxidil + Spironolactone" / "+ Bicalutamide" are systemic tablets
  // (Oroxidil cartons), not scalp solutions. Falling through to the block
  // below matched them on the bare "MINOXIDIL" token and printed an F-Extend
  // bottle for an oral prescription.
  //
  // The ORAL/OROXIDIL guard is load-bearing: "Minoxidil + Spironolactone
  // Topical" is a genuine compounded topical and must NOT match here.
  if (/ORAL|OROXIDIL/.test(text) && !/TOPICAL/.test(text)) {
    // Match on the ingredient OR the carton brand code — the Oroxidil boxes
    // encode the anti-androgen as a letter prefix (F-S- = Spironolactone,
    // F-B- = Bicalutamide) and never spell the ingredient out.
    const isBicalutamide = /BICALUTAMIDE/.test(text) || /\bF\s*-?\s*B\s*-?\s*OROXIDIL/.test(text);
    const isSpironolactone = /SPIRONOLACTONE/.test(text) || /\bF\s*-?\s*S\s*-?\s*OROXIDIL/.test(text);
    if (isBicalutamide) return "ORAL_MINOXIDIL_BICALUTAMIDE";
    if (isSpironolactone) {
      // Two strengths ship as distinct cartons; only an explicit "50" selects
      // the 1.25-50 box. The unqualified registry name ("Oral Minoxidil +
      // Spironolactone") is the 1.25-25.
      return /(?<![\d.])50\b/.test(text)
        ? "ORAL_MINOXIDIL_SPIRONOLACTONE_50"
        : "ORAL_MINOXIDIL_SPIRONOLACTONE";
    }
  }
  if (/MINOXIDIL|EXTEND/.test(text)) {
    // 1. Explicit adjacency wins (MINOXIDIL 5 / EXTEND 2).
    if (/(?:MINOXIDIL|EXTEND)\s*5/.test(text)) return "F_EXTEND_5";
    if (/(?:MINOXIDIL|EXTEND)\s*2/.test(text)) return "F_EXTEND_2";
    // 2. Whole-percentage token, excluding decimal fragments like the "5%" in "2.5%".
    if (/(?<![\d.])5\s*%/.test(text)) return "F_EXTEND_5";
    if (/(?<![\d.])2\s*%/.test(text)) return "F_EXTEND_2";
    // 3. Unspecified strength — default to 5% (predominant recommendation).
    return "F_EXTEND_5";
  }
  return text.replace(/[\s-]+/g, "_").replace(/[^A-Z0-9_]/g, "");
}

function priorityFor(category: RootCauseCategory | "Contributing"): DriverPriority {
  if (category === "Primary") return "Primary Driver";
  if (category === "Secondary") return "Secondary Driver";
  if (category === "Amplifier") return "Supporting Contributor";
  return "Lifestyle Contributor";
}

function toneFor(cardText: string, category: RootCauseCategory | "Contributing"): PrintDriverCard["tone"] {
  if (/blood|bleed|iron|ferritin/i.test(cardText)) return "coral";
  if (category === "Primary") return "gold";
  if (/scalp|inflam|dandruff/i.test(cardText)) return "teal";
  return "mint";
}

function flattenDrivers(report: ClinicalReport): PrintDriverCard[] {
  const groups: Array<[RootCauseCategory, RootCauseCondition[]]> = [
    ["Primary", report.rootCauseAnalysis?.primary ?? []],
    ["Secondary", report.rootCauseAnalysis?.secondary ?? []],
    ["Amplifier", report.rootCauseAnalysis?.amplifiers ?? []],
  ];

  return groups
    .flatMap(([category, drivers]) =>
      drivers.map((driver, index) => {
        const title = shortText(driver.condition, "Clinical driver", LIMITS.driverTitle);
        const signals = toArray<string>(driver.supportingSignals).map((signal) => shortText(signal, "", 34)).filter(Boolean);
        const trigger = shortList(signals, shortText(driver.impact, "Assessment-linked pattern", LIMITS.driverTrigger), LIMITS.driverTrigger, 2);
        const explanation = shortSentence(driver.clinicalRelevance || driver.impact, "May influence the current hair-cycle pattern.", LIMITS.driverExplanation);
        const text = `${title} ${trigger} ${explanation}`;
        const conditionCode = conditionCodeForText(text);
        return {
          id: `${category}-${index}-${driver.condition}`,
          title,
          priority: priorityFor(category),
          trigger,
          explanation,
          illustration: illustrationFor(text),
          conditionCode,
          asset: getConditionAsset(conditionCode),
          tone: toneFor(text, category),
        };
      }),
    )
    .sort((a, b) => CATEGORY_ORDER[a.priority.split(" ")[0]] - CATEGORY_ORDER[b.priority.split(" ")[0]]);
}

function patientFriendlyResult(report: ClinicalReport, drivers: PrintDriverCard[]): string {
  const patient = report.patientSummary;
  const selections = (patient.questionnaireSelections ?? {}) as Record<string, unknown>;
  const grade = cleanText(selections.grade);
  const stage = grade.replace(/^Grade\s*\d+\s*[\u2014\u2013-]\s*/i, "").trim();
  if (/ludwig/i.test(stage)) return shortText(`Female Pattern Hair Loss - ${stage}`, stage, LIMITS.primaryResult);
  if (/norwood/i.test(stage)) return shortText(`Male Pattern Hair Loss - ${stage}`, stage, LIMITS.primaryResult);
  const pattern = shortList(toArray<string>(patient.hairLossPattern), "Personalised hair-loss pattern", 54, 2);
  const primary = drivers[0]?.title;
  if (primary && !/not recorded|personalised/i.test(pattern)) return shortText(`${pattern} with ${primary}`, pattern, LIMITS.primaryResult);
  return shortText(primary || pattern, "Doctor-reviewed hair-health assessment", LIMITS.primaryResult);
}

function buildSupportingLine(report: ClinicalReport, drivers: PrintDriverCard[]): string {
  const active = drivers.slice(0, 3).map((driver) => driver.title.toLowerCase());
  const shedding = shortText((report.patientSummary.questionnaireSelections as Record<string, unknown> | undefined)?.count, "current shedding activity", 32);
  const line = active.length ? `${shedding}; key contributors include ${active.join(", ")}.` : `${shedding}; patient-specific contributors guide this plan.`;
  return shortSentence(line, "Patient-specific contributors are guiding this care plan.", 125);
}

// ─── Kit → clinical-family classifier ────────────────────────────────────────
// Central lookup used by the narrative builder for kit-specific strategy
// phrases and kit-specific active-trigger sentences. Pattern kits (MPHL/FPHL)
// are classified separately so the narrative can honour the requirement that
// pattern loss is the *underlying* diagnosis, never the *active* trigger.
type KitFamily =
  | "rwl_shield"
  | "te_gold"
  | "gi_gold"
  | "phenotype_inflam"
  | "iron_up"
  | "meta_b"
  | "thyroid_care"
  | "pro_immune"
  | "peri_menopause"
  | "post_menopause"
  | "hysterectomy"
  | "lactihealth"
  | "early_greying"
  | "hbr"
  | "pattern"
  | "alopecia_areata"
  | "gi_endometriosis"
  | "healthy_9"
  | "night_shift"
  | "frequent_flyers"
  | "ttm"
  | "unknown";

function classifyKit(kit: { kitCode: string; name: string }): KitFamily {
  const text = `${kit.kitCode} ${kit.name}`.toLowerCase();
  if (/rwl|rapid weight/.test(text)) return "rwl_shield";
  if (/te gold|telogen/.test(text)) return "te_gold";
  if (/gi gold|gi health/.test(text)) return "gi_gold";
  if (/phenotype.*inflam|inflam/.test(text)) return "phenotype_inflam";
  if (/iron up|ferritin/.test(text)) return "iron_up";
  if (/hyperthyroid|thyroid care/.test(text)) return "thyroid_care";
  if (/meta[ _-]?b|metabolic|hypothyroid/.test(text)) return "meta_b";
  if (/pro immune/.test(text)) return "pro_immune";
  if (/peri.?menopause/.test(text)) return "peri_menopause";
  if (/post.?menopause/.test(text)) return "post_menopause";
  if (/hysterectomy|\bhrt\b/.test(text)) return "hysterectomy";
  if (/lacti|postpartum/.test(text)) return "lactihealth";
  if (/early greying/.test(text)) return "early_greying";
  if (/hbr|breakage|shaft/.test(text)) return "hbr";
  if (/alopecia areata/.test(text)) return "alopecia_areata";
  if (/fh well|endometrios/.test(text)) return "gi_endometriosis";
  if (/healthy.?9|pregnan/.test(text)) return "healthy_9";
  if (/night shift/.test(text)) return "night_shift";
  if (/frequent fly/.test(text)) return "frequent_flyers";
  if (/ttm|trichotillo/.test(text)) return "ttm";
  if (/\bmphl\b|\bfphl\b|male pattern|female pattern|pattern/.test(text)) return "pattern";
  return "unknown";
}

// One patient-facing purpose per kit family. Kept short and simple so it
// slots directly into the "Your treatment therefore begins with X, followed
// by Y" sentence. Each phrase is the kit's canonical purpose (not a kit-name
// template).
const KIT_STRATEGY_PHRASE: Record<KitFamily, string> = {
  rwl_shield: "rapid-weight-loss follicle protection and nutrient recovery",
  te_gold: "acute-shedding support",
  gi_gold: "gut and absorption support",
  phenotype_inflam: "scalp and oxidative inflammation control",
  iron_up: "iron recovery",
  meta_b: "metabolic support",
  thyroid_care: "thyroid support",
  pro_immune: "immune-linked follicle support",
  peri_menopause: "peri-menopausal hormonal-transition support",
  post_menopause: "post-menopausal hormonal-transition support",
  hysterectomy: "post-hysterectomy hormonal reset",
  lactihealth: "postpartum hormonal support",
  early_greying: "melanocyte protection",
  hbr: "hair-shaft repair",
  pattern: "pattern protection",
  alopecia_areata: "autoimmune follicle support",
  gi_endometriosis: "endometriosis-linked hormonal support",
  healthy_9: "pregnancy-safe follicle nutrition",
  night_shift: "circadian follicle recovery",
  frequent_flyers: "travel-linked follicle recovery",
  ttm: "trichotillomania scalp recovery",
  unknown: "targeted follicle support",
};

// Kit-family → structured active trigger. The narrative composes the
// sentence as:
//   "Your current hair shedding may be mainly linked to <label>,
//    which can <effect> on top of the underlying pattern sensitivity."
// The "on top of…" tail is appended only when a Ludwig/Norwood pattern
// diagnosis is present. Pattern kits (MPHL/FPHL) deliberately return null —
// pattern loss is the underlying susceptibility, never framed as the active
// shedding trigger.
type ActiveTrigger = { label: string; effect: string };
function activeTriggerFor(
  family: KitFamily,
  ctx: { hasGlp1Signal: boolean },
): ActiveTrigger | null {
  switch (family) {
    case "rwl_shield":
      // GLP-1 wording only when the patient actually selected a GLP-1 option.
      return ctx.hasGlp1Signal
        ? {
            label: "rapid weight change following GLP-1 therapy",
            effect: "place sudden stress on the follicles and increase shedding",
          }
        : {
            label: "rapid weight loss and associated nutritional strain",
            effect: "place sudden stress on the follicles and increase shedding",
          };
    case "te_gold":
      return {
        label: "stress-driven acute shedding",
        effect: "push a large wave of hair into the resting phase",
      };
    case "gi_gold":
      return {
        label: "gut dysfunction",
        effect: "limit nutrient absorption and drive current shedding",
      };
    case "phenotype_inflam":
      return {
        label: "scalp and oxidative inflammation",
        effect: "weaken follicular support and drive current shedding",
      };
    case "iron_up":
      return {
        label: "low iron stores",
        effect: "reduce oxygen delivery to the follicles and drive current shedding",
      };
    case "meta_b":
      return {
        label: "metabolic strain",
        effect: "slow follicular recovery",
      };
    case "thyroid_care":
      return {
        label: "thyroid dysfunction",
        effect: "disrupt the hair cycle",
      };
    case "pro_immune":
      return {
        label: "immune-linked follicular pressure",
        effect: "interrupt hair growth",
      };
    case "peri_menopause":
      return {
        label: "peri-menopausal hormonal transition",
        effect: "shorten the active growth phase and increase shedding",
      };
    case "post_menopause":
      return {
        label: "post-menopausal hormonal transition",
        effect: "shorten the active growth phase and increase shedding",
      };
    case "hysterectomy":
      return {
        label: "post-hysterectomy hormonal transition",
        effect: "shorten the active growth phase and increase shedding",
      };
    case "lactihealth":
      return {
        label: "postpartum hormonal transition",
        effect: "shorten the active growth phase and increase shedding",
      };
    case "alopecia_areata":
      return {
        label: "autoimmune activity at the follicle",
        effect: "interrupt hair growth",
      };
    case "hbr":
      return {
        label: "hair-shaft damage from chemical or heat styling",
        effect: "drive breakage and thinning",
      };
    case "early_greying":
      return {
        label: "oxidative and neuroendocrine load",
        effect: "pressure melanocytes and the follicle environment",
      };
    case "night_shift":
      return {
        label: "shift-work circadian disruption",
        effect: "limit follicular recovery",
      };
    case "frequent_flyers":
      return {
        label: "frequent travel and jet-lag load",
        effect: "limit follicular recovery",
      };
    case "gi_endometriosis":
      return {
        label: "endometriosis-linked hormonal load",
        effect: "shorten the growth phase",
      };
    case "ttm":
      return {
        label: "mechanical follicle stress from hair-pulling",
        effect: "slow recovery of affected areas",
      };
    case "healthy_9":
      return {
        label: "pregnancy-linked nutrient demand",
        effect: "shift the hair cycle temporarily",
      };
    case "pattern":
    case "unknown":
      return null;
  }
}

// GLP-1 detection — EXPLICIT SIGNALS ONLY.
//
// "Rapid weight loss / Crash diet" was previously treated as a proxy for this
// scenario. It is not one: a patient who crash-dieted and never took a GLP-1
// agonist was told their shedding followed "GLP-1 therapy", naming a
// medication they had not reported. Rapid weight loss now maps to
// calorie-restriction / nutritional-deficit wording, and GLP-1 language is
// reserved for the questionnaire's own GLP-1 options.
function hasGlp1Signal(selections: Record<string, unknown>): boolean {
  const bucket = [
    ...collectEvidenceStrings(selections.cause),
    ...collectEvidenceStrings(selections.lifestyle),
    ...collectEvidenceStrings(selections.treatment),
    ...collectEvidenceStrings(selections.medical_detail as unknown),
  ]
    .map((v) => cleanText(v).toLowerCase())
    .join(" | ");
  return /glp[-\s]?1|semaglutide|tirzepatide|ozempic|wegovy|mounjaro/.test(bucket);
}

/**
 * Kit family → CLINICAL MECHANISM CLUSTER.
 *
 * The closing summary sentence describes what the plan does, not how many
 * boxes it contains. Kits that act on the same mechanism therefore collapse
 * into one purpose before any length decision is taken — a patient on Meta B
 * plus Thyroid Care is receiving "metabolic and thyroid support", not two
 * separate purposes worth of prose.
 *
 * This clustering is what keeps the summary inside its word band. It runs
 * BEFORE the purpose cap so length is managed by merging related clinical
 * meaning, never by truncating clinical content.
 */
const KIT_MECHANISM_CLUSTER: Record<KitFamily, string> = {
  phenotype_inflam: "inflammation and oxidative-stress control",
  meta_b: "metabolic and thyroid support",
  thyroid_care: "metabolic and thyroid support",
  pro_immune: "immune-linked follicle support",
  alopecia_areata: "immune-linked follicle support",
  peri_menopause: "hormonal-transition support",
  post_menopause: "hormonal-transition support",
  hysterectomy: "hormonal-transition support",
  lactihealth: "hormonal-transition support",
  healthy_9: "hormonal-transition support",
  night_shift: "circadian recovery support",
  frequent_flyers: "circadian recovery support",
  gi_gold: "gut and absorption support",
  gi_endometriosis: "endometriosis-linked hormonal support",
  iron_up: "iron recovery",
  te_gold: "acute-shedding support",
  rwl_shield: "rapid-weight-loss follicle protection",
  hbr: "hair-shaft repair",
  ttm: "behavioural-stress follicle recovery",
  early_greying: "melanocyte protection",
  pattern: "pattern protection",
  unknown: "targeted follicle support",
};

/**
 * How the closing sentence frames the plan.
 *
 * "sequenced" — the plan carries genuine clinical phasing, so "Treatment
 *   begins with X, followed by Y" states something true.
 * "concurrent" — the kit order is a priority ranking with no timing attached;
 *   the summary must not imply chronology the plan does not contain.
 */
export type TreatmentSequencingMode = "sequenced" | "concurrent";

/**
 * Decides whether the approved plan actually encodes clinical sequencing.
 *
 * `buildKitSequence` assigns `phase: i + 1` alongside `score: 100 - i * 8` —
 * a per-kit priority index, not a chronology, and `TreatmentPhase` carries no
 * duration or start-time field. A run of distinct phases 1..N is therefore
 * the signature of RANKING and must render as concurrent.
 *
 * Genuine phasing groups multiple kits under a shared phase number ("phase 1
 * is these three kits, phase 2 these two"). That grouping — or phase labels
 * that do not enumerate at all — is real sequencing information and earns the
 * "begins with / followed by" framing.
 *
 * The 1..N test is order-insensitive on purpose. When a doctor reorders the
 * approved kits the phase numbers travel with them, so the values arrive as a
 * permutation (2, 1, 3…). That is still a per-kit ranking, not chronology.
 */
export function detectSequencingMode(phases: readonly TreatmentPhase[]): TreatmentSequencingMode {
  const values = phases
    .map((phase) => (typeof phase.phase === "number" ? phase.phase : Number.NaN))
    .filter((value) => Number.isFinite(value));
  if (values.length < 2) return "concurrent";
  // A repeated phase number means kits are GROUPED into a phase — real phasing.
  if (new Set(values).size !== values.length) return "sequenced";
  // Otherwise: distinct values that are a permutation of 1..N are a per-kit
  // enumeration (ranking). Anything else is a deliberate phase labelling.
  const sorted = [...values].sort((a, b) => a - b);
  const isPerKitEnumeration = sorted.every((value, index) => value === index + 1);
  return isPerKitEnumeration ? "concurrent" : "sequenced";
}

function buildTreatmentStrategy(
  kits: PrintTreatmentKit[],
): Array<{ kitCode: string; phrase: string }> {
  const strategy: Array<{ kitCode: string; phrase: string }> = [];
  for (const kit of kits) {
    // Mechanism cluster, not per-kit purpose: kits acting on the same
    // mechanism collapse to one phrase so the closing sentence describes
    // clinical intent rather than enumerating the box count. The per-kit
    // record is preserved so validation can still prove every approved kit
    // is represented.
    strategy.push({ kitCode: kit.kitCode, phrase: KIT_MECHANISM_CLUSTER[classifyKit(kit)] });
  }
  return strategy;
}

/**
 * Doctor-Reviewed Result — one connected clinical story that:
 *   (1) separates underlying pattern from active shedding trigger,
 *   (2) explicitly justifies approved kit #1 in the second sentence,
 *   (3) surfaces additional contributors + mechanism,
 *   (4) closes with a treatment strategy in the exact approved kit order.
 *
 * Never hand-templated. The primary active-trigger sentence is derived from
 * kit #1's family (see `activeTriggerSentenceFor`); the treatment-strategy
 * sentence is derived from each approved kit's family in the doctor-approved
 * order.
 */
function buildNarrative(
  report: ClinicalReport,
  drivers: PrintDriverCard[],
  primary: string,
  kits: PrintTreatmentKit[],
): OnePageReportNarrative {
  const selections = (report.patientSummary.questionnaireSelections ?? {}) as Record<string, unknown>;

  // Diagnosis phrasing: prefer "at Ludwig 2" / "at Norwood III" over hyphen.
  const primaryPhrase = primary.replace(/\s*[-–—]\s*(Ludwig|Norwood)/i, " at $1");
  const patternDx = /(male|female) pattern hair loss|ludwig|norwood/i.test(primaryPhrase);
  const underlyingPattern = patternDx ? primaryPhrase : "";

  // Shedding count + duration. Kept compact — the 55–80 word target leaves
  // no room for filler ("noticeable shedding of approximately …") in the
  // opening sentence.
  const activityRaw = shortText(selections.count, "", 40);
  const cleanedCount = activityRaw.replace(/^~\s*/, "").replace(/\s*\(.*$/, "").trim();
  const duration = shortText(selections.duration ?? report.patientSummary.hairLossDuration, "the current review window", 34);
  const activityFragment = cleanedCount && !/not (recorded|applicable)/i.test(cleanedCount)
    ? `shedding of ${cleanedCount} over ${duration}`
    : `active shedding over ${duration}`;

  // Primary active driver — linked to approved kit #1.
  const firstKit = kits[0] ?? null;
  const firstFamily = firstKit ? classifyKit(firstKit) : null;
  const isDoctorAdded = !!firstKit && firstKit.clinicianAdded === true;
  const trigger = firstFamily ? activeTriggerFor(firstFamily, { hasGlp1Signal: hasGlp1Signal(selections) }) : null;

  let primaryActiveDriver: OnePageReportNarrative["primaryActiveDriver"] = null;
  if (firstKit && firstFamily && firstFamily !== "pattern") {
    if (isDoctorAdded) {
      // Kit #1 has no patient-supported trigger — the doctor added it. Do
      // not invent a cause; state that plainly. Validation surfaces a
      // warning so the wording can be reviewed.
      const purpose = KIT_STRATEGY_PHRASE[firstFamily];
      primaryActiveDriver = {
        kitCode: firstKit.kitCode,
        label: purpose,
        effect: "",
        sentence: `Your doctor has added ${purpose} as part of your recovery plan.`,
        doctorAdded: true,
      };
    } else if (trigger) {
      const tail = patternDx ? " on top of the underlying pattern sensitivity" : "";
      primaryActiveDriver = {
        kitCode: firstKit.kitCode,
        label: trigger.label,
        effect: trigger.effect,
        sentence: `Current shedding may be linked to ${trigger.label}, which can ${trigger.effect}${tail}.`,
        doctorAdded: false,
      };
    }
  }

  // Secondary contributors — patient-selected labels, minus anything already
  // covered by the primary active trigger so the paragraph doesn't double-
  // count. Every contributor is anchored in a patient selection field
  // (see buildContributorList), so no unsupported factor can leak in. Cap
  // at 3 to hit the 55–80 word conclusion target.
  const allContributors = buildContributorList(selections, drivers).slice(0, 6);
  const primaryLabelLower = primaryActiveDriver?.label.toLowerCase() ?? "";
  const primaryFirstWord = primaryLabelLower.split(/\s+/)[0] ?? "";
  const secondaryDrivers = allContributors.filter((label) => {
    const lower = label.toLowerCase();
    // Drop contributors that would just restate the primary trigger.
    if (primaryFirstWord && lower.startsWith(primaryFirstWord)) return false;
    if (primaryActiveDriver?.kitCode.startsWith("RAPID_WEIGHT") && /rapid weight|crash diet/.test(lower)) return false;
    return true;
  }).slice(0, 3);

  const treatmentStrategy = buildTreatmentStrategy(kits);

  return {
    underlyingPattern,
    activityLine: activityFragment,
    primaryActiveDriver,
    secondaryDrivers,
    treatmentStrategy,
  };
}

// (strategyLabelForFamily removed — replaced by activeTriggerFor which
//  returns both the short label and the one-line clinical effect used by
//  the "may be mainly linked to X, which can Y" opener.)

/**
 * Maximum mechanism clusters named in the closing sentence.
 *
 * Content Master §3's template lists three purposes; the §6 doctor-reviewed
 * exemplar (a five-kit case) lists five. Five is therefore the approved
 * observed maximum.
 *
 * This is a backstop, not the length mechanism. Length is managed upstream by
 * KIT_MECHANISM_CLUSTER, which merges kits acting on the same mechanism into
 * one purpose before the cap is ever consulted. A plan that still exceeds five
 * DISTINCT mechanisms is genuinely multifactorial, so the remainder is
 * acknowledged rather than dropped, and every kit still renders in full in the
 * care-plan band below.
 */
const STRATEGY_PURPOSE_CAP = 5;

/** Closing phrase when a plan spans more than STRATEGY_PURPOSE_CAP mechanisms. */
const STRATEGY_OVERFLOW_PHRASE = "additional support for other identified contributors";

function composeConclusion(
  narrative: OnePageReportNarrative,
  sequencing: TreatmentSequencingMode,
): string {
  const parts: string[] = [];

  // Opener. Content Master §3: lead with the diagnosis and use the approved
  // softener ("is consistent with") — never a definitive statement of cause.
  //
  // When NO pattern diagnosis was captured, §3 requires the summary to open
  // "Your responses suggest a combination of…". The previous version fell
  // back to the top contributing driver and still said "Your assessment is
  // consistent with <driver>", which presented a contributor (e.g. "Metabolic
  // dysfunction") to the patient as though it were their diagnosis. The
  // contributors are named properly in the third sentence below.
  if (narrative.underlyingPattern) {
    parts.push(
      `Your assessment is consistent with ${narrative.underlyingPattern}, with ${narrative.activityLine}.`,
    );
  } else {
    parts.push(
      `Your responses suggest a combination of contributing factors, with ${narrative.activityLine}.`,
    );
  }

  if (narrative.primaryActiveDriver) {
    parts.push(narrative.primaryActiveDriver.sentence);
  }
  if (narrative.secondaryDrivers.length > 0) {
    parts.push(
      `${capitaliseFirst(humanJoin(narrative.secondaryDrivers))} may contribute further to slower recovery.`,
    );
  }

  // Closing sentence: treatment PURPOSES, never kit names (Content Master §3),
  // already collapsed into mechanism clusters by buildTreatmentStrategy.
  //
  // Framing depends on what the plan actually encodes. "begins with / followed
  // by" asserts chronology, so it is used ONLY when detectSequencingMode finds
  // genuine clinical phasing. The default kit order is a priority ranking with
  // no timing attached, and stating it as a sequence would tell the patient
  // something the plan does not say.
  const uniquePhrases: string[] = [];
  const seen = new Set<string>();
  for (const entry of narrative.treatmentStrategy) {
    if (seen.has(entry.phrase)) continue;
    seen.add(entry.phrase);
    uniquePhrases.push(entry.phrase);
  }
  if (uniquePhrases.length > 0) {
    const named =
      uniquePhrases.length > STRATEGY_PURPOSE_CAP
        ? [...uniquePhrases.slice(0, STRATEGY_PURPOSE_CAP - 1), STRATEGY_OVERFLOW_PHRASE]
        : uniquePhrases;
    if (sequencing === "sequenced") {
      const [head, ...tail] = named;
      const tailClause = tail.length > 0 ? `, followed by ${humanJoin(tail)}` : "";
      parts.push(`Treatment begins with ${head}${tailClause}.`);
    } else {
      parts.push(`Your treatment plan addresses these factors through ${humanJoin(named)}.`);
    }
  }
  return normaliseWhitespace(parts.join(" "));
}

function buildConclusion(
  report: ClinicalReport,
  drivers: PrintDriverCard[],
  primary: string,
  kits: PrintTreatmentKit[] = [],
): { text: string; narrative: OnePageReportNarrative } {
  const narrative = buildNarrative(report, drivers, primary, kits);
  const sequencing = detectSequencingMode(toArray<TreatmentPhase>(report.treatmentStrategy));
  return { text: composeConclusion(narrative, sequencing), narrative };
}

// Patient-facing labels for contributing factors, derived from questionnaire
// selections. Returns labels in clinical-weight order and de-duplicates.
function buildContributorList(
  selections: Record<string, unknown>,
  drivers: PrintDriverCard[],
): string[] {
  const list: string[] = [];
  const push = (label: string) => {
    if (!label) return;
    const key = label.toLowerCase();
    if (list.some((existing) => existing.toLowerCase() === key)) return;
    list.push(label);
  };
  const hormonal = collectEvidenceStrings(selections.hormonal).map((v) => cleanText(v).toLowerCase());
  if (hormonal.some((v) => /peri.?menopause/.test(v))) push("peri-menopausal hormonal transition");
  else if (hormonal.some((v) => /post.?menopause/.test(v))) push("post-menopausal hormonal shift");
  else if (hormonal.some((v) => /menopause/.test(v))) push("menopausal hormonal transition");
  if (hormonal.some((v) => /pcos|pcod/.test(v))) push("PCOS/PCOD hormonal drive");

  const thyroid = collectEvidenceStrings(selections.thyroid).map((v) => cleanText(v).toLowerCase());
  if (thyroid.some((v) => /hypothyroid/.test(v))) push("hypothyroidism");
  else if (thyroid.some((v) => /hyperthyroid/.test(v))) push("hyperthyroidism");

  if (hormonal.some((v) => /heavy bleed|heavy period|menstrual/.test(v))) push("heavy menstrual blood loss");

  const lifestyle = collectEvidenceStrings(selections.lifestyle).map((v) => cleanText(v).toLowerCase());
  const metabolic = collectEvidenceStrings(selections.metabolic).map((v) => cleanText(v).toLowerCase());
  const metabolicSignals = [...lifestyle, ...metabolic];
  if (metabolicSignals.some((v) => /obes|weight|prediabet|diabet|insulin|sedentary/.test(v))) push("metabolic stress");

  const scalp = collectEvidenceStrings(selections.scalp).map((v) => cleanText(v).toLowerCase());
  if (scalp.some((v) => /dandruff|itch|flake|redness|inflam|seborr/.test(v))) push("scalp inflammation");

  const gut = collectEvidenceStrings(selections.gut).map((v) => cleanText(v).toLowerCase());
  if (gut.some((v) => /ibs|crohn|gerd|acid reflux|bloat|indigest|constipat|leaky/.test(v))) push("gut dysfunction");

  const cause = collectEvidenceStrings(selections.cause).map((v) => cleanText(v).toLowerCase());
  if (cause.some((v) => /stress|anxiet|depress/.test(v))) push("stress-driven shedding");
  if (cause.some((v) => /nutrition/.test(v))) push("nutritional gaps");

  const deficiency = collectEvidenceStrings(selections.deficiency).map((v) => cleanText(v).toLowerCase());
  if (deficiency.some((v) => /pre.?diabet/.test(v))) push("pre-diabetic metabolic stress");
  else if (deficiency.some((v) => /diabet|insulin/.test(v))) push("insulin-linked metabolic stress");

  const immunity = collectEvidenceStrings(selections.immunity).map((v) => cleanText(v).toLowerCase());
  if (immunity.some((v) => /areata|autoimmune/.test(v))) push("autoimmune activity");
  else if (immunity.some((v) => /allerg|hypersensitiv|asthma|skin rash|frequent/.test(v))) push("immune-related factors");

  // Fall back to driver titles if the questionnaire fields did not yield any
  // patient-friendly labels (defensive; the questionnaire almost always does).
  if (list.length === 0) {
    for (const d of drivers.slice(0, 4)) push(d.title.toLowerCase());
  }
  return list.slice(0, 6);
}

// Strategy phrases composed from the actual approved kits, so the paragraph
// always ties back to what the patient will receive.
function buildStrategyList(kits: PrintTreatmentKit[], evidence: string): string[] {
  const strategies: string[] = [];
  const push = (phrase: string) => {
    if (!phrase) return;
    if (strategies.some((existing) => existing === phrase)) return;
    strategies.push(phrase);
  };
  for (const kit of kits) {
    const text = `${kit.kitCode} ${kit.name}`.toLowerCase();
    if (/fphl|mphl|pattern|androgen/.test(text)) push("pattern protection");
    if (/peri.?menopause|post.?menopause|hysterectomy|hrt|lacti/.test(text)) push("hormonal-transition support");
    if (/hypothyroid|meta[ _-]?b|metabolic/.test(text)) push("thyroid and metabolic support");
    if (/hyperthyroid|thyroid care/.test(text)) push("thyroid support");
    if (/iron up|ferritin/.test(text)) push("iron recovery");
    if (/phenotype.*inflam|inflam/.test(text)) push("scalp-inflammation control");
    if (/te gold|telogen/.test(text)) push("acute shedding support");
    if (/gi gold|gut/.test(text)) push("gut-linked recovery");
    if (/pro immune|areata/.test(text)) push("immune-linked follicle support");
    if (/early greying/.test(text)) push("melanocyte protection");
    if (/rwl|rapid weight/.test(text)) push("rapid-weight-loss follicle shielding");
  }
  // Pattern protection is the anchor when the diagnosis is FPHL/MPHL, even if
  // no explicit pattern kit is present (topicals cover it).
  if (strategies.length > 0 && !strategies.includes("pattern protection") && /ludwig|norwood|fphl|mphl|pattern/i.test(evidence)) {
    strategies.unshift("pattern protection");
  }
  return strategies.slice(0, 6);
}

function humanJoin(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
function capitaliseFirst(text: string): string {
  return text.length ? text[0].toUpperCase() + text.slice(1) : text;
}
function normaliseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function compactBenefit(value: unknown): string {
  const text = cleanText(value);
  if (!text) return "";
  const label = text.replace(/\s+-\s+|\s*->\s*/g, " -> ").split(" -> ")[0] ?? text;
  if (text.length > LIMITS.benefit && label !== text) return shortSentence(`Supports ${label.toLowerCase()}`, "", LIMITS.benefit);
  return shortSentence(text, "", LIMITS.benefit);
}
function benefitBullets(phase: TreatmentPhase): string[] {
  const kitText = cleanText(`${phase.kitId ?? ""} ${phase.displayName ?? ""}`).toLowerCase();
  if (/iron|ferritin|blood/.test(kitText)) return ["Helps replenish iron stores.", "Supports oxygen delivery to follicles.", "Supports deficiency-related shedding."];
  if (/phenotype|inflam|scalp/.test(kitText)) return ["Helps calm scalp inflammation.", "Supports a healthier scalp barrier.", "Reduces stress around sensitive follicles."];
  if (/hyperthyroid|thyroid care/.test(kitText)) return ["Supports thyroid-linked follicle health.", "Helps stabilise metabolic drive.", "Reduces thyroid-related shedding stress."];
  if (/meta[-\s]?b|metabolic|insulin|hypothyroid/.test(kitText)) return ["Supports insulin sensitivity.", "Helps improve metabolic balance.", "Supports follicular energy supply."];
  if (/immune|areata/.test(kitText)) return ["Build immunity.", "Helps reduce inflammatory stress.", "Protects the follicle environment."];
  if (/fphl|mphl|pattern|androgen/.test(kitText)) return ["Helps reduce androgen impact.", "Protects sensitive follicles.", "Supports stronger hair growth."];
  if (/early greying|melanin/.test(kitText)) return ["Oxidative stress protection — shields melanocytes.", "Supports melanocyte function and melanin pathways.", "Stress and neuroendocrine regulation reduces cortisol load."];
  if (/hbr|breakage/.test(kitText)) return ["Helps repair shaft damage.", "Strengthens the hair fibre.", "Supports resilience against chemical / heat stress."];
  if (/te gold|telogen/.test(kitText)) return ["Helps calm acute shedding.", "Supports the stress-shedding axis.", "Restores nutritional foundation for hair cycle."];
  if (/gi gold|gut/.test(kitText)) return ["Supports gut barrier function.", "Helps improve nutrient absorption.", "Reduces gut-driven inflammatory load."];
  if (/peri.?menopause|post.?menopause|hysterectomy|hrt|lacti|postpartum/.test(kitText)) return ["Supports hormonal-transition follicle health.", "Helps stabilise the hair cycle through hormonal shifts.", "Reduces transition-related shedding stress."];
  if (/rapid weight|rwl|glp/.test(kitText)) return ["Shields follicles during rapid weight loss.", "Supports nutrient recovery.", "Helps limit calorie-restriction shedding."];
  if (/night shift|frequent fly|circadian/.test(kitText)) return ["Supports circadian follicle rhythm.", "Helps counter travel / shift oxidative load.", "Restores nutritional recovery windows."];
  if (/ttm|trichotillo/.test(kitText)) return ["Supports follicle recovery from mechanical stress.", "Helps calm scalp irritation from pulling.", "Reinforces regrowth capacity."];
  if (/pregnan|healthy.?9/.test(kitText)) return ["Pregnancy-safe follicle nutrition.", "Supports maternal micronutrient balance.", "Prepares scalp for postpartum recovery."];
  const mechanisms = toArray<string>(phase.mechanismOfAction).map(compactBenefit).filter(Boolean);
  const groups = toArray<{ action?: unknown }>(phase.formulationGroups).map((group) => compactBenefit(group.action)).filter(Boolean);
  const source = mechanisms.length > 0 ? mechanisms : groups;
  return uniq(source.length > 0 ? source : [
    "Supports responsive follicles.",
    "Helps stabilise the scalp environment.",
    "Supports treatment consistency.",
  ]).slice(0, 3);
}

function mapKitNameForDisplay(rawName: string, code: string): string {
  const text = cleanText(`${code} ${rawName}`).toUpperCase().replace(/_/g, " ");
  if (/PHENOTYPE.*INFLAM/.test(text)) return "Phenotype Inflammation";
  // Patient-facing: expand internal MPHL/FPHL abbreviations. Internal asset
  // lookup (kitAssetCode) still uses the short codes.
  // Patient-facing display keeps the short kit name (MPHL Pro / FPHL Pro) —
  // full-form expansion is redundant on the report where the diagnosis line
  // already spells out Male / Female Pattern Hair Loss.
  if (/\bMPHL\b|MALE PATTERN/.test(text)) return "MPHL Pro";
  if (/\bFPHL\b|FEMALE PATTERN/.test(text)) return "FPHL Pro";
  if (/META[-\s]?B.*PCOS/.test(text)) return "Pro Fact Meta B PCOS";
  if (/META[-\s]?B.*HYPOTHYROID/.test(text)) return "Pro Fact Meta B Hypothyroid";
  if (/META[-\s]?B.*POST/.test(text)) return "Pro Fact Meta B Postmenopause";
  if (/META[-\s]?B/.test(text)) return "Pro Fact Meta B";
  if (/PRO FACT THYROID CARE|HYPERTHYROID/.test(text)) return "Pro Fact Thyroid Care";
  if (/TE GOLD/.test(text)) return "Hair Fact TE Gold";
  if (/IRON UP/.test(text)) return "Iron Up Gold";
  if (/PRO FACT GI GOLD|GI GOLD/.test(text)) return "Pro Fact GI Gold";
  if (/PRO IMMUNE/.test(text)) return "Pro Immune 5";
  if (/HAIR FACT PERI MENOPAUSE|PERI[-\s]?MENOPAUSE/.test(text)) return "Hair Fact Peri Menopause";
  if (/HAIR FACT HAIR BREAKAGE REPAIR|\bHBR\b|BREAKAGE/.test(text)) return "Hair Fact Hair Breakage Repair (HBR)";
  if (/EARLY GREYING/.test(text)) return "Early Greying Care Gold";
  if (/OXIDATIVE STRESS/.test(text)) return "Oxidative Stress";
  if (/\bFH WELL 3\b|ENDOMETRIOSIS/.test(text)) return "FH Well 3";
  if (/HEALTHY\s*-\s*9|PREGNANCY/.test(text)) return "Healthy-9";
  if (/ALOPECIA AREATA/.test(text)) return "Hair Fact Alopecia Areata";
  if (/LACTI/.test(text)) return "Lactihealth";
  if (/RAPID WEIGHT|RWL/.test(text)) return "Rapid Weight Loss Shield";
  if (/NIGHT SHIFT/.test(text)) return "Hair Fact Night Shift";
  if (/FREQUENT FLY/.test(text)) return "Hair Fact Frequent Flyers";
  if (/TRICHOTILLOMANIA|TTM/.test(text)) return "Hair Fact TTM";
  if (/POST[-\s]?HYSTERECTOMY|HYSTERECTOMY|\bHRT\b/.test(text)) return "Pro Fact Post Hysterectomy Reset";
  return shortText(rawName || code, code, LIMITS.kitName);
}

function canonicalConditionForKit(rawName: string, code: string): string | null {
  const text = cleanText(`${code} ${rawName}`).toUpperCase().replace(/_/g, " ");
  if (/PHENOTYPE.*INFLAM/.test(text)) return "Scalp/perifollicular inflammation";
  if (/\bMPHL\b|MALE PATTERN/.test(text)) return "Male androgenetic pattern";
  if (/\bFPHL\b|FEMALE PATTERN/.test(text)) return "Female androgenetic pattern";
  if (/META[-\s]?B.*PCOS/.test(text)) return "PCOS/PCOD";
  if (/META[-\s]?B.*HYPOTHYROID/.test(text)) return "Hypothyroidism";
  if (/META[-\s]?B.*POST/.test(text)) return "Post-menopause";
  if (/META[-\s]?B/.test(text)) return "Metabolic dysfunction";
  if (/PRO FACT THYROID CARE|HYPERTHYROID/.test(text)) return "Hyperthyroidism";
  if (/TE GOLD/.test(text)) return "Acute shedding (3 months or less)";
  if (/IRON UP/.test(text)) return "Iron deficiency / heavy menstrual bleeding";
  if (/PRO FACT GI GOLD|GI GOLD/.test(text)) return "Gut dysfunction";
  if (/PRO IMMUNE/.test(text)) return "Immune depletion / regrowth support";
  if (/HAIR FACT PERI MENOPAUSE|PERI[-\s]?MENOPAUSE/.test(text)) return "Peri-menopause";
  if (/HAIR FACT HAIR BREAKAGE REPAIR|\bHBR\b|BREAKAGE/.test(text)) return "Hair breakage";
  if (/EARLY GREYING/.test(text)) return "Early greying";
  if (/OXIDATIVE STRESS/.test(text)) return "Oxidative stress";
  if (/\bFH WELL 3\b|ENDOMETRIOSIS/.test(text)) return "Endometriosis";
  if (/HEALTHY\s*-\s*9|PREGNANCY/.test(text)) return "Pregnancy";
  if (/ALOPECIA AREATA/.test(text)) return "Alopecia areata";
  if (/LACTI/.test(text)) return "Postpartum / lactation";
  // Kit indication must not name GLP-1: this string can surface as a trigger
  // chip / meaning fallback for a patient who never reported a GLP-1 agonist.
  // Genuine GLP-1 patients still get GLP-1 wording via the trigger-gated
  // variant in clinicalCopy and the primaryActiveDriver label.
  if (/RAPID WEIGHT|RWL/.test(text)) return "Rapid weight loss / calorie restriction";
  if (/NIGHT SHIFT/.test(text)) return "Night-shift work";
  if (/FREQUENT FLY/.test(text)) return "Frequent flying";
  if (/TRICHOTILLOMANIA|TTM/.test(text)) return "Trichotillomania (hair pulling / OCD)";
  if (/POST[-\s]?HYSTERECTOMY|HYSTERECTOMY|\bHRT\b/.test(text)) return "Post-hysterectomy / HRT hormonal reset";
  return null;
}

// Benefit-oriented chip shown when a kit is approved by the doctor without a
// direct patient trigger. Replaces the generic "Clinician-added support" chip
// so the patient sees what the kit actually does for them (e.g. "Improves
// immunity") instead of an internal-facing sourcing label.
function clinicianAddedLabelForKit(rawName: string, code: string): string {
  const text = cleanText(`${code} ${rawName}`).toUpperCase().replace(/_/g, " ");
  if (/PHENOTYPE.*INFLAM/.test(text)) return "Calms scalp inflammation";
  if (/\bMPHL\b|MALE PATTERN/.test(text)) return "Slows pattern hair loss";
  if (/\bFPHL\b|FEMALE PATTERN/.test(text)) return "Protects pattern-sensitive follicles";
  if (/META[-\s]?B.*PCOS/.test(text)) return "Supports PCOS-linked hair health";
  if (/META[-\s]?B.*HYPOTHYROID/.test(text)) return "Supports thyroid-linked hair health";
  if (/META[-\s]?B.*POST/.test(text)) return "Supports post-menopausal balance";
  if (/META[-\s]?B/.test(text)) return "Restores metabolic balance";
  if (/PRO FACT THYROID CARE|HYPERTHYROID/.test(text)) return "Supports thyroid balance";
  if (/TE GOLD/.test(text)) return "Stabilises active shedding";
  if (/IRON UP/.test(text)) return "Restores iron stores";
  if (/PRO FACT GI GOLD|GI GOLD/.test(text)) return "Restores gut balance";
  if (/PRO IMMUNE/.test(text)) return "Improves immunity";
  if (/HAIR FACT PERI MENOPAUSE|PERI[-\s]?MENOPAUSE/.test(text)) return "Eases peri-menopausal transition";
  if (/HAIR FACT HAIR BREAKAGE REPAIR|\bHBR\b|BREAKAGE/.test(text)) return "Repairs hair breakage";
  if (/EARLY GREYING/.test(text)) return "Slows early greying";
  if (/OXIDATIVE STRESS/.test(text)) return "Reduces oxidative stress";
  if (/\bFH WELL 3\b|ENDOMETRIOSIS/.test(text)) return "Supports endometriosis-linked hair health";
  if (/HEALTHY\s*-\s*9|PREGNANCY/.test(text)) return "Pregnancy-safe hair support";
  if (/ALOPECIA AREATA/.test(text)) return "Calms autoimmune follicle activity";
  if (/LACTI/.test(text)) return "Supports postpartum recovery";
  if (/RAPID WEIGHT|RWL/.test(text)) return "Buffers rapid weight-loss stress";
  if (/NIGHT SHIFT/.test(text)) return "Restores circadian hair rhythm";
  if (/FREQUENT FLY/.test(text)) return "Buffers travel-linked hair stress";
  if (/TRICHOTILLOMANIA|TTM/.test(text)) return "Supports trichotillomania recovery";
  if (/POST[-\s]?HYSTERECTOMY|HYSTERECTOMY|\bHRT\b/.test(text)) return "Supports post-hysterectomy hormonal reset";
  return "Clinician-added support";
}

function kitTagPattern(kitText: string): RegExp | null {
  const text = kitText.toLowerCase();
  if (/iron up/.test(text)) return /iron|ferritin|blood|bleed|menstrual|anaemi|anemi/i;
  // Phenotype Inflammation deliberately excludes `endometrio` — FH Well 3
  // is the endometriosis-specific kit, and matching endometriosis
  // interpretations here caused the Clinical Meaning column to reuse the
  // hormonal-load text for the inflammation row (visible on Ruchi).
  // `normal scalp` deliberately excluded — a healthy scalp is the *absence*
  // of an inflammation signal and must never surface as a trigger chip or
  // signal-interpretation feed for the Phenotype Inflammation kit. Match
  // only concrete inflammatory / oxidative signals.
  // `indigestion` / `constipation` / `bloat` deliberately excluded — these
  // map to "Gut dysbiosis" / "Gut dysfunction" clinicalInterpretation
  // entries (buildClinicalReport.ts gut-symptom rows), and matching them
  // here caused Phenotype Inflammation's Clinical Meaning to show gut-axis
  // text instead of its own inflammation interpretation.
  if (/phenotype.*inflam/.test(text)) return /oily scalp|dry scalp|dandruff|itch|flake|white\s*flake|psoriasis|inflam|seborr|boil|folliculitis|redness|burning|irritation|oxidative|smok|vaping|alcohol|recurrent acne|acne prone|acne|sensitive|age above 40|over 40|>\s*40/i;
  if (/meta[-\s]?b.*hypothyroid/.test(text)) return /metabolic|obes|weight|sedentary|pre.?diabet|diabet|insulin|hypothyroid|thyroid|genetic|family|polygenic|age above 40|over 40|>\s*40/i;
  if (/meta[-\s]?b.*pcos/.test(text)) return /pcos|pcod|metabolic|obes|weight|sedentary|pre.?diabet|diabet|insulin|genetic|family|polygenic|irregular period/i;
  if (/meta[-\s]?b.*post/.test(text)) return /post.?menopause|menopause|metabolic|obes|weight|sedentary|pre.?diabet|diabet|insulin|genetic|family|polygenic/i;
  if (/meta[-\s]?b/.test(text)) return /metabolic|obes|weight|sedentary|pre.?diabet|diabet|insulin|pcos|hypothyroid|hyperthyroid|thyroid|genetic|family|polygenic|age above 40|over 40|>\s*40/i;
  if (/thyroid care|hyperthyroid/.test(text)) return /hyperthyroid|thyroid/i;
  // Pro Immune trigger chips — include the immunity signals that now fire
  // the PRO IMMUNE gate (Skin rash / Eczema / Mouth-Tongue ulcer added
  // 2026-08-05) alongside the classical immune / autoimmune / infection
  // vocabulary. Without these tokens the trigger chip fell back to
  // "Clinician-added support" even after the gate fired.
  if (/pro immune/.test(text)) return /immune|autoimmune|allerg|infection|frequent|asthma|areata|regrowth|oxidative-immune|follic|skin rash|eczema|mouth ulcer|tongue ulcer|ulcer/i;
  if (/\bfphl\b|female pattern/.test(text)) return /female|androgen|ludwig|pattern|bodybuild|heavy gym|gym/i;
  if (/\bmphl\b|male pattern/.test(text)) return /male|androgen|norwood|pattern|dht|receding|crown|vertex|temple|bodybuild|heavy gym|gym/i;
  if (/early greying/.test(text)) return /grey|gray|greying|melanin|melanocyte|oxidative|smok|vaping|alcohol|stress|anxiet|depress|sleep|shift|pigment/i;
  if (/hbr|breakage/.test(text)) return /breakage|shaft|chemical|heat|styling|damage|split|colour|color|bleach/i;
  if (/te gold|telogen/.test(text)) return /shed|telogen|stress|anxiet|sleep|acute|crash|weight|illness|medication|fever|surgery|delivery|1-3 month|1.3.month/i;
  if (/alopecia areata/.test(text)) return /areata|autoimmune|patch|coin|circular|bald/i;
  if (/post.?hysterectomy|\bhrt\b|hysterectomy/.test(text)) return /hysterectomy|\bhrt\b|hormone replacement|surgical menopause|oophorectomy/i;
  if (/lacti/.test(text)) return /postpartum|post.?partum|breastfeed|lactat|delivery/i;
  if (/rapid weight|rwl/.test(text)) return /rapid weight|glp|crash|extreme diet|fasting|starvation/i;
  if (/night shift/.test(text)) return /night shift|shift work|circadian/i;
  if (/frequent fly/.test(text)) return /frequent fly|travel|flying|jet lag/i;
  if (/ttm|trichotillo/.test(text)) return /trichotillo|pulling|ocd/i;
  if (/gi gold/.test(text)) return /gerd|ibs|acid reflux|crohn/i;
  if (/peri.?menopause/.test(text)) return /peri.?menopause|menopause/i;
  if (/endometrios|fh well/.test(text)) return /endometrios/i;
  if (/pregnan|healthy.?9/.test(text)) return /pregnan/i;
  return null;
}

function tagRelevantToKit(kitText: string, tag: string): boolean {
  const pattern = kitTagPattern(kitText);
  return !pattern || pattern.test(tag);
}

function collectEvidenceStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(collectEvidenceStrings);
  if (value && typeof value === "object") return Object.values(value as Record<string, unknown>).flatMap(collectEvidenceStrings);
  return [];
}

function kitFromPhase(phase: TreatmentPhase): Omit<PrintTreatmentKit, "id" | "sequence" | "role" | "priority" | "selectedBecause" | "mappedDriverId"> & { code: string } {
  const code = cleanText(phase.kitId || phase.displayName).toUpperCase();
  const rawName = cleanText(phase.displayName, code);
  const kitCode = kitAssetCode(code || rawName);
  const kitText = `${code} ${rawName}`;
  const sourceLinkedDrivers = toArray<string>(phase.supportingConditions).map((condition) => shortText(condition, "", 46)).filter((tag) => tagRelevantToKit(kitText, tag)).slice(0, 4);
  const canonicalCondition = canonicalConditionForKit(rawName, code);
  const linkedDrivers = uniq([canonicalCondition ?? "", ...sourceLinkedDrivers]).filter(Boolean);
  return {
    code,
    name: mapKitNameForDisplay(rawName, code),
    kitCode,
    mappedCondition: canonicalCondition ?? "Assessment-linked hair concern",
    mappedInterpretation: null,
    linkedDrivers,
    benefits: benefitBullets(phase),
    asset: getProductAsset(kitCode),
  };
}

function meaningfulLinkedTag(value: string): boolean {
  const text = value.trim();
  return text.length > 2 && !/^(yes|no|none|normal|female|male|clinical|condition|support|concern|assessment-linked|not recorded|not flagged|not sure)$/i.test(text);
}
function uniqClinicalTags(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value
      .toLowerCase()
      .replace(/pre[\s-]*diabet(?:es|ic)?/g, "prediabetes")
      .replace(/.*\bobesity\b.*/g, "obesity")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Strip legacy "Grade N — " prefixes from grade values so the trigger chip
// carries the same short pattern-scale label the headline uses. The
// questionnaire stores values like "Grade 3 — Ludwig I-1" but the doctor-
// approved diagnosis reads "Female Pattern Hair Loss — Ludwig I-1"; without
// this normalisation the mapping row shows the raw "Grade 3 — …" wording
// that visibly conflicts with the headline.
function normalizeGradeTag(raw: string): string {
  return raw.replace(/^\s*Grade\s*\d+\s*[—–-]\s*/i, "").trim();
}

function questionnaireDriverOptions(report: ClinicalReport): string[] {
  const selections = (report.patientSummary.questionnaireSelections ?? {}) as Record<string, unknown>;
  // "immunity" lives here because responses like "Recurrent Acne / Acne prone
  // skin" belong on the Phenotype Inflammation kit (per the tag pattern) even
  // though the questionnaire files them as an immune-system prompt.
  const driverFields = ["cause", "scalp", "thyroid", "hormonal", "lifestyle", "diet", "deficiency", "gut", "immunity", "metabolic", "grade"];
  const base = driverFields
    .flatMap((field) =>
      collectEvidenceStrings(selections[field]).map((raw) =>
        field === "grade" ? normalizeGradeTag(raw) : raw,
      ),
    )
    .map((tag) => shortText(tag, "", 42))
    .filter(meaningfulLinkedTag);
  const derived: string[] = [];
  const ageRaw = report.patientSummary.age;
  const age = typeof ageRaw === "number" ? ageRaw : Number.parseInt(String(ageRaw ?? ""), 10);
  if (Number.isFinite(age) && age > 40) derived.push("Age above 40");
  return uniqClinicalTags([...base, ...derived]);
}

function patientLinkedTags(kit: { name: string; code: string }, report: ClinicalReport): string[] {
  const kitText = `${kit.code} ${kit.name}`;
  return questionnaireDriverOptions(report)
    .filter((tag) => tagRelevantToKit(kitText, tag))
    .slice(0, 4);
}

function scoreKitForDriver(kit: { name: string; linkedDrivers: string[]; benefits: string[] }, driver: PrintDriverCard): number {
  const haystack = `${kit.name} ${kit.linkedDrivers.join(" ")} ${kit.benefits.join(" ")}`.toLowerCase();
  const driverText = `${driver.title} ${driver.trigger} ${driver.explanation}`.toLowerCase();
  let score = 0;
  if (/iron|ferritin|blood|bleed|deficien/.test(haystack)) score += /iron|ferritin|blood|bleed|deficien/.test(driverText) ? 12 : -5;
  if (/meta|insulin|prediabetes|metabolic/.test(haystack)) score += /meta|insulin|prediabetes|diabetes|weight/.test(driverText) ? 10 : 0;
  if (/inflam|scalp|dandruff|seborr/.test(haystack)) score += /inflam|scalp|dandruff|sebum|flake|itch/.test(driverText) ? 10 : 0;
  if (/immune|areata/.test(haystack)) score += /immune|areata|autoimmune/.test(driverText) ? 10 : 0;
  const words = [driver.title, driver.trigger].flatMap((item) => item.toLowerCase().split(/[^a-z0-9]+/)).filter((word) => word.length > 3);
  return score + words.reduce((total, word) => total + (haystack.includes(word) ? 1 : 0), 0);
}

function roleForKit(text: string, index: number): string {
  if (/iron|ferritin|blood|bleed/i.test(text)) return "Foundation";
  if (/inflam|scalp|dandruff|seborr/i.test(text)) return "Inflammation control";
  if (/meta|insulin|pcos|weight|thyroid/i.test(text)) return "Metabolic support";
  if (/immune|areata/i.test(text)) return "Immune support";
  if (/mphl|fphl|pattern|dht|androgen/i.test(text)) return "Pattern protection";
  return index === 0 ? "Foundation" : "Follicle support";
}

function interpretationLookupForKit(kitText: string, report: ClinicalReport): { condition: string | null; interpretation: string | null } {
  const interpretations = toArray<{ condition?: unknown; signal?: unknown; interpretation?: unknown }>(report.patientSummary.clinicalInterpretation);
  if (interpretations.length === 0) return { condition: null, interpretation: null };
  const pattern = kitTagPattern(kitText);
  const match = interpretations.find((entry) => {
    const condition = cleanText(entry.condition);
    const signal = cleanText(entry.signal);
    if (!condition) return false;
    if (!pattern) return true;
    return pattern.test(condition) || pattern.test(signal);
  });
  return {
    condition: cleanText(match?.condition) || null,
    interpretation: cleanText(match?.interpretation) || null,
  };
}

function buildTreatmentPlan(
  drivers: PrintDriverCard[],
  phases: TreatmentPhase[],
  report: ClinicalReport,
): {
  primary: PrintTreatmentKit[];
  additional: PrintTreatmentKit[];
  suppressed: string[];
  kitValidation: KitValidationReport[];
} {
  const driverPool = drivers.length > 0 ? drivers : [{
    id: "fallback-driver",
    title: "Clinical support",
    priority: "Lifestyle Contributor" as const,
    trigger: "Assessment-linked concern",
    explanation: "Supports the hair-health concerns surfaced in this assessment.",
    illustration: "follicle" as const,
    conditionCode: "FOLLICLE_GENERAL",
    asset: getConditionAsset("FOLLICLE_GENERAL"),
    tone: "mint" as const,
  }];

  // Doctor-approval is authoritative: every approved phase produces a row in
  // the treatment plan. No upstream slice — the renderer chooses density from
  // the row count, but never silently drops an approved kit.
  const built = phases.map<{ kit: PrintTreatmentKit; phase: TreatmentPhase }>((phase, index) => {
    const source = kitFromPhase(phase);
    const ranked = [...driverPool].sort((a, b) => scoreKitForDriver(source, b) - scoreKitForDriver(source, a));
    const driver = ranked[0] ?? driverPool[index % driverPool.length];
    const isIronKit = /iron|ferritin|blood/i.test(`${source.code} ${source.name}`);
    const linkedDrivers = patientLinkedTags(source, report);
    const role = roleForKit(`${source.code} ${source.name} ${linkedDrivers.join(" ")}`, index);
    const interpretation = interpretationLookupForKit(`${source.code} ${source.name}`, report);
    return {
      phase,
      kit: {
        id: `${source.code}-${index}`,
        sequence: String(index + 1).padStart(2, "0"),
        role,
        priority: isIronKit ? "Supporting Contributor" : driver.priority,
        name: source.name,
        kitCode: source.kitCode,
        selectedBecause: shortSentence(linkedDrivers.join(", ") || driver.trigger, "This kit matches the doctor-reviewed driver pattern.", LIMITS.selectedBecause),
        mappedDriverId: driver.id,
        mappedCondition: interpretation.condition ?? source.mappedCondition,
        mappedInterpretation: interpretation.interpretation,
        linkedDrivers,
        benefits: source.benefits.map((benefit) => shortSentence(benefit, "Supports the treatment plan.", LIMITS.benefit)).slice(0, 3),
        asset: source.asset,
      },
    };
  });

  // Doctor approval is the final source of truth: every approved kit renders
  // in the approved order. Kits without a direct patient-selected trigger are
  // presented as clinician-added support (Triggered by: "Clinician-added
  // support"; support statement derived from the approved phase's own
  // whySelected content). Only exact code+name duplicates from the same
  // approved list are collapsed.
  const suppressed: string[] = [];
  const kitValidation: KitValidationReport[] = [];
  const seenSupport = new Set<string>();
  const withRationale: PrintTreatmentKit[] = [];
  for (const { kit, phase } of built) {
    const dedupeKey = `${kit.kitCode}::${kit.name.toLowerCase()}`;
    const record = (status: KitValidationStatus, reason?: string) => {
      kitValidation.push({ kitCode: kit.kitCode, name: kit.name, status, reason });
    };
    if (seenSupport.has(dedupeKey)) {
      record("duplicate_support", "Another kit with the same code was already selected");
      suppressed.push(`${kit.kitCode} (${kit.name})`);
      continue;
    }
    seenSupport.add(dedupeKey);

    const patternRationale = /mphl|fphl|pattern|androgen|areata/i.test(
      `${kit.kitCode} ${kit.name} ${kit.mappedCondition}`,
    );
    const hasPatientTrigger =
      kit.linkedDrivers.length > 0 || !!kit.mappedInterpretation || patternRationale;

    if (!hasPatientTrigger) {
      const whySelected = shortSentence(
        phase.whySelected,
        "Added by the reviewing doctor to support the treatment plan.",
        LIMITS.selectedBecause,
      );
      withRationale.push({
        ...kit,
        linkedDrivers: [clinicianAddedLabelForKit(kit.name, kit.kitCode)],
        selectedBecause: whySelected,
        clinicianAdded: true,
      });
      record("clinician_added", "Approved by doctor without a direct patient trigger");
    } else {
      withRationale.push(kit);
      record("valid");
    }
  }

  // Every doctor-approved kit renders in the doctor-approved order in the
  // primary treatment matrix. `additionalCare` is retained on the view model
  // for back-compat but no kit is ever moved into it silently; the renderer
  // downshifts density (comfortable → compact → ultra-compact) based on the
  // row count so 7–8 kits still fit on the sheet.
  const primary = withRationale;
  const additional: PrintTreatmentKit[] = [];

  return { primary, additional, suppressed, kitValidation };
}

function buildRecoveryTimeline(milestones: UniversalRecoveryMilestone[]): PrintTimelineStage[] {
  const source = milestones.length > 0 ? milestones : [
    { window: "1st Month", bullets: ["Scalp comfort and tolerance may improve."] },
    { window: "2nd Month", bullets: ["Shedding may begin to settle."] },
    { window: "4th Month", bullets: ["Hair quality may look stronger."] },
    { window: "5th Month Onwards", bullets: ["Maintenance remains the focus."] },
  ];
  const outcome = (indexes: number[], fallback: string) => shortSentence(indexes.flatMap((i) => source[i]?.bullets ?? []).join(" "), fallback, LIMITS.timelineOutcome);
  return [
    { window: "Day 0-30", title: "Calm the scalp and stabilise triggers", outcomes: [outcome([0], "Tolerance and scalp comfort may improve."), "Consistency is the key early signal."], illustration: "scalp", stageCode: "DAY_0_30", asset: getRecoveryStageIllustration("DAY_0_30") },
    { window: "Day 30-60", title: "Reduce shedding and rebuild support", outcomes: [outcome([1], "Shedding may begin to settle in responsive areas."), "Nutrition and topical rhythm continue."], illustration: "follicle", stageCode: "DAY_30_60", asset: getRecoveryStageIllustration("DAY_30_60") },
    { window: "Day 60-120", title: "Early follicular recovery", outcomes: [outcome([2, 3], "Strength and coverage may begin to improve."), "Early signs may appear gradually."], illustration: "recovery", stageCode: "DAY_60_120", asset: getRecoveryStageIllustration("DAY_60_120") },
    { window: "Beyond Day 120", title: "Visible improvement and consolidation", outcomes: [outcome([4, 3], "Maintenance and review guide the next step."), "Individual response varies."], illustration: "recovery", stageCode: "BEYOND_120", asset: getRecoveryStageIllustration("BEYOND_120") },
  ];
}
function topicalPurpose(name: string): string {
  if (/dandruff|biwash|scalp/i.test(name)) return "For dandruff, itching and scalp hygiene";
  if (/emugrow|minoxidil/i.test(name)) return "For pattern thinning and responsive scalp areas";
  if (/trichosilk|trichosure/i.test(name)) return "For hair-shaft and scalp-care support";
  if (/finasteride/i.test(name)) return "For pattern sensitivity if the doctor confirms";
  return "Adjunct topical and scalp-care support";
}

function topicalUsage(name: string, fallback: unknown): string {
  if (/biwash|dandruff|shampoo/i.test(name)) return "Use 2-3 times weekly as advised; leave briefly before rinsing.";
  if (/emugrow|minoxidil/i.test(name)) return "Apply once daily as prescribed. Massage gently. Do not rinse.";
  if (/trichosilk|trichosure/i.test(name)) return "Apply a small amount to hair lengths as advised. Do not rinse.";
  if (/finasteride/i.test(name)) return "Use only as prescribed after doctor review and tolerance check.";
  return shortSentence(fallback, "Use as advised by the doctor.", LIMITS.topicalUsage);
}

function buildLifestyleSupport(
  items: Array<{ label: string; text: string }>,
  report: ClinicalReport,
  drivers: PrintDriverCard[],
): OnePageReportViewModel["lifestyleSupport"] {
  const evidence = JSON.stringify({ patient: report.patientSummary, drivers, lifestyle: items }).toLowerCase();
  const has = (pattern: RegExp) => pattern.test(evidence);
  const supports = ["Follow the prescribed treatment plan"];

  if (has(/vegetarian|vegan/) && has(/iron|ferritin|blood|bleed|anaemi|anemi/)) supports.push("Iron-rich vegetarian nutrition");
  else if (has(/iron|ferritin|blood|bleed|anaemi|anemi/)) supports.push("Iron-rich nutrition");
  if (has(/protein|nutrition|diet|vegetarian|vegan|deficien/)) supports.push("Adequate protein intake");
  if (has(/scalp|dandruff|itch|inflam|flake|seborr/)) supports.push("Gentle scalp care");
  if (has(/smok|vaping/)) supports.push("Avoid smoking or vaping");
  if (has(/stress|cortisol|anxiety|sleep/)) supports.push("Stress-management practice");
  supports.push("Consistent sleep routine", "Regular walking or movement", "Hydration");
  supports.push("Medical follow-up");

  const slows = ["Inconsistent treatment use"];
  if (has(/smok|vaping/)) slows.unshift("Smoking or vaping");
  if (has(/alcohol/)) slows.push("Excess alcohol use");
  if (has(/heavy bleed|blood loss|menstrual|iron loss/)) slows.push("Unaddressed heavy bleeding");
  if (has(/dandruff|itch|inflam|flake|seborr/)) slows.push("Uncontrolled scalp inflammation");
  if (has(/crash diet|extreme diet|rapid weight|fasting|starvation/)) slows.push("Extreme dieting");
  if (has(/chemical|heat styling|hair damage|breakage/)) slows.push("Harsh chemical or heat styling");

  return {
    supports: uniq(supports.map((item) => shortText(item, "", LIMITS.lifestyleItem))).slice(0, 8),
    slows: uniq(slows.map((item) => shortText(item, "", LIMITS.lifestyleItem))).slice(0, 6),
  };
}

function resolveDoctorState(status: string | null | undefined, wasModified?: boolean | null): DoctorState {
  const normalized = cleanText(status).toUpperCase();
  if (normalized === "APPROVED") return "APPROVED";
  if (wasModified || normalized === "REVISION_REQUESTED" || normalized === "EDITS_REQUESTED") return "MODIFIED";
  if (normalized === "REJECTED" || normalized === "PENDING" || normalized === "PENDING_REVIEW") return "REVIEWED";
  return "DRAFT";
}

function chooseLayoutMode(data: Omit<OnePageReportViewModel, "validation" | "layoutMode">): PrintDensityMode {
  // Density downshifts by row count so approved kits never overflow off the
  // sheet: 1–4 comfortable, 5–6 compact, 7–8 ultra-compact.
  const rows = data.treatmentPlan.length + data.additionalCare.length;
  if (rows >= 7) return "compact";
  if (rows >= 5) return "dense";
  return "standard";
}

function collectReportText(data: Omit<OnePageReportViewModel, "validation">): string {
  return JSON.stringify(data);
}

function validate(
  data: Omit<OnePageReportViewModel, "validation">,
  suppressedKits: string[] = [],
  kitValidation: KitValidationReport[] = [],
  topicalValidation: TopicalValidationReport[] = [],
  approvedKitCodes: string[] = [],
): OnePageReportValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const allText = collectReportText(data);

  // ── Hard-fail: every doctor-approved kit must appear on the report ───────
  // Doctor approval is the source of truth. The rendered kit codes must
  // exactly match the approved set AND appear in the approved order. Silent
  // drops, renames, and out-of-order rows are all clinical-correctness
  // failures that block PDF generation.
  const renderedKitCodes = [...data.treatmentPlan, ...data.additionalCare].map((kit) => kit.kitCode);
  if (approvedKitCodes.length > 0) {
    const approvedCounts = new Map<string, number>();
    for (const code of approvedKitCodes) approvedCounts.set(code, (approvedCounts.get(code) ?? 0) + 1);
    const renderedCounts = new Map<string, number>();
    for (const code of renderedKitCodes) renderedCounts.set(code, (renderedCounts.get(code) ?? 0) + 1);
    const missing: string[] = [];
    for (const [code, count] of approvedCounts) {
      const rendered = renderedCounts.get(code) ?? 0;
      for (let i = 0; i < count - rendered; i += 1) missing.push(code);
    }
    const unexpected: string[] = [];
    for (const [code, count] of renderedCounts) {
      const approved = approvedCounts.get(code) ?? 0;
      for (let i = 0; i < count - approved; i += 1) unexpected.push(code);
    }
    const suppressedDetail =
      kitValidation
        .filter((kit) => kit.status !== "valid" && kit.status !== "clinician_added")
        .map((kit) => `${kit.kitCode} — ${kit.reason ?? kit.status}`)
        .join("; ") || suppressedKits.join("; ");
    if (missing.length > 0 || unexpected.length > 0) {
      const parts: string[] = [];
      if (missing.length > 0) parts.push(`missing approved codes: ${missing.join(", ")}`);
      if (unexpected.length > 0) parts.push(`unexpected rendered codes: ${unexpected.join(", ")}`);
      errors.push(
        `Approved kit set mismatch — ${parts.join("; ")}. Approved: [${approvedKitCodes.join(", ")}]; Rendered: [${renderedKitCodes.join(", ")}]${suppressedDetail ? `. Suppressed: ${suppressedDetail}` : ""}`,
      );
    } else if (
      approvedKitCodes.length === renderedKitCodes.length &&
      approvedKitCodes.some((code, i) => renderedKitCodes[i] !== code)
    ) {
      errors.push(
        `Approved kit order mismatch — approved: [${approvedKitCodes.join(", ")}]; rendered: [${renderedKitCodes.join(", ")}]`,
      );
    }
  }

  // ── Hard-fail: every rendered kit must be complete ───────────────────────
  for (const kit of [...data.treatmentPlan, ...data.additionalCare]) {
    if (!kit.name) errors.push(`Rendered kit is missing a name: ${kit.kitCode}`);
    if (!kit.asset) errors.push(`Rendered kit is missing a product image: ${kit.kitCode} (${kit.name})`);
    if (!kit.selectedBecause || kit.selectedBecause.trim().length === 0) {
      errors.push(`Rendered kit has no "Why this kit" support text: ${kit.kitCode} (${kit.name})`);
    }
    if (!kit.mappedCondition || kit.mappedCondition.trim().length === 0) {
      errors.push(`Rendered kit has no clinical meaning: ${kit.kitCode} (${kit.name})`);
    }
    // Trigger / fallback rationale — the "Triggered by" column must not be
    // blank. Either a real patient-selected trigger, a clinician-added
    // fallback label, or the kit's canonical clinical meaning must be
    // available for the renderer to show.
    if (kit.linkedDrivers.length === 0 && !kit.mappedCondition) {
      errors.push(`Rendered kit has no trigger or fallback rationale: ${kit.kitCode} (${kit.name})`);
    }
    for (const bullet of kit.benefits) {
      if (bullet && !/[.!?]$/.test(bullet.trim())) {
        errors.push(`Kit benefit line is unterminated: ${kit.kitCode} — "${bullet}"`);
      }
    }
  }

  // ── Hard-fail: diagnosis / doctor-reviewed result must be complete ───────
  const primary = data.clinicalResult.primary?.trim() ?? "";
  const conclusion = data.clinicalResult.conclusion?.trim() ?? "";
  if (!primary) errors.push("Doctor-Reviewed Result: primary diagnosis line is missing.");
  if (!conclusion) errors.push("Doctor-Reviewed Result: full explanation is missing.");
  if (conclusion && !/[.!?]$/.test(conclusion)) {
    errors.push("Doctor-Reviewed Result ends without a terminating punctuation — likely truncated.");
  }
  if (/\b(FPHL|MPHL)\b/.test(primary)) {
    errors.push("Doctor-Reviewed Result must expand FPHL/MPHL to the full patient-facing name.");
  }

  // ── Narrative invariants: one connected story from diagnosis → active
  //    trigger (kit #1) → contributors → strategy in kit order ─────────────
  const narrative = data.narrative;
  const renderedKits = data.treatmentPlan;
  const firstKit = renderedKits[0] ?? null;
  // Underlying pattern vs active-trigger distinction. Pattern kits (MPHL/
  // FPHL) must never be described as being caused by an active trigger — the
  // narrative expresses that by keeping `underlyingPattern` separate from
  // `primaryActiveDriver`.
  const patternDx = /(male|female) pattern hair loss|ludwig|norwood/i.test(primary);
  if (patternDx && !narrative.underlyingPattern) {
    errors.push(
      "Narrative: pattern diagnosis (Ludwig/Norwood) is missing from `underlyingPattern`.",
    );
  }
  if (narrative.primaryActiveDriver?.label) {
    const label = narrative.primaryActiveDriver.label.toLowerCase();
    if (/pattern hair loss|ludwig|norwood/.test(label)) {
      errors.push(
        `Narrative: underlying pattern (${narrative.primaryActiveDriver.label}) was placed in primaryActiveDriver — pattern loss is the underlying diagnosis, not the active shedding trigger.`,
      );
    }
  }
  // Kit #1 must be referenced in the concluding paragraph. Three acceptance
  // paths:
  //   (a) kit #1 is a pattern kit and the pattern is called out in the
  //       opening diagnosis sentence,
  //   (b) kit #1 has an active-trigger sentence anchored in patient signals
  //       and the primaryActiveDriver.kitCode matches, or
  //   (c) kit #1 was clinician-added with no supporting patient signal —
  //       the narrative uses the "Your doctor has added <purpose> as part of
  //       your recovery plan" fallback and a warning is surfaced.
  if (firstKit) {
    const firstFamily = classifyKit(firstKit);
    const patternKitIsFirst = firstFamily === "pattern";
    if (!patternKitIsFirst) {
      if (!narrative.primaryActiveDriver) {
        errors.push(
          `Doctor-Reviewed Result: approved kit #1 (${firstKit.kitCode}) has no active-trigger sentence in the narrative — the conclusion cannot justify why it is first.`,
        );
      } else if (narrative.primaryActiveDriver.kitCode !== firstKit.kitCode) {
        errors.push(
          `Doctor-Reviewed Result: primaryActiveDriver.kitCode (${narrative.primaryActiveDriver.kitCode}) does not match approved kit #1 (${firstKit.kitCode}).`,
        );
      } else if (!conclusion.includes(narrative.primaryActiveDriver.sentence)) {
        errors.push(
          `Doctor-Reviewed Result: kit #1 active-trigger sentence is missing from the conclusion.`,
        );
      } else if (narrative.primaryActiveDriver.doctorAdded) {
        warnings.push(
          `Doctor-Reviewed Result: kit #1 (${firstKit.kitCode}) was clinician-added — the conclusion uses the "Your doctor has added <purpose>…" wording. Please review the wording.`,
        );
      }
    }
    // Kit #1's strategy phrase must appear in the closing strategy sentence.
    const firstStrategyPhrase = narrative.treatmentStrategy[0]?.phrase;
    if (firstStrategyPhrase && !conclusion.includes(firstStrategyPhrase)) {
      errors.push(
        `Doctor-Reviewed Result: kit #1 strategy phrase ("${firstStrategyPhrase}") is missing from the conclusion.`,
      );
    }
  }
  // Every approved kit must contribute a strategy phrase or be explicitly
  // marked as unknown-family (the classifier's fallback). Unknown-family
  // kits get a warning so the doctor can review, not a hard error.
  if (narrative.treatmentStrategy.length !== renderedKits.length) {
    errors.push(
      `Narrative: treatmentStrategy has ${narrative.treatmentStrategy.length} entries but ${renderedKits.length} kits are approved — one strategy phrase per approved kit is required.`,
    );
  } else {
    for (let i = 0; i < renderedKits.length; i += 1) {
      const expected = renderedKits[i]!.kitCode;
      const actual = narrative.treatmentStrategy[i]!.kitCode;
      if (expected !== actual) {
        errors.push(
          `Narrative: treatmentStrategy[${i}].kitCode (${actual}) does not match approved kit #${i + 1} (${expected}) — the strategy sentence must follow the doctor-approved order.`,
        );
        break;
      }
      const family = classifyKit(renderedKits[i]!);
      if (family === "unknown") {
        warnings.push(
          `Narrative: kit ${expected} did not classify into a known family — using generic "targeted follicle support" phrase.`,
        );
      }
    }
  }
  // Ban generic conclusion phrasing — the whole point of the narrative
  // rewrite is to eliminate lines like "the plan addresses these conditions
  // together".
  // The ban targets CONTENTLESS phrasing — "the plan addresses these
  // conditions together" names nothing. The concurrent-mode closing sentence
  // ("Your treatment plan addresses these factors THROUGH iron recovery, gut
  // and absorption support…") uses the same stem but does enumerate the
  // mechanism clusters, so it satisfies the rule's intent and is exempted by
  // the lookahead rather than by weakening the rule.
  const genericPhrases = [
    /addresses these conditions together/i,
    /addresses these factors together/i,
    /addresses all of these together/i,
    /plan addresses these(?!\s+\w+\s+through\s+\S)/i,
  ];
  for (const rx of genericPhrases) {
    if (rx.test(conclusion)) {
      errors.push("Doctor-Reviewed Result contains a generic template phrase — the conclusion must connect kit-by-kit.");
      break;
    }
  }
  // Ban certainty language and "caused by" framing — the conclusion must use
  // tentative language ("may be mainly linked to", "may further reduce…").
  if (/\bis caused by\b|\bare caused by\b|\bcaused by\b/i.test(conclusion)) {
    errors.push(
      "Doctor-Reviewed Result uses certainty phrasing (\"caused by\") — clinical language must stay tentative (\"may be mainly linked to\", \"appears to be strongly influenced by\").",
    );
  }
  // Pattern-loss diagnosis must never appear as being caused by an active
  // trigger. Guard against phrasings that would blur underlying pattern and
  // active driver.
  const patternCausedRx =
    /(male pattern hair loss|female pattern hair loss|mphl|fphl|norwood|ludwig)[^.]{0,40}(caused|triggered|driven) by/i;
  if (patternCausedRx.test(conclusion)) {
    errors.push(
      "Doctor-Reviewed Result frames pattern loss as being caused by an active trigger — pattern is underlying susceptibility, active drivers layer on top.",
    );
  }
  // Doctor-Reviewed Result completeness.
  //
  // Length is a guide, not the contract. A genuinely low-signal case — one
  // kit, no active trigger, a single contributor — has less to say, and
  // padding it to clear an arbitrary floor would add words that no patient
  // answer supports. What actually has to be true is that the required
  // ELEMENTS are present:
  //
  //   • the diagnosis / pattern, when one was captured
  //   • the contributing factor(s), when any were reported
  //   • the treatment / support strategy
  //
  // With those present a concise 35–55 word summary is valid.
  //
  //   < 35       error — too short to carry the required elements at all.
  //   35–54      valid when every applicable element is present.
  //   55–80      preferred band.
  //   81–90      accepted for genuinely complex, multifactorial cases.
  //   > 90       warning — merge related answers into a shared mechanism
  //              cluster; never truncate clinical content.
  const wordCount = conclusion.trim().length > 0
    ? conclusion.trim().split(/\s+/).filter(Boolean).length
    : 0;

  // "Applicable" matters: a case with no captured grade cannot be faulted for
  // omitting a diagnosis, and one with no reported contributors cannot be
  // faulted for omitting them.
  const statesDiagnosis =
    !narrative?.underlyingPattern ||
    conclusion.includes(narrative.underlyingPattern) ||
    /Your responses suggest a combination of/.test(conclusion);
  const hasContributorsToState =
    (narrative?.secondaryDrivers?.length ?? 0) > 0 || !!narrative?.primaryActiveDriver;
  const statesContributors =
    !hasContributorsToState ||
    !!narrative?.primaryActiveDriver ||
    /may contribute further to slower recovery/.test(conclusion);
  const hasStrategyToState = (narrative?.treatmentStrategy?.length ?? 0) > 0;
  const statesStrategy =
    !hasStrategyToState ||
    /Treatment begins with|addresses these factors through/.test(conclusion);

  const missingElements = [
    statesDiagnosis ? null : "diagnosis / pattern",
    statesContributors ? null : "contributing factors",
    statesStrategy ? null : "treatment strategy",
  ].filter(Boolean) as string[];

  if (wordCount > 0 && missingElements.length > 0) {
    errors.push(
      `Doctor-Reviewed Result is missing required content: ${missingElements.join(", ")}.`,
    );
  } else if (wordCount > 0 && wordCount < 35) {
    errors.push(
      `Doctor-Reviewed Result is too short (${wordCount} words) to carry the required elements — expected at least a diagnosis and a treatment strategy.`,
    );
  } else if (wordCount > 90) {
    warnings.push(
      `Doctor-Reviewed Result runs long (${wordCount} words; preferred 55–80, accepted to 90) — collapse related contributors or kit purposes into a shared mechanism cluster rather than trimming clinical content.`,
    );
  } else if (wordCount > 0 && wordCount < 55) {
    // Informational only — a concise low-signal summary is a valid outcome.
    warnings.push(
      `Doctor-Reviewed Result is concise (${wordCount} words; preferred 55–80) — accepted because every applicable element is present. Do not pad to reach a word count.`,
    );
  }
  // Suppressed recommendations stay out of the patient-facing plan, while the
  // structured validation output preserves the exact reason for doctor review.
  const reportedSuppressedKits = new Set<string>();
  for (const kit of kitValidation) {
    if (kit.status === "valid") continue;
    const label = `${kit.kitCode} (${kit.name})`;
    if (kit.status === "clinician_added") {
      warnings.push(`Kit rendered as clinician-added support (no direct patient trigger): ${label}`);
      continue;
    }
    reportedSuppressedKits.add(label);
    warnings.push(`Kit suppressed from patient report — ${kit.reason ?? kit.status}: ${label}`);
  }
  for (const kit of suppressedKits) {
    if (!reportedSuppressedKits.has(kit)) {
      warnings.push(`Kit suppressed from patient report: ${kit}`);
    }
  }
  for (const topical of topicalValidation) {
    if (topical.status === "valid") continue;
    warnings.push(`Topical suppressed from patient report — ${topical.reason ?? topical.status}: ${topical.topicalCode} (${topical.name || "unnamed"})`);
  }
  const clinicalIcons: ClinicalIconValidationReport[] = data.keyClinicalSnapshot.map((item) => ({
    optionCode: item.optionCode,
    label: item.label,
    status: item.assetStatus,
    assetPath: item.asset.src,
  }));
  for (const icon of clinicalIcons) {
    if (icon.status !== "exact") {
      warnings.push(`Clinical option icon uses ${icon.status}: ${icon.optionCode} (${icon.label})`);
    }
  }
  for (const kit of [...data.treatmentPlan, ...data.additionalCare]) {
    if (!kit.name) errors.push("Selected kit name is missing.");
    if (!kit.asset) warnings.push(`Missing product asset for selected kit: ${kit.kitCode} (${kit.name})`);
    if (/iron up/i.test(kit.name) && /metabolic|prediabetes|insulin/i.test(kit.selectedBecause) && !/iron|bleed|blood|ferritin/i.test(kit.linkedDrivers.join(" "))) {
      errors.push("Iron Up cannot map to metabolic dysfunction without explicit iron or blood-loss support.");
    }
  }
  for (const topical of data.topicalCare) {
    if (!topical.asset) warnings.push(`Topical packshot unavailable; using a labeled fallback for: ${topical.topicalCode} (${topical.name})`);
  }
  for (const driver of data.driverStory) {
    if (!driver.asset) warnings.push(`Missing condition asset for: ${driver.conditionCode} (${driver.title})`);
  }
  if (data.patient.imageAsset.source === "initials") warnings.push("Patient image asset missing; initials fallback would be required.");
  else if (data.patient.imageAsset.source !== "real_portrait" && data.patient.imageAsset.source !== "approved_upload") warnings.push(`Patient portrait fallback used: ${data.patient.imageAsset.key}`);
  if (data.doctorApproval.nextReviewDate === "To be scheduled") warnings.push("Next review date missing; using schedule fallback.");
  if (UNSUPPORTED_METRICS.some((pattern) => pattern.test(allText))) errors.push("Unsupported metric detected in one-page report text.");
  if (GUARANTEED_CLAIMS.some((pattern) => pattern.test(allText))) errors.push("Guaranteed claim detected in one-page report text.");
  return {
    ok: errors.length === 0,
    errors,
    warnings,
    kits: kitValidation.length > 0 ? kitValidation : undefined,
    topicals: topicalValidation.length > 0 ? topicalValidation : undefined,
    clinicalIcons: clinicalIcons.length > 0 ? clinicalIcons : undefined,
  };
}

export function mapClinicalReportToPrintPresentation(clinicalReport: ClinicalReport, context: OnePageReportContext): OnePageReportViewModel {
  const patient = clinicalReport.patientSummary;
  const selections = (patient.questionnaireSelections ?? {}) as Record<string, unknown>;
  const drivers = flattenDrivers(clinicalReport).slice(0, 5);
  const phases = toArray<TreatmentPhase>(clinicalReport.treatmentStrategy);
  const treatmentBuild = buildTreatmentPlan(drivers, phases, clinicalReport);
  const treatmentPlan = treatmentBuild.primary;
  const additionalCare = treatmentBuild.additional;
  const topicalBuild = buildTopicalCareWithValidation(clinicalReport);
  const keyClinicalSnapshot = buildKeyClinicalSnapshot(clinicalReport);
  const state = resolveDoctorState(context.approval?.status, context.approval?.wasModified);
  const lifestyleItems = toArray<{ condition?: unknown; recommendation?: unknown }>(clinicalReport.dietAndLifestyle)
    .map((item) => ({ label: shortText(item.condition, "Lifestyle", 24), text: shortSentence(item.recommendation, "Maintain sleep, diet and scalp-care consistency.", 78) }))
    .filter((item) => item.text)
    .slice(0, 2);
  const approvedBy = shortText(context.approval?.approvedBy || context.clinician?.name, "Reviewing doctor", 32);
  const hormonalSignal = drivers.find((driver) => /iron|ferritin|blood|bleed|hormone|pcos|menopause|hysterectomy|hrt/i.test(`${driver.title} ${driver.trigger}`));
  const patientEvidence = collectEvidenceStrings(patient.questionnaireSelections);
  const hormonalEvidence = patientEvidence.find((value) => meaningfulLinkedTag(value) && /iron|ferritin|blood|bleed|heavy period|menstrual|hormone|pcos|menopause|hysterectomy|hrt/i.test(value));
  const metabolicEvidence = patientEvidence.filter((value) => meaningfulLinkedTag(value) && /metabolic|obes|weight|sedentary|pre.?diabet|diabet|insulin|hypothyroid|hyperthyroid|thyroid/i.test(value));
  const ageRaw = patient.age;
  const patientAge = typeof ageRaw === "number" ? ageRaw : Number.parseInt(String(ageRaw ?? ""), 10);
  const thyroidEvidence = toArray<string>(selections.thyroid).map((value) => cleanText(value)).filter((value) => meaningfulLinkedTag(value) && /thyroid|hypothyroid|hyperthyroid/i.test(value));
  const metabolicBucket = [
    ...toArray<string>(selections.metabolic),
    ...toArray<string>(selections.deficiency).filter((value) => /pre.?diabet|diabet|insulin/i.test(String(value))),
    ...thyroidEvidence,
    ...metabolicEvidence,
    ...(Number.isFinite(patientAge) && patientAge > 40 ? ["Age above 40"] : []),
  ];

  const clinicalResultBundle = (() => {
    const primary = patientFriendlyResult(clinicalReport, drivers);
    const allKits = [...treatmentPlan, ...additionalCare];
    const built = buildConclusion(clinicalReport, drivers, primary, allKits);
    return {
      clinicalResult: {
        primary,
        supportingLine: buildSupportingLine(clinicalReport, drivers),
        conclusion: built.text,
        reviewedBy: `Reviewed by ${approvedBy}`,
      },
      narrative: built.narrative,
    };
  })();

  const dataWithoutMode: Omit<OnePageReportViewModel, "validation" | "layoutMode"> = {
    assessmentId: context.assessmentId,
    generatedAt: formatDate(context.generatedAt ?? clinicalReport.generatedAt, formatDate(new Date())),
    patient: {
      name: shortText(context.patient?.name || patient.name, "Patient", LIMITS.patientName),
      age: context.patient?.age || patient.age ? `${context.patient?.age ?? patient.age} yrs` : "Not recorded",
      gender: shortText(context.patient?.gender || patient.gender, "Not recorded", 18),
      imageUrl: context.patient?.imageUrl ?? null,
      imageAsset: resolvePatientImageAsset(context.patient?.imageUrl, context.patient?.gender || patient.gender || ""),
      goal: shortList(toArray<string>(patient.goal), "Hair recovery", 46),
      phone: context.patient?.phone ?? null,
    },
    clinic: {
      name: shortText(context.clinic?.name, "Dr. FACT Clinic", 44),
      address: shortText(context.clinic?.address, "", 60),
      phone: shortText(context.clinic?.phone, "", 24),
      logoUrl: context.clinic?.logoUrl ?? null,
    },
    clinician: {
      name: shortText(context.clinician?.name, "Reviewing doctor", 40),
      title: shortText(context.clinician?.title, "Doctor approved plan", 32),
    },
    clinicalResult: clinicalResultBundle.clinicalResult,
    narrative: clinicalResultBundle.narrative,
    driverStory: drivers,
    snapshotStrip: [
      // Order matters: PatientProfileBlock picks Goal/Duration/Shedding/Diet by
      // label, and normalizeSnapshot picks Suspected cause / Lifestyle / Gut /
      // Immunity / Scalp / Metabolic for the 6-card strip below the pattern.
      { label: "Goal", value: shortList(toArray<string>(selections.goal ?? patient.goal), "Hair recovery", 60), illustration: "recovery" },
      { label: "Duration", value: shortText(selections.duration ?? patient.hairLossDuration, "Not Applicable", 34), illustration: "recovery" },
      { label: "Shedding", value: shortText(selections.count, "Not Applicable", 34), illustration: "follicle" },
      { label: "Diet", value: shortList(toArray<string>(selections.diet), "Not recorded", 34), illustration: "nutrition" },
      { label: "Suspected cause", value: shortList(toArray<string>(selections.cause), "Not flagged", 55), illustration: "stress" },
      { label: "Lifestyle", value: shortList(toArray<string>(selections.lifestyle), "Not recorded", 55), illustration: "stress" },
      { label: "Gut", value: shortList(toArray<string>(selections.gut), "No major concern", 55), illustration: "nutrition" },
      { label: "Immunity", value: shortList(toArray<string>(selections.immunity), "No major concern", 55), illustration: "immune" },
      { label: "Scalp", value: shortList(toArray<string>(selections.scalp ?? patient.scalpConcerns), "No major concern", 55), illustration: "scalp" },
      { label: "Metabolic", value: shortList(metabolicBucket, "Not flagged", 55), illustration: "metabolic" },
      { label: "Pattern", value: shortText(selections.grade, shortList(toArray<string>(patient.hairLossPattern), "Not recorded", 34), 38), illustration: "follicle" },
      { label: "Hormonal / Blood-loss Signal", value: shortText(hormonalSignal?.trigger || hormonalSignal?.title || hormonalEvidence, "Not flagged", 38), illustration: "hormonal" },
    ],
    patternScale: buildPatternScale(selections.grade),
    keyClinicalSnapshot,
    treatmentPlan,
    additionalCare,
    topicalCare: topicalBuild.topicals,
    topicalNote:
      topicalBuild.topicals.length > 2 ? "See the complete approved topical plan in the digital report." : "",
    recoveryJourney: buildRecoveryTimeline(toArray<UniversalRecoveryMilestone>(clinicalReport.recoveryMilestones)),
    lifestyleSupport: buildLifestyleSupport(lifestyleItems, clinicalReport, drivers),
    guideUrl: context.guideUrl && /^https?:\/\//i.test(context.guideUrl) ? context.guideUrl : null,
    doctorApproval: {
      state,
      approvedAt: state === "APPROVED" ? formatDate(context.approval?.approvedAt, "Date pending") : "Awaiting final sign-off",
      approvedBy,
      nextReviewDate: formatDate(context.approval?.nextReviewDate),
      signatureUrl: context.clinician?.signatureUrl ?? null,
    },
    disclaimer: "Based on your submitted assessment and clinician review. This report supports, but does not replace, medical advice.",
  };

  const data = { ...dataWithoutMode, layoutMode: chooseLayoutMode(dataWithoutMode) };
  const approvedKitCodes = phases
    .map((phase) => kitAssetCode(cleanText(phase.kitId || phase.displayName).toUpperCase()))
    .filter((code) => code.length > 0);
  return {
    ...data,
    validation: validate(
      data,
      treatmentBuild.suppressed,
      treatmentBuild.kitValidation,
      topicalBuild.validation,
      approvedKitCodes,
    ),
  };
}

export function buildOnePageReportViewModel(clinicalReport: ClinicalReport, context: OnePageReportContext): OnePageReportViewModel {
  return mapClinicalReportToPrintPresentation(clinicalReport, context);
}












