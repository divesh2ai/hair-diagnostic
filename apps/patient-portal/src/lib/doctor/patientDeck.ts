// View model for the Patient Deck card.
//
// The deck is a PRESENTATION of the same rows the Review Queue orders. It adds
// no clinical meaning: every string here is either copied from the stats
// payload or is a fixed label defined in this file. The one rule from the rest
// of the doctor surface holds — presentation may be transformed, clinical
// meaning may not.
//
// ── Why chips are derived here and not fetched ───────────────────────────────
// The concept shows tidy chips (ACTIVE SHEDDING / FPHL / HORMONAL). We do not
// have those exact tags and will not invent them or open an AI call to
// generate them. What we DO have, cheaply, per queue row is:
//
//   primaryDiagnosis  — the engine's own SEVERITY_ANALYSIS routing key
//   severity          — MILD / MODERATE / SEVERE, when established
//   concern           — the questionnaire track (hair vs skin)
//   reviewPathway     — the classifier's flag (disabled in prod → usually null)
//
// The chips below are a deterministic re-label of those keys. A doctor reading
// "Pattern hair loss · Moderate" is reading the engine's routing, shortened —
// not a fresh diagnosis authored by the dashboard.

import { labelForDiagnosis } from "@/lib/labels/diagnosisLabels";
import {
  clinicalAttention,
  demographicLabel,
  type ClinicalAttention,
} from "@/lib/doctor/reviewPriority";
import { reviewHref } from "@/lib/doctor/reviewHref";

/** The shape the deck consumes — a subset of the stats queue row. */
export interface DeckQueueRow {
  id: string;
  submittedAt: string | null;
  status: string;
  patientName: string;
  patientAge: number | null;
  patientGender: string | null;
  clinicName: string;
  primaryDiagnosis: string | null;
  severity: string | null;
  reviewPathway: string | null;
  reviewPathwayReasons: string[];
  concern: string | null;
  /** Length of the persisted RECOMMENDATIONS.rankedKits array, or null. */
  recommendedKitCount: number | null;
}

/** Soft colour families for chips — matched to the clinical category so a
 *  doctor scanning the deck reads the same colour for the same kind of finding. */
export type ChipColor =
  | "amber"
  | "violet"
  | "emerald"
  | "rose"
  | "sky"
  | "stone"
  | "red";

export interface DeckChip {
  label: string;
  /** Drives the accent. `attention` is reserved for the classifier's flags. */
  tone: "diagnosis" | "severity" | "attention";
  color: ChipColor;
}

export interface DeckCardModel {
  id: string;
  href: string;
  initials: string;
  name: string;
  /** "29F" / "34M" / "42" — null when neither age nor sex is known. */
  demographic: string | null;
  /**
   * The one truthful status for a deck card. Every row in the deck is a member
   * of the Review Queue (see REVIEW_QUEUE_STATUSES), which excludes FAILED /
   * PARTIAL_FAILURE — so a deck card is always "Ready for review". The value is
   * derived rather than hard-coded so a future queue-membership change surfaces
   * here instead of silently lying.
   */
  status: "ready";
  /**
   * One clinician-readable line: the engine's diagnosis label. Null when the
   * SEVERITY_ANALYSIS artifact has not populated a diagnosis yet — we say
   * nothing rather than render "Assessment in progress" over a patient who has
   * demonstrably finished and is waiting for review.
   */
  interpretation: string | null;
  /** At most three, most clinically informative first. May be empty. */
  chips: DeckChip[];
  submittedAt: string | null;
  clinicName: string;
  /** The classifier's flag, when it produced one. Almost always null in prod. */
  attention: ClinicalAttention | null;
  /**
   * Recommended kit count from the persisted RECOMMENDATIONS artifact, or null
   * when that artifact has not been written (or holds no kit array) — in which
   * case the card shows no count rather than a fabricated one.
   */
  recommendedKits: number | null;
}

const SEVERITY_CHIP: Record<string, string> = {
  MILD: "Mild",
  MODERATE: "Moderate",
  SEVERE: "Severe",
};

