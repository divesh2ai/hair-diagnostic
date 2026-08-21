// Which kits a clinic is able to dispense.
//
// ── Why this file exists ────────────────────────────────────────────────────
// This value used to live in `src/sandbox/loaders/fixtureLoader.ts`, exported
// as `OPEN_CLINIC` and described as "all kits open for regression testing" —
// and three production modules imported it: buildConsultation, the assessment
// orchestrator, and runAssessmentPipeline. Every real patient's kit
// recommendation was therefore computed against a constant whose stated
// purpose was QA, carrying `clinicId: "sandbox-qa-clinic"`.
//
// The cost was not only conceptual. That module runs
//
//     const FIXTURES_DIR = resolveFixturesDir();   // fs.existsSync(...)
//
// at import time. Importing it from the consultation composer pulled `fs`,
// `path`, the fixture adapter and the whole sandbox tree into the doctor
// review's serverless bundle, and executed filesystem probes on the clinical
// request path to obtain what is really a static list of product names.
//
// ── What the value actually means ───────────────────────────────────────────
// `ClinicConfig.availableKits` is the dispensing formulary: the kits the
// scorer is permitted to recommend. Today every clinic carries the full
// catalogue, so there is one platform-wide default rather than per-clinic
// rows. That is a real product fact, not a placeholder — when clinics start
// restricting their formulary, this is the seam that grows a loader, and
// `ClinicConfig.substitutions` is already in the type for it.
//
// The list is unchanged from the one that has been in production use; moving
// it must not alter a single recommendation.
import type { ClinicConfig, KitId } from "./types";

/**
 * Every kit the platform can dispense, in catalogue order.
 *
 * Order is not significance — `buildKitSequence` decides clinical priority.
 * Keep additions grouped with their family so the diff stays readable.
 */
export const FULL_DISPENSING_FORMULARY: readonly KitId[] = [
  "HAIR FACT TE GOLD",
  "HAIR FACT TE GOLD VEG",
  "PRO FACT META B",
  "PRO FACT META B HYPOTHYROID",
  "PRO FACT META B PCOS",
  "PRO FACT META B MENOPAUSE",
  "PRO FACT META B POSTMENOPAUSE",
  "F-PCOS -1",
  "F-PCOS VEG -1",
  "FPHL",
  "MPHL",
  "IRON UP GOLD",
  "PRO FACT GI GOLD",
  "OXIDATIVE STRESS",
  "RAPID WEIGHT LOSS SHIELD",
  "PHENOTYPE INFLAMATION",
  "PRO IMMUNE GOLD",
  "PRO IMMUNE VEG",
  "HAIR FACT HAIR BREAKAGE REPAIR(HBR)",
  "EARLY GREYING CARE GOLD",
  "EARLY GREYING CARE VEG",
  "LACTIHEALTH",
  "HAIR FACT TTM (OCD)",
  "HAIR FACT ALOPECIA AREATA",
  "HAIR FACT NIGHT SHIFT",
  "HAIR FACT FREQUENT FLYERS",
  "HAIR FACT PERI MENOPAUSE",
  "HAIR FACT PERI MENOPAUSE VEG",
  "HEALTHY - 9",
  "PRO FACT THYROID CARE",
  "FH WELL 3",
] as unknown as readonly KitId[];

/**
 * The dispensing configuration used when a clinic has no formulary of its own,
 * which today is every clinic.
 *
 * `clinicId` is a stable platform identifier rather than a real clinic id: the
 * scorer only reads `availableKits`, and putting a genuine tenant id here
 * would imply a per-clinic lookup that does not happen. It replaces
 * `"sandbox-qa-clinic"`, which said the same thing less honestly.
 */
export const DEFAULT_CLINIC_DISPENSING: ClinicConfig = {
  clinicId: "platform-default-formulary",
  availableKits: [...FULL_DISPENSING_FORMULARY] as KitId[],
};

/**
 * Resolve the dispensing configuration for a clinic.
 *
 * A function rather than a bare constant so the per-clinic formulary lands
 * here when it arrives, instead of every call site having to change again.
 */
export function dispensingConfigForClinic(_clinicId: string | null | undefined): ClinicConfig {
  return DEFAULT_CLINIC_DISPENSING;
}
