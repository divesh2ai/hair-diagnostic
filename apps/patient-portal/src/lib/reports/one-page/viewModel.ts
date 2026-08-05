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

function buildKeyClinicalSnapshot(
  report: ClinicalReport,
  drivers: PrintDriverCard[],
  kits: PrintTreatmentKit[],
): PrintClinicalSnapshotItem[] {
  const seen = new Set<string>();
  const rows: PrintClinicalSnapshotItem[] = [];
  const push = (raw: string) => {
    const label = cleanText(raw);
    if (!label) return;
    const key = label.toLowerCase().replace(/\s+/g, " ").trim();
    if (seen.has(key)) return;
    // Filter out non-clinical fillers that would just be noise on the 10-tile grid.
    if (/^(yes|no|none|normal|not (recorded|applicable|flagged|sure)|female|male|assessment-linked)$/i.test(key)) return;
    if (isClinicalOptionExcluded(label)) return;
    seen.add(key);
    rows.push(snapshotTileFor(label));
  };
  const selections = (report.patientSummary.questionnaireSelections ?? {}) as Record<string, unknown>;
  // Question fields most predictive of the 10-tile clinical snapshot on the
  // Ruchi layout. Order controls tile placement: patient-selected clinical
  // signals first (scalp/hormone/thyroid/metabolic/lifestyle), then softer
  // context tags (diet/immunity/gut/cause).
  const priority = ["scalp", "hormonal", "thyroid", "metabolic", "immunity", "lifestyle", "cause", "diet", "gut", "deficiency"];
  for (const field of priority) for (const value of collectEvidenceStrings(selections[field])) push(value);
  for (const kit of kits) for (const linked of kit.linkedDrivers) push(linked);
  for (const driver of drivers) push(driver.title);
  return rows.slice(0, 10);
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

export type KitValidationStatus =
  | "valid"
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
  const canonicalStages = stages.slice(0, 3).map((stage) => ({
    ...stage,
    selected: selectedStage ? stage.label === selectedStage.label : stage.selected,
  }));
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
  if (/\bFPHL\b|FEMALE PATTERN/.test(text)) return "FPHL Pro";
  if (/MPHL.*PLUS/.test(text)) return "MPHL_PLUS";
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

/**
 * Doctor-Reviewed Result — a single composed paragraph that must include:
 *   (1) full diagnosis name + exact grade,
 *   (2) shedding activity + duration,
 *   (3) main contributing factors (patient-facing names, not internal codes),
 *   (4) follicle mechanism composed from the contributor families present,
 *   (5) treatment strategy composed from the actual approved kits.
 *
 * Data-driven from questionnaire selections + approved treatment kits — never
 * hand-templated. Contributor labels come from patient selections (Hormonal,
 * Thyroid, Scalp, Lifestyle, Metabolic, etc.) so the paragraph reflects what
 * the doctor actually saw and approved.
 */
function buildConclusion(
  report: ClinicalReport,
  drivers: PrintDriverCard[],
  primary: string,
  kits: PrintTreatmentKit[] = [],
): string {
  const selections = (report.patientSummary.questionnaireSelections ?? {}) as Record<string, unknown>;
  const duration = shortText(selections.duration ?? report.patientSummary.hairLossDuration, "the current review window", 34);

  // ── Shedding count: strip the leading "~" so we don't say "approximately ~50-100"
  //    and strip any trailing "(Noticeable)" qualifier — the paragraph carries
  //    "approximately" itself, so the raw range reads naturally.
  const activity = shortText(selections.count, "", 40);
  const cleanedCount = activity.replace(/^~\s*/, "").replace(/\s*\(.*$/, "").trim();
  const activityClause = cleanedCount && !/not (recorded|applicable)/i.test(cleanedCount)
    ? `with noticeable shedding of approximately ${cleanedCount}`
    : "with an active shedding phase";

  // ── Diagnosis phrasing: prefer "at Ludwig 2" / "at Norwood III" over hyphen.
  const primaryPhrase = primary.replace(/\s*[-–—]\s*(Ludwig|Norwood)/i, " at $1");

  // ── Contributors: pull from patient-selected clinical fields, mapped to
  //    patient-friendly labels. Cap at 5 so the sentence stays readable.
  const contributors = buildContributorList(selections, drivers).slice(0, 5);
  const contributorClause = contributors.length > 0
    ? `${capitaliseFirst(humanJoin(contributors))} may be acting together`
    : "The factors surfaced in your responses may be acting together";

  // ── Mechanism composed from the contributor families present. Cap at two
  //    clauses so it stays crisp. "weaken follicular support" is the anchor
  //    when scalp inflammation is present so the voice mirrors the approved
  //    clinical copy for that family.
  const evidence = [contributors.join(" "), drivers.map((d) => `${d.title} ${d.trigger}`).join(" ")].join(" ").toLowerCase();
  const hasScalpInflam = /scalp|inflam|dandruff|redness|acne|sebum/.test(evidence);
  const mechBits: string[] = [];
  if (/hormon|menopause|estrogen|androgen|thyroid|pcos|endometrio/.test(evidence)) mechBits.push("shorten the active growth phase");
  if (hasScalpInflam) mechBits.push("weaken follicular support");
  if (/iron|ferritin|bleed|blood|menstrual/.test(evidence)) mechBits.push("reduce the nutrient supply the follicle depends on");
  if (/metabolic|insulin|prediabet|diabet|weight|obes/.test(evidence)) mechBits.push("slow the metabolic drive that fuels the hair cycle");
  if (/stress|sleep|cortisol|anxiet|depress/.test(evidence)) mechBits.push("push more strands into the shedding phase");
  if (/oxid|smok|vaping|alcohol/.test(evidence)) mechBits.push("add oxidative stress on vulnerable follicles");
  const mechanism = mechBits.length
    ? `to ${humanJoin(mechBits.slice(0, 2))}`
    : "to destabilise the current hair cycle";

  // ── Strategy: composed from the actual approved kits so it's never generic.
  //    Include the primary diagnosis in the evidence so "pattern protection"
  //    is anchored when the diagnosis is FPHL/MPHL even if no explicit pattern
  //    kit is on the list (topicals cover it).
  const strategyEvidence = `${evidence} ${primaryPhrase.toLowerCase()}`;
  const strategy = buildStrategyList(kits, strategyEvidence);
  const strategyClause = strategy.length > 0
    ? `Your plan therefore combines ${humanJoin(strategy)}.`
    : "Your plan therefore combines internal support for the identified drivers with topical scalp care.";

  const paragraph = [
    `Your assessment indicates ${primaryPhrase}, ${activityClause} over the past ${duration}.`,
    `${contributorClause} ${mechanism}.`,
    strategyClause,
  ].join(" ");
  return normaliseWhitespace(paragraph);
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

  const cause = collectEvidenceStrings(selections.cause).map((v) => cleanText(v).toLowerCase());
  if (cause.some((v) => /stress|anxiet|depress/.test(v))) push("stress-driven shedding");
  if (cause.some((v) => /nutrition/.test(v))) push("nutritional gaps");

  const immunity = collectEvidenceStrings(selections.immunity).map((v) => cleanText(v).toLowerCase());
  if (immunity.some((v) => /areata|autoimmune/.test(v))) push("autoimmune activity");

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
  if (/rapid weight|rwl|glp/.test(kitText)) return ["Shields follicles during rapid weight loss.", "Supports nutrient recovery.", "Helps prevent GLP-1-linked shedding."];
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
  if (/\bMPHL\b|MALE PATTERN/.test(text)) return "Male Pattern Hair Loss Pro";
  if (/\bFPHL\b|FEMALE PATTERN/.test(text)) return "Female Pattern Hair Loss Pro";
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
  if (/RAPID WEIGHT|RWL/.test(text)) return "Rapid weight loss / GLP-1";
  if (/NIGHT SHIFT/.test(text)) return "Night-shift work";
  if (/FREQUENT FLY/.test(text)) return "Frequent flying";
  if (/TRICHOTILLOMANIA|TTM/.test(text)) return "Trichotillomania (hair pulling / OCD)";
  if (/POST[-\s]?HYSTERECTOMY|HYSTERECTOMY|\bHRT\b/.test(text)) return "Post-hysterectomy / HRT hormonal reset";
  return null;
}
function kitTagPattern(kitText: string): RegExp | null {
  const text = kitText.toLowerCase();
  if (/iron up/.test(text)) return /iron|ferritin|blood|bleed|menstrual|anaemi|anemi/i;
  if (/phenotype.*inflam/.test(text)) return /scalp|dandruff|itch|flake|white\s*flake|dry|normal scalp|inflam|seborr|boil|redness|irritation|oxidative|smok|vaping|alcohol|recurrent acne|acne|indigestion|constipation|bloat|sensitive|endometrio|age above 40|over 40|>\s*40/i;
  if (/meta[-\s]?b.*hypothyroid/.test(text)) return /metabolic|obes|weight|sedentary|pre.?diabet|diabet|insulin|hypothyroid|thyroid|genetic|family|polygenic|age above 40|over 40|>\s*40/i;
  if (/meta[-\s]?b.*pcos/.test(text)) return /pcos|pcod|metabolic|obes|weight|sedentary|pre.?diabet|diabet|insulin|genetic|family|polygenic|irregular period/i;
  if (/meta[-\s]?b.*post/.test(text)) return /post.?menopause|menopause|metabolic|obes|weight|sedentary|pre.?diabet|diabet|insulin|genetic|family|polygenic/i;
  if (/meta[-\s]?b/.test(text)) return /metabolic|obes|weight|sedentary|pre.?diabet|diabet|insulin|pcos|hypothyroid|hyperthyroid|thyroid|genetic|family|polygenic|age above 40|over 40|>\s*40/i;
  if (/thyroid care|hyperthyroid/.test(text)) return /hyperthyroid|thyroid/i;
  if (/pro immune/.test(text)) return /immune|autoimmune|allerg|infection|areata|regrowth|oxidative-immune|follic/i;
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

function questionnaireDriverOptions(report: ClinicalReport): string[] {
  const selections = (report.patientSummary.questionnaireSelections ?? {}) as Record<string, unknown>;
  // "immunity" lives here because responses like "Recurrent Acne / Acne prone
  // skin" belong on the Phenotype Inflammation kit (per the tag pattern) even
  // though the questionnaire files them as an immune-system prompt.
  const driverFields = ["cause", "scalp", "thyroid", "hormonal", "lifestyle", "diet", "deficiency", "gut", "immunity", "metabolic", "grade"];
  const base = driverFields
    .flatMap((field) => collectEvidenceStrings(selections[field]))
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

  const built = phases.slice(0, 6).map<PrintTreatmentKit>((phase, index) => {
    const kit = kitFromPhase(phase);
    const ranked = [...driverPool].sort((a, b) => scoreKitForDriver(kit, b) - scoreKitForDriver(kit, a));
    const driver = ranked[0] ?? driverPool[index % driverPool.length];
    const isIronKit = /iron|ferritin|blood/i.test(`${kit.code} ${kit.name}`);
    const linkedDrivers = patientLinkedTags(kit, report);
    const role = roleForKit(`${kit.code} ${kit.name} ${linkedDrivers.join(" ")}`, index);
    const interpretation = interpretationLookupForKit(`${kit.code} ${kit.name}`, report);
    return {
      id: `${kit.code}-${index}`,
      sequence: String(index + 1).padStart(2, "0"),
      role,
      priority: isIronKit ? "Supporting Contributor" : driver.priority,
      name: kit.name,
      kitCode: kit.kitCode,
      selectedBecause: shortSentence(linkedDrivers.join(", ") || driver.trigger, "This kit matches the doctor-reviewed driver pattern.", LIMITS.selectedBecause),
      mappedDriverId: driver.id,
      mappedCondition: interpretation.condition ?? kit.mappedCondition,
      mappedInterpretation: interpretation.interpretation,
      linkedDrivers,
      benefits: kit.benefits.map((benefit) => shortSentence(benefit, "Supports the treatment plan.", LIMITS.benefit)).slice(0, 3),
      asset: kit.asset,
    };
  });

  // Validation rule: a kit needs at least one real reason to appear.
  // Allowed: patient-selected trigger (linkedDrivers) OR clinician-confirmed
  // interpretation OR pattern/diagnosis-based rationale.
  const suppressed: string[] = [];
  const kitValidation: KitValidationReport[] = [];
  const seenSupport = new Set<string>();
  const withRationale = built.filter((kit) => {
    const dedupeKey = `${kit.kitCode}::${kit.name.toLowerCase()}`;
    const patternRationale = /mphl|fphl|pattern|androgen|areata/i.test(
      `${kit.kitCode} ${kit.name} ${kit.mappedCondition}`,
    );
    const record = (status: KitValidationStatus, reason?: string) => {
      kitValidation.push({ kitCode: kit.kitCode, name: kit.name, status, reason });
    };
    if (seenSupport.has(dedupeKey)) {
      record("duplicate_support", "Another kit with the same code was already selected");
      suppressed.push(`${kit.kitCode} (${kit.name})`);
      return false;
    }
    if (kit.linkedDrivers.length === 0 && !kit.mappedInterpretation && !patternRationale) {
      record("suppressed_missing_trigger", "No patient-selected trigger or clinician-confirmed interpretation");
      suppressed.push(`${kit.kitCode} (${kit.name})`);
      return false;
    }
    if (!kit.asset) {
      record("suppressed_missing_asset", "Product packshot not registered");
      suppressed.push(`${kit.kitCode} (${kit.name})`);
      return false;
    }
    seenSupport.add(dedupeKey);
    record("valid");
    return true;
  });

  // Every doctor-approved kit must render. Shaft-repair / breakage kits go to
  // Additional Supportive Care so the primary matrix stays focused on the
  // drivers of hair loss, but nothing else is dropped or demoted.
  // The primary matrix supports 1-6 kits; density is chosen downstream from
  // the row count so 5-6 kits render at compact density.
  const isShaftRepair = (kit: PrintTreatmentKit) => /\bhbr\b|breakage|shaft/i.test(`${kit.kitCode} ${kit.name}`);
  const primary = withRationale.filter((kit) => !isShaftRepair(kit)).slice(0, 6);
  const additional = withRationale.filter(isShaftRepair).slice(0, 2);

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

function chooseLayoutMode(_data: Omit<OnePageReportViewModel, "validation" | "layoutMode">): PrintDensityMode {
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
  approvedKitCount = 0,
): OnePageReportValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const allText = collectReportText(data);

  // ── Hard-fail: every doctor-approved kit must appear on the report ───────
  // approvedKitCount is the number of kits the doctor approved in the
  // treatment strategy. renderedKitCount is what actually renders (primary +
  // additional supportive care). Silent drops are a clinical-correctness
  // failure and must block PDF generation.
  const renderedKitCount = data.treatmentPlan.length + data.additionalCare.length;
  if (approvedKitCount > 0 && renderedKitCount !== approvedKitCount) {
    const suppressedDetail =
      kitValidation
        .filter((kit) => kit.status !== "valid")
        .map((kit) => `${kit.kitCode} — ${kit.reason ?? kit.status}`)
        .join("; ") || suppressedKits.join("; ");
    errors.push(
      `Approved kit count mismatch: doctor approved ${approvedKitCount}, report rendered ${renderedKitCount}. Suppressed: ${suppressedDetail || "unknown"}`,
    );
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
  // Suppressed recommendations stay out of the patient-facing plan, while the
  // structured validation output preserves the exact reason for doctor review.
  const reportedSuppressedKits = new Set<string>();
  for (const kit of kitValidation) {
    if (kit.status === "valid") continue;
    const label = `${kit.kitCode} (${kit.name})`;
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
  const keyClinicalSnapshot = buildKeyClinicalSnapshot(clinicalReport, drivers, treatmentPlan).slice(0, 6);
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
    clinicalResult: (() => {
      const primary = patientFriendlyResult(clinicalReport, drivers);
      const allKits = [...treatmentPlan, ...additionalCare];
      return {
        primary,
        supportingLine: buildSupportingLine(clinicalReport, drivers),
        conclusion: buildConclusion(clinicalReport, drivers, primary, allKits),
        reviewedBy: `Reviewed by ${approvedBy}`,
      };
    })(),
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
  return {
    ...data,
    validation: validate(
      data,
      treatmentBuild.suppressed,
      treatmentBuild.kitValidation,
      topicalBuild.validation,
      phases.length,
    ),
  };
}

export function buildOnePageReportViewModel(clinicalReport: ClinicalReport, context: OnePageReportContext): OnePageReportViewModel {
  return mapClinicalReportToPrintPresentation(clinicalReport, context);
}