// Diagnosis → a short family chip. Deliberately coarse: the full label is the
// interpretation line; the chip is the one-word family a doctor scans for.
//
// Handles both shapes the engine emits: the enum routing keys (AGA_MALE_45,
// TE_STRESS, IRON_DEFICIENCY, …) and the prose diagnoses some records store
// ("Androgenetic Alopecia (Female)", "PCOS + Hypothyroid", "Iron-deficiency
// TE"). Substring matching covers both without enumerating every variant; it is
// a re-label of the engine's own output, never a new diagnosis.
function diagnosisFamilyChip(code: string | null): string | null {
  if (!code) return null;
  const c = code.toUpperCase();
  const has = (...needles: string[]) => needles.some((n) => c.includes(n));

  // Hormonal drivers take precedence — a "PCOS + Hypothyroid" case is hormonal
  // first even though it may also mention a pattern component.
  if (has("PCOS", "THYROID", "MENOPAUS", "HORMON", "ENDOMETRIOSIS")) {
    return "Hormonal";
  }
  if (has("AGA", "ANDROGENETIC", "PATTERN")) return "Pattern hair loss";
  if (has("TE_", "TELOGEN", "EFFLUVIUM")) return "Telogen effluvium";
  if (has("IRON")) return "Iron deficiency";
  if (has("ALOPECIA_AREATA", "AREATA", "AUTOIMMUNE")) return "Autoimmune";
  if (has("SEBORRH", "DERMATITIS", "SCALP", "INFLAM")) return "Scalp";
  if (has("TTM", "TRICHOTILLOMANIA")) return "Trichotillomania";
  if (has("HAIR_BREAKAGE", "BREAKAGE")) return "Shaft damage";
  if (has("MULTI")) return "Multifactorial";
  return null;
}

/** Colour for a clinical-family chip, matched to the category so the same kind
 *  of finding always reads in the same hue across the deck. */
function familyColor(family: string): ChipColor {
  switch (family) {
    case "Hormonal":
      return "emerald";
    case "Pattern hair loss":
      return "violet";
    case "Telogen effluvium":
      return "violet";
    case "Iron deficiency":
      return "amber";
    case "Autoimmune":
      return "rose";
    case "Scalp":
    case "Pigmentation":
    case "Anti-ageing":
      return "sky";
    default:
      return "violet";
  }
}

/** The skin tracks have their own review surface and their own short label. */
function skinLabel(concern: string | null): string | null {
  if (concern === "skin_pigmentation") return "Skin FACT · Pigmentation";
  if (concern === "skin_anti_ageing") return "Skin FACT · Anti-ageing";
  return null;
}

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((s) => s[0]?.toUpperCase())
      .slice(0, 2)
      .join("") || "•"
  );
}

export function toDeckCard(row: DeckQueueRow): DeckCardModel {
  const skin = skinLabel(row.concern);
  const isSkin = skin != null;

  // Interpretation line. For hair, the engine's diagnosis label — but only when
  // it exists, because labelForDiagnosis(null) is the string "Assessment in
  // progress", which is false for a patient sitting in the Review Queue.
  const interpretation = isSkin
    ? skin
    : row.primaryDiagnosis
      ? labelForDiagnosis(row.primaryDiagnosis)
      : null;

  const attention = clinicalAttention({
    assessmentStatus: row.status,
    reviewPathway: row.reviewPathway,
    reviewPathwayReasons: row.reviewPathwayReasons,
  });

  const chips: DeckChip[] = [];

  // 1 — clinical family. The one-word bucket a doctor scans the deck for.
  const family = isSkin
    ? row.concern === "skin_pigmentation"
      ? "Pigmentation"
      : "Anti-ageing"
    : diagnosisFamilyChip(row.primaryDiagnosis);
  if (family) {
    chips.push({ label: family, tone: "diagnosis", color: familyColor(family) });
  }

  // 2 — severity, when the engine established one.
  const sev = row.severity ? SEVERITY_CHIP[row.severity.toUpperCase()] : null;
  if (sev) chips.push({ label: sev, tone: "severity", color: "stone" });

  // 3 — the classifier's flag, if it fired. Reason text lives on the card body,
  // not the chip. In production this is almost always absent.
  if (attention) {
    chips.push({ label: attention.label, tone: "attention", color: "red" });
  }

  return {
    id: row.id,
    href: reviewHref(row),
    initials: initialsOf(row.patientName),
    name: row.patientName,
    demographic: demographicLabel(row.patientAge, row.patientGender),
    status: "ready",
    interpretation,
    chips: chips.slice(0, 3),
    submittedAt: row.submittedAt,
    clinicName: row.clinicName,
    attention,
    recommendedKits: row.recommendedKitCount,
  };
}
