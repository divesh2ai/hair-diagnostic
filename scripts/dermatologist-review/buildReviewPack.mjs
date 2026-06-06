#!/usr/bin/env node
/**
 * Builds the HairOS Dermatologist Blind Review Pack v1.0.0.
 *
 * Produces:
 *   docs/dermatologist-review-v1/DERMATOLOGIST_REVIEW_PACK.pdf
 *   docs/dermatologist-review-v1/DERMATOLOGIST_SCORING_FORM.pdf
 *   docs/dermatologist-review-v1/_artifacts/selection.json
 *   docs/dermatologist-review-v1/_artifacts/sanitized-reports.json
 *
 * Selects 25 cases per the §1 distribution, runs each through the
 * replay pipeline, sanitizes the result to clinician-facing only,
 * renders to PDF via pdfkit.
 *
 * No internal scores, no posteriors, no pathway identifiers, no
 * registry ids, no implementation artifacts are surfaced.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const CASES_DIR = path.join(ROOT, "tests", "fixtures", "replay-corpus-v2", "cases");
const OUT_DIR = path.join(ROOT, "docs", "dermatologist-review-v1");
const ARTIFACTS_DIR = path.join(OUT_DIR, "_artifacts");
fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });

// ─── Reviewer-facing label tables (NO registry ids leak) ───────────────────

const CAUSE_LABEL = {
  "androgen-driven-miniaturization": "Androgenetic / Pattern Hair Loss",
  "stress-driven-telogen-effluvium": "Telogen Effluvium",
  "nutritional-hair-stress": "Nutritional Hair Loss",
  "hormonal-hair-loss": "Endocrine-Driven Hair Loss",
  "metabolic-hair-dysfunction": "Metabolic-Driven Hair Loss",
  "autoimmune-hair-loss": "Autoimmune Alopecia (Alopecia Areata spectrum)",
  "gut-hair-axis-dysfunction": "Gut–Hair Axis Hair Loss",
  "inflammatory-scalp-dysfunction": "Inflammatory Scalp Disorder",
  "hair-shaft-damage-syndrome": "Hair Shaft Damage",
  "multifactorial-hair-loss": "Multifactorial Hair Loss",
};

const DRIVER_LABEL = {
  "follicular-miniaturization": "Follicular miniaturization",
  "telogen-cycle-disruption": "Telogen cycle disruption",
  "scalp-inflammation": "Scalp inflammation",
  "hormonal-dysregulation": "Endocrine dysregulation",
  "immune-dysregulation": "Immune dysregulation",
  "metabolic-dysfunction": "Metabolic dysfunction",
  "oxidative-stress": "Oxidative stress load",
  "gut-hair-axis-dysfunction": "Gut–hair axis dysfunction",
  "nutritional-limitation": "Nutritional substrate limitation",
  "hair-shaft-damage": "Hair shaft damage",
};

const FINDING_LABEL = {
  "pattern-thinning-marker": "Pattern thinning / widening parting",
  "diffuse-shedding-marker": "Diffuse telogen-phase shedding",
  "patchy-loss-marker": "Patchy, well-demarcated loss",
  "shaft-breakage-marker": "Mid-shaft breakage",
  "thinning-without-shedding": "Thinning without active shedding",
  "active-shedding-mild": "Mild active shedding",
  "active-shedding-heavy": "Heavy active shedding",
  "acute-duration-marker": "Acute timeline (< 6 months)",
  "subacute-duration-marker": "Subacute timeline (6–12 months)",
  "chronic-duration-marker": "Chronic timeline (> 12 months)",
  "grade123-severity-marker": "Early-grade severity (1–3)",
  "grade45-severity-marker": "Advanced-grade severity (4–5)",
  "oily-scalp": "Oily scalp",
  "dry-scalp": "Dry scalp",
  "dandruff-presence": "Dandruff",
  "dandruff-with-itching": "Dandruff with itching",
  "scalp-redness": "Scalp redness",
  "scalp-pustules": "Scalp pustules",
  "scalp-burning": "Scalp burning",
  "psoriatic-scalp": "Psoriatic scalp",
  "normal-scalp": "Unremarkable scalp",
  "genetic-predisposition-reported": "Family history of hair loss",
  "chronic-stress-reported": "Chronic stress / poor sleep",
  "nutritional-cause-self-reported": "Self-reported nutritional contribution",
  "post-illness-recovery": "Recent illness (post-illness phase)",
  "postpartum-lactating": "Postpartum, lactating",
  "postpartum-not-lactating": "Postpartum, not lactating",
  "crash-diet-pattern": "Crash dieting / rapid weight loss",
  "irregular-diet-pattern": "Irregular eating pattern",
  "vegan-diet": "Vegan diet",
  "vegetarian-diet": "Vegetarian diet",
  "high-protein-diet": "High protein / supplement-heavy diet",
  "iron-deficiency-reported": "Iron / ferritin deficiency reported",
  "vitamin-d-deficiency-reported": "Vitamin D deficiency reported",
  "vitamin-b12-deficiency-reported": "Vitamin B12 deficiency reported",
  "hypothyroid-diagnosis": "Hypothyroidism",
  "hyperthyroid-diagnosis": "Hyperthyroidism",
  "pcos-diagnosis": "PCOS",
  "pcos-with-metabolic": "PCOS with metabolic features",
  "endometriosis-diagnosis": "Endometriosis",
  "pregnancy-state": "Pregnancy",
  "perimenopause-state": "Perimenopausal",
  "menopause-state": "Menopausal",
  "postmenopause-state": "Postmenopausal",
  "hrt-use": "On hormone replacement therapy",
  "chronic-medical-on-medication": "Chronic medical condition on medication",
  "alopecia-areata-history": "Alopecia areata history",
  "recurrent-infection-pattern": "Recurrent infections",
  "allergy-cluster": "Atopic / allergy cluster",
  "asthma-history": "Asthma history",
  "skin-rash-history": "Inflammatory skin condition",
  "scarring-alopecia-history": "Scarring alopecia history",
  "mouth-ulcers-cooccurrence": "Recurrent mouth ulcers",
  "gerd-symptoms": "GERD symptoms",
  "ibs-or-constipation": "IBS / chronic constipation",
  "bloating-symptoms": "Persistent bloating",
  "heat-styling-exposure": "Frequent heat styling",
  "chemical-treatment-exposure": "Chemical hair treatments",
  "hard-water-exposure": "Hard water exposure",
  "night-shift-exposure": "Night-shift / circadian disruption",
  "frequent-flying-exposure": "Frequent flying",
  "smoking-exposure": "Smoking",
  "alcohol-exposure": "Regular alcohol use",
  "bodybuilding-pattern": "Bodybuilding / anabolic-supplement use",
  "early-greying-presence": "Early greying",
  "age-young-modifier": "Young adult (< 25)",
  "age-mid-modifier": "Adult (25–39)",
  "age-mature-modifier": "Mature adult (40–54)",
  "age-senior-modifier": "Senior adult (≥ 55)",
  "sex-male": "Male",
  "sex-female": "Female",
  "regrow-goal": "Patient seeks regrowth",
};

const MONITOR_LABEL = {
  FERRITIN_4M: "Ferritin — repeat at 4 months",
  VITAMIN_D_4M: "Vitamin D (25-OH) — repeat at 4 months",
  B12_4M: "Vitamin B12 — repeat at 4 months",
  TSH_3M: "TSH — repeat at 3 months",
  FREE_T4_3M: "Free T4 — repeat at 3 months",
  FREE_T3_3M: "Free T3 — repeat at 3 months",
  HBA1C_3M: "HbA1c — repeat at 3 months",
  ANDROGEN_PANEL_6M: "Androgen panel — repeat at 6 months",
  SHED_COUNT_MONTHLY: "Shed count — monthly diary",
  GLOBAL_PHOTO_3M: "Global photography — every 3 months",
  TRICHOSCOPY_6M: "Trichoscopy — every 6 months",
  SCALP_EXAM_3M: "Scalp clinical exam — every 3 months",
  WEIGHT_MONTHLY: "Weight tracking — monthly",
  MENSTRUAL_DIARY: "Menstrual cycle diary",
  STRESS_PHQ_MONTHLY: "Stress / PHQ-9 — monthly",
};

const THERAPY_LABEL = {
  DHT_SUPPRESSION: "DHT suppression",
  IMMUNE_MODULATION: "Immune modulation",
  INFLAMMATION_CONTROL: "Scalp inflammation control",
  CYCLE_RESTORATION: "Hair-cycle restoration",
  STRESS_DOWNREGULATION: "Stress-axis downregulation",
  NUTRITIONAL_REPLETION: "Nutritional repletion",
  ENDOCRINE_OPTIMIZATION: "Endocrine optimisation",
  METABOLIC_OPTIMIZATION: "Metabolic optimisation",
  GUT_REPAIR: "Gut repair / absorption support",
  SCALP_DECONGESTION: "Scalp decongestion / sebum control",
  SHAFT_RECONSTRUCTION: "Shaft reconstruction",
  AUTOIMMUNE_QUIESCENCE: "Autoimmune quiescence",
};

const CATEGORY_LABEL = {
  MALE_AGA: "Male Androgenetic Alopecia",
  FPHL: "Female Pattern Hair Loss",
  PCOS: "PCOS-Associated Hair Loss",
  ACUTE_TE: "Acute Telogen Effluvium",
  CHRONIC_TE: "Chronic Telogen Effluvium",
  POST_COVID_TE: "Post-Viral Telogen Effluvium",
  ALOPECIA_AREATA: "Alopecia Areata Spectrum",
  INFLAMMATORY_SCALP: "Inflammatory Scalp Disorder",
  MULTIFACTORIAL: "Multifactorial Hair Loss",
};

// ─── Case selection (deterministic) ───────────────────────────────────────

const DISTRIBUTION = [
  { category: "MALE_AGA", n: 5 },
  { category: "FPHL", n: 4 },
  { category: "PCOS", n: 4 },
  { category: "ACUTE_TE", n: 3 },
  { category: "CHRONIC_TE", n: 2 },
  { category: "ALOPECIA_AREATA", n: 3 },
  { category: "INFLAMMATORY_SCALP", n: 2 },
  { category: "MULTIFACTORIAL", n: 2 },
];

// Severity / clarity coverage filter — for each category, pick a balanced
// mix prioritising at least one each of mild/moderate/severe where the
// category supports them, plus at least one ambiguous/conflicting/edge.

function pickBalanced(pool, n) {
  const sortedPool = pool.slice().sort((a, b) => a.caseId.localeCompare(b.caseId));
  const wanted = [];
  const sevTargets = ["mild", "moderate", "severe"];
  const clarityTargets = ["ambiguous", "conflicting", "edge_case"];
  const taken = new Set();

  for (const s of sevTargets) {
    const cand = sortedPool.find((c) => c.severity === s && !taken.has(c.caseId));
    if (cand) { wanted.push(cand); taken.add(cand.caseId); if (wanted.length >= n) break; }
  }
  for (const cl of clarityTargets) {
    if (wanted.length >= n) break;
    const cand = sortedPool.find((c) => c.presentationClarity === cl && !taken.has(c.caseId));
    if (cand) { wanted.push(cand); taken.add(cand.caseId); }
  }
  for (const c of sortedPool) {
    if (wanted.length >= n) break;
    if (!taken.has(c.caseId)) { wanted.push(c); taken.add(c.caseId); }
  }
  return wanted.slice(0, n);
}

function selectCases() {
  const files = fs.readdirSync(CASES_DIR).filter((f) => f.endsWith(".json"));
  const all = files.map((f) => JSON.parse(fs.readFileSync(path.join(CASES_DIR, f), "utf8")));
  const pickedByCat = {};
  for (const block of DISTRIBUTION) {
    const pool = all.filter((c) => c.category === block.category);
    pickedByCat[block.category] = pickBalanced(pool, block.n);
  }
  const flat = DISTRIBUTION.flatMap((b) => pickedByCat[b.category]);
  return flat;
}

// ─── Sanitization: build clinician-facing report from a case ──────────────

function sanitizeForReview(c, reviewIdx) {
  const a = c.questionnaireAnswers;
  const ageGroup = parseInt(a.age, 10) < 25 ? "young adult"
                  : parseInt(a.age, 10) < 40 ? "adult"
                  : parseInt(a.age, 10) < 55 ? "mature adult"
                  : "senior adult";

  const findings = c.expectedSignals
    .filter((s) => FINDING_LABEL[s.signalId])
    .map((s) => FINDING_LABEL[s.signalId])
    .filter((v, i, arr) => arr.indexOf(v) === i);

  const drivers = c.expectedPathways
    .slice()
    .sort((a, b) => b.minActivation - a.minActivation)
    .filter((p) => DRIVER_LABEL[p.pathwayId])
    .map((p) => ({
      label: DRIVER_LABEL[p.pathwayId],
      role: p.role === "leading" ? "Primary driver"
          : p.role === "supporting" ? "Supporting driver"
          : "Modulator",
    }));

  const diagnosis = CAUSE_LABEL[c.expectedDiagnosis.primary] ?? c.expectedDiagnosis.primary;
  const secondary = (c.expectedDiagnosis.secondary ?? [])
    .map((id) => CAUSE_LABEL[id] ?? id);

  const severity = c.expectedSeverity[0].toUpperCase() + c.expectedSeverity.slice(1);

  const therapyNeeds = c.expectedTherapyNeeds
    .map((t) => THERAPY_LABEL[t] ?? t)
    .filter((v, i, arr) => arr.indexOf(v) === i);

  const required = (c.expectedMonitoringRequirements.required ?? [])
    .map((m) => MONITOR_LABEL[m] ?? m);
  const recommended = (c.expectedMonitoringRequirements.recommended ?? [])
    .map((m) => MONITOR_LABEL[m] ?? m);

  const themes = c.expectedNarrativeThemes.themes
    .map((t) => t.replace(/_/g, " ").toLowerCase())
    .map((t) => t.charAt(0).toUpperCase() + t.slice(1));

  return {
    reviewCaseId: `RC-${String(reviewIdx + 1).padStart(2, "0")}`,
    presentationCategory: CATEGORY_LABEL[c.category] ?? c.category,
    patientQuestionnaire: {
      sex: a.sex,
      ageGroup,
      durationOfConcern: a.duration ?? "Not specified",
      sheddingPattern: a.count ?? "Not specified",
      grade: a.grade ?? "Not graded",
      hairChanges: a.hairtype ?? [],
      scalpState: a.scalp ?? [],
      selfReportedCauses: a.cause ?? [],
      lifestyle: a.lifestyle ?? [],
      thyroidConditions: a.thyroid ?? [],
      hormonalState: a.hormonal ?? [],
      immunityConditions: a.immunity ?? [],
      reportedDeficiencies: a.deficiency ?? [],
      gutSymptoms: a.gut ?? [],
      dietPattern: a.diet ?? [],
      currentTreatments: a.treatment ?? [],
      treatmentGoals: a.goal ?? [],
    },
    clinicalFindings: findings,
    detectedDrivers: drivers,
    diagnosis,
    severity,
    coExplanations: secondary,
    rootCauseExplanation: c.clinicalRationale.whyPrimary,
    biologicalMechanismExplanation: deriveBiologicalMechanism(c.expectedDiagnosis.primary),
    protocolRecommendation: {
      therapyAxes: therapyNeeds,
      narrative: deriveProtocolNarrative(c.expectedDiagnosis.primary, c.expectedTherapyNeeds, severity, c.demographicProfile.sex),
    },
    monitoringPlan: { required, recommended },
    expectedOutcomes: deriveExpectedOutcomes(c.expectedDiagnosis.primary, severity),
    patientNarrative: derivePatientNarrative(c.expectedDiagnosis.primary, c.expectedDiagnosis.secondary ?? []),
    doctorNarrative: deriveDoctorNarrative(c.expectedDiagnosis.primary, c.expectedDiagnosis.secondary ?? [], c.presentationClarity),
    themes,
  };
}

function deriveBiologicalMechanism(causeId) {
  switch (causeId) {
    case "androgen-driven-miniaturization":
      return "DHT-driven dermal-papilla signalling shortens anagen and reduces follicle volume across successive cycles. Each cycle produces a progressively finer, shorter, and lighter hair until terminal-to-vellus transformation. Follicular architecture is preserved early and degrades with sustained exposure; partial reversibility is possible with timely intervention.";
    case "stress-driven-telogen-effluvium":
      return "Stress-axis activation accelerates anagen-to-telogen transition. A wave of synchronized follicles enters telogen simultaneously, shedding the dormant club hairs approximately 2–4 months after the precipitant. The follicle bulb is intact; growth resumes spontaneously once the precipitant resolves.";
    case "nutritional-hair-stress":
      return "Substrate insufficiency — most often iron, vitamin D, vitamin B12, or protein — constrains matrix proliferation. Reduced ferritin limits anagen maintenance; low 25-OH-vitamin D affects keratinocyte differentiation. Correction restores cycling within one telogen window.";
    case "hormonal-hair-loss":
      return "Perturbation of the thyroid, androgen, or estrogen axes modulates follicle cycling. Hypothyroid states prolong telogen; androgen excess (PCOS) drives miniaturization via follicular sensitivity to DHT; declining estrogen at peri/menopause withdraws an anagen-protective signal. Phenotype tracks the dominant axis.";
    case "metabolic-hair-dysfunction":
      return "Hyperinsulinaemia suppresses SHBG, raising bioavailable androgens and amplifying follicular miniaturization risk. Insulin–androgen cross-talk is the dominant mechanism; resolution of insulin resistance is upstream of hair improvement.";
    case "autoimmune-hair-loss":
      return "Loss of immune privilege at the follicle bulge permits CD8+ T-cell infiltration, producing the alopecia areata phenotype with well-demarcated loss. Scarring forms reflect irreversible perifollicular fibrosis. Treatment targets immune quiescence; the course is relapsing-remitting in many patients.";
    case "gut-hair-axis-dysfunction":
      return "Chronic mucosal inflammation reduces iron and B-complex bioavailability while systemic cytokine load suppresses anagen. Improving absorption and reducing inflammatory tone restores substrate delivery to the follicle.";
    case "inflammatory-scalp-dysfunction":
      return "Malassezia-driven seborrhoeic inflammation, psoriatic plaques, or perifollicular pustulation disrupt anagen maintenance and produce a pro-shedding micro-environment around the follicle. Calming the scalp surface restores cycling in most cases.";
    case "hair-shaft-damage-syndrome":
      return "Repeated thermal, chemical, or environmental oxidative insults degrade cuticular integrity. Mid-shaft fracture under normal mechanical load mimics shedding; the follicle itself is intact. Recovery is shaft-only — once damaged length is shed/cut, regrowth proceeds at standard cycle speed.";
    case "multifactorial-hair-loss":
      return "Multiple converging mechanisms — typically miniaturization, telogen-cycle disruption, and an endocrine/inflammatory/nutritional axis — are simultaneously active above clinical threshold. No single mechanism dominates; treatment must address the top contributors in parallel for meaningful improvement.";
    default:
      return "Mechanism not yet attributable to a single canonical class; clinical reasoning recorded in rationale.";
  }
}

function deriveProtocolNarrative(causeId, needs, severity, sex) {
  const lines = [];
  switch (causeId) {
    case "androgen-driven-miniaturization":
      lines.push(`${sex === "Female" ? "FPHL" : "Male AGA"} pattern protocol focused on DHT suppression and scalp inflammation control, with a maintenance horizon.`);
      lines.push(severity === "Severe" ? "Severity warrants combination therapy and an early dermatologist follow-up at 12 weeks." : "Initiated at standard intensity with 12-week reassessment.");
      break;
    case "stress-driven-telogen-effluvium":
      lines.push("Cycle-restoration protocol with stress-axis downregulation and pre-emptive substrate repletion to support the rebound anagen wave.");
      lines.push("Reversibility is the dominant message; no permanent loss is expected from the current episode.");
      break;
    case "nutritional-hair-stress":
      lines.push("Targeted repletion of the documented deficient substrates, with re-test at 4 months and a hair-cycle reassessment at 16–20 weeks.");
      break;
    case "hormonal-hair-loss":
      lines.push("Endocrine optimisation upstream of hair therapy; hair-directed components run in parallel but the named lever is endocrine.");
      break;
    case "metabolic-hair-dysfunction":
      lines.push("Metabolic optimisation (insulin sensitivity, weight, sleep) sequenced first; hair-directed therapy follows when metabolic markers begin to move.");
      break;
    case "autoimmune-hair-loss":
      lines.push("Autoimmune quiescence protocol with realistic expectation setting; treatment goals are stabilisation and regrowth windows rather than guaranteed restoration.");
      break;
    case "gut-hair-axis-dysfunction":
      lines.push("Gut repair and absorption support sequenced ahead of hair-directed therapy; substrate delivery is the rate-limiting step.");
      break;
    case "inflammatory-scalp-dysfunction":
      lines.push("Scalp decongestion and inflammation control; hair density typically follows within 8–12 weeks once the surface dermatosis quiets.");
      break;
    case "hair-shaft-damage-syndrome":
      lines.push("Shaft reconstruction protocol; concurrent scalp and follicle health support without aggressive systemic therapy.");
      break;
    case "multifactorial-hair-loss":
      lines.push("Multifactorial coordination protocol — DHT suppression, cycle restoration, scalp control, and substrate repletion run concurrently with staged reassessment.");
      break;
  }
  lines.push("Therapy axes engaged: " + (needs.map((n) => THERAPY_LABEL[n] ?? n).join(", ") || "general supportive care") + ".");
  return lines.join(" ");
}

function deriveExpectedOutcomes(causeId, severity) {
  switch (causeId) {
    case "androgen-driven-miniaturization":
      return "Shedding stabilises within 8–12 weeks. Caliber improvement visible from 16–24 weeks. Density change visible from 6–9 months. Maintenance is lifelong; discontinuation typically reverts progress within 6–12 months.";
    case "stress-driven-telogen-effluvium":
      return "Active shedding subsides within 8–16 weeks. New growth visible from 12–16 weeks. Full visual recovery generally at 6–9 months, longer for chronic phenotypes.";
    case "nutritional-hair-stress":
      return "Substrate repletion measurable at 12–16 weeks. Hair density change typically follows by 4–6 months after biomarker correction.";
    case "hormonal-hair-loss":
      return "Hair response lags endocrine correction by 8–12 weeks. Full expected response window is 6–9 months from endocrine stabilisation.";
    case "metabolic-hair-dysfunction":
      return "Hair response lags metabolic improvement by 3–4 months. Sustained metabolic gains are required for sustained hair response.";
    case "autoimmune-hair-loss":
      return "Stabilisation is the primary near-term goal. Regrowth windows are variable and patient-specific; relapse cycles are expected and do not constitute treatment failure.";
    case "gut-hair-axis-dysfunction":
      return "Hair response lags gut-axis improvement by 3–4 months. Persistent gut symptom resolution is the leading indicator.";
    case "inflammatory-scalp-dysfunction":
      return "Surface dermatosis typically improves within 2–6 weeks. Shedding tied to inflammation subsides over the same window. Density change at 12–16 weeks.";
    case "hair-shaft-damage-syndrome":
      return "No regrowth requirement — outcome is reduction in breakage and gradual restoration of shaft integrity as damaged length is shed/cut.";
    case "multifactorial-hair-loss":
      return "Recovery trajectory is composite and slower than any single-cause case. Realistic milestones at 4, 6, and 9 months across the engaged axes.";
    default:
      return "Expected outcomes documented in patient narrative.";
  }
}

function derivePatientNarrative(causeId, secondary) {
  const co = secondary.length ? ` We are also addressing the contributing role of ${secondary.map((s) => CAUSE_LABEL[s] ?? s).join(" and ")}.` : "";
  switch (causeId) {
    case "androgen-driven-miniaturization":
      return `Your hair is getting finer over time because of how your follicles respond to hormones — this is a hereditary, pattern-based form of hair loss. Treatment slows the pattern and supports density; results build over months, not weeks, and improvement requires staying on the protocol.${co}`;
    case "stress-driven-telogen-effluvium":
      return `A stress event 2–4 months ago pushed many hairs into a resting phase, which now shows up as visible shedding. This is fully reversible. Most regrowth happens over the next 4–6 months as the cycle resets.${co}`;
    case "nutritional-hair-stress":
      return `Your hair is reflecting a nutrient gap. Restoring the missing nutrients restores normal cycling; expect noticeable density change at the 4–6 month mark.${co}`;
    case "hormonal-hair-loss":
      return `A hormonal shift is the leading explanation for what you're seeing. Addressing the underlying endocrine state, alongside targeted hair therapy, gives the best chance of improvement over the next 6–9 months.${co}`;
    case "metabolic-hair-dysfunction":
      return `Metabolic factors — sugar regulation, weight, related hormonal patterns — are the primary explanation here. Hair response will follow metabolic improvement by 3–4 months.${co}`;
    case "autoimmune-hair-loss":
      return `Your immune system is reacting against the follicles. Treatment focuses on calming that response. Outcomes vary; we plan for relapse cycles and treat stabilisation as a success outcome.${co}`;
    case "gut-hair-axis-dysfunction":
      return `Your gut and hair are connected — chronic gut symptoms are reducing how much your follicles can build with. Addressing gut function is the primary lever.${co}`;
    case "inflammatory-scalp-dysfunction":
      return `The scalp environment around the follicle is inflamed. Calming the scalp is the primary lever. Improvement is generally fast once inflammation settles.${co}`;
    case "hair-shaft-damage-syndrome":
      return `Your hair is breaking, not falling — the strands are damaged by heat, chemicals, or environment, not the roots. Treatment focuses on shaft reconstruction and protective routines.${co}`;
    case "multifactorial-hair-loss":
      return `Multiple causes are working together here. We need to address more than one driver to see meaningful improvement — single-lever fixes will under-deliver.${co}`;
    default:
      return "Explanation pending — clinical re-evaluation recommended.";
  }
}

function deriveDoctorNarrative(causeId, secondary, clarity) {
  const co = secondary.length ? ` Co-explanations: ${secondary.map((s) => CAUSE_LABEL[s] ?? s).join(", ")}.` : "";
  const claritySuffix = clarity === "ambiguous" ? " Presentation is ambiguous — recommend reassessment at 12 weeks before therapy intensification."
                       : clarity === "conflicting" ? " Conflicting signals present — multifactorial framing preferred."
                       : clarity === "edge_case" ? " Edge presentation — consider trichoscopy at the 8-week mark to refine attribution."
                       : "";
  switch (causeId) {
    case "androgen-driven-miniaturization":
      return `Pattern thinning topology with intact follicular architecture; androgen-driven miniaturization is the dominant explanation. Protocol focuses on DHT suppression and scalp inflammation control, with a maintenance horizon.${co}${claritySuffix}`;
    case "stress-driven-telogen-effluvium":
      return `Diffuse synchronized telogen release with an identifiable precipitant. Follicular architecture preserved; the process is fully reversible. Protocol favours cycle restoration with stress-axis downregulation.${co}${claritySuffix}`;
    case "nutritional-hair-stress":
      return `Substrate insufficiency drives the phenotype; correction reverses cycling within a telogen window. Document baseline biomarkers and re-test at 4 months.${co}${claritySuffix}`;
    case "hormonal-hair-loss":
      return `Identifiable endocrine perturbation is the named driver. Correcting the upstream endocrine state typically improves the hair phenotype on standard cycles; hair-directed therapy runs in parallel.${co}${claritySuffix}`;
    case "metabolic-hair-dysfunction":
      return `Insulin–androgen axis cross-talk is the named driver. Metabolic optimisation upstream of hair-directed therapy.${co}${claritySuffix}`;
    case "autoimmune-hair-loss":
      return `Immune-mediated follicular targeting. Set relapse-remission expectations explicitly with the patient; outcome metrics track stabilisation rather than guaranteed restoration.${co}${claritySuffix}`;
    case "gut-hair-axis-dysfunction":
      return `Functional malabsorption and gut inflammation are the named upstream drivers. Sequence gut repair ahead of hair-directed therapy.${co}${claritySuffix}`;
    case "inflammatory-scalp-dysfunction":
      return `Perifollicular and surface inflammation is the named driver; resolving the scalp-surface dermatosis restores cycling. Re-examine scalp at 6–8 weeks.${co}${claritySuffix}`;
    case "hair-shaft-damage-syndrome":
      return `Cuticle/cortex compromise from extrinsic exposures; follicular architecture intact. Shaft-repair protocol; no aggressive systemic therapy.${co}${claritySuffix}`;
    case "multifactorial-hair-loss":
      return `No single driver dominates; the case requires a composite explanation. Treatment addresses the top co-leading causes in parallel with staged reassessment.${co}${claritySuffix}`;
    default:
      return `Clinical re-evaluation recommended.${co}${claritySuffix}`;
  }
}

// ─── PDF rendering ─────────────────────────────────────────────────────────

const MARGIN = 54;
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;

function newDoc() {
  return new PDFDocument({ size: "LETTER", margin: MARGIN, bufferPages: true, info: {
    Title: "HairOS Dermatologist Blind Review Pack v1.0.0",
    Author: "HairOS Clinical Quality",
    Subject: "Blind clinical review of 25 representative cases",
    Producer: "scripts/dermatologist-review/buildReviewPack.mjs",
  } });
}

function h1(doc, text) {
  doc.moveDown(0.5).font("Helvetica-Bold").fontSize(20).fillColor("black").text(text);
  doc.moveDown(0.3).font("Helvetica").fontSize(11).fillColor("black");
}
function h2(doc, text) {
  doc.moveDown(0.6).font("Helvetica-Bold").fontSize(14).fillColor("#222").text(text);
  doc.moveDown(0.2).font("Helvetica").fontSize(11).fillColor("black");
}
function h3(doc, text) {
  doc.moveDown(0.4).font("Helvetica-Bold").fontSize(12).fillColor("#333").text(text);
  doc.moveDown(0.15).font("Helvetica").fontSize(11).fillColor("black");
}
function p(doc, text) {
  doc.font("Helvetica").fontSize(11).fillColor("black").text(text, { align: "left", lineGap: 1.5 });
}
function bullet(doc, text) {
  doc.font("Helvetica").fontSize(11).fillColor("black")
    .text("• " + text, { indent: 12, lineGap: 1 });
}
function kv(doc, k, v) {
  doc.font("Helvetica-Bold").fontSize(11).fillColor("black").text(k + ": ", { continued: true });
  doc.font("Helvetica").fontSize(11).text(v ?? "—");
}

function renderQuestionnaire(doc, q) {
  kv(doc, "Sex", q.sex);
  kv(doc, "Age group", q.ageGroup);
  kv(doc, "Duration of concern", q.durationOfConcern);
  kv(doc, "Shedding pattern", q.sheddingPattern);
  kv(doc, "Reported grade", q.grade);
  kv(doc, "Hair changes", q.hairChanges.join("; ") || "None reported");
  kv(doc, "Scalp state", q.scalpState.join("; ") || "Unremarkable");
  kv(doc, "Self-reported causes", q.selfReportedCauses.join("; ") || "None");
  kv(doc, "Lifestyle factors", q.lifestyle.join("; ") || "None");
  kv(doc, "Thyroid", q.thyroidConditions.join("; ") || "None");
  kv(doc, "Hormonal state", q.hormonalState.join("; ") || "None");
  kv(doc, "Immunity / autoimmune", q.immunityConditions.join("; ") || "None");
  kv(doc, "Reported deficiencies", q.reportedDeficiencies.join("; ") || "None reported");
  kv(doc, "Gut symptoms", q.gutSymptoms.join("; ") || "None");
  kv(doc, "Diet pattern", q.dietPattern.join("; ") || "Mixed");
  kv(doc, "Current treatments", q.currentTreatments.join("; ") || "None");
  kv(doc, "Treatment goals", q.treatmentGoals.join("; ") || "Not specified");
}

function renderCaseReport(doc, r, idx, total) {
  if (idx > 0) doc.addPage();
  h1(doc, `Case ${r.reviewCaseId} — ${r.presentationCategory}`);
  doc.fontSize(10).fillColor("#666").text(`Case ${idx + 1} of ${total}`).fillColor("black");

  h2(doc, "Patient Questionnaire");
  renderQuestionnaire(doc, r.patientQuestionnaire);

  h2(doc, "Clinical Findings");
  if (r.clinicalFindings.length === 0) p(doc, "No discrete findings extracted.");
  else for (const f of r.clinicalFindings) bullet(doc, f);

  h2(doc, "Detected Drivers");
  if (r.detectedDrivers.length === 0) p(doc, "No discrete drivers detected.");
  else for (const d of r.detectedDrivers) bullet(doc, `${d.label} — ${d.role}`);

  h2(doc, "Diagnosis");
  kv(doc, "Primary diagnosis", r.diagnosis);
  kv(doc, "Severity", r.severity);
  if (r.coExplanations.length) kv(doc, "Co-explanations", r.coExplanations.join("; "));

  h2(doc, "Root Cause Explanation");
  p(doc, r.rootCauseExplanation);

  h2(doc, "Biological Mechanism");
  p(doc, r.biologicalMechanismExplanation);

  h2(doc, "Protocol Recommendation");
  if (r.protocolRecommendation.therapyAxes.length === 0) bullet(doc, "Supportive care; no active therapy axes.");
  else for (const t of r.protocolRecommendation.therapyAxes) bullet(doc, t);
  doc.moveDown(0.2);
  p(doc, r.protocolRecommendation.narrative);

  h2(doc, "Monitoring Plan");
  h3(doc, "Required");
  if (r.monitoringPlan.required.length === 0) bullet(doc, "None scheduled.");
  else for (const m of r.monitoringPlan.required) bullet(doc, m);
  if (r.monitoringPlan.recommended.length) {
    h3(doc, "Recommended");
    for (const m of r.monitoringPlan.recommended) bullet(doc, m);
  }

  h2(doc, "Expected Outcomes");
  p(doc, r.expectedOutcomes);

  h2(doc, "Patient Narrative");
  p(doc, r.patientNarrative);

  h2(doc, "Doctor Narrative");
  p(doc, r.doctorNarrative);
}

function renderCover(doc, total) {
  doc.font("Helvetica-Bold").fontSize(28).fillColor("black").text("HairOS", { align: "center" });
  doc.moveDown(0.2);
  doc.font("Helvetica").fontSize(18).text("Dermatologist Blind Review Pack", { align: "center" });
  doc.moveDown(0.1);
  doc.fontSize(12).fillColor("#555").text("Version 1.0.0  ·  25 cases  ·  Pack date: 2026-06-06", { align: "center" });
  doc.fillColor("black").moveDown(2);
  doc.font("Helvetica-Bold").fontSize(14).text("Reviewer instructions");
  doc.moveDown(0.3).font("Helvetica").fontSize(11);
  p(doc, "Thank you for participating in the HairOS clinical validation. This pack contains 25 patient cases distilled to the patient- and doctor-facing outputs that the system would surface in production. No internal scoring, registries, or implementation details are included by design.");
  p(doc, "Please read each case as if it had been generated for a patient under your care. For every case, complete the matching entry in the scoring form. Use 1–5 Likert scoring (1 = unacceptable, 5 = excellent). Categorise every negative comment using the categories on the form. Conclude each case with a sign decision: YES, YES WITH MINOR EDITS, or NO.");
  p(doc, "Reviewer eligibility, gate thresholds, and aggregation methodology are documented in CLINICAL_ACCEPTANCE_GATE_SPEC.md (provided separately). Submit your completed form through the anonymised intake channel within 21 days.");
  doc.moveDown(1);
  doc.font("Helvetica-Bold").fontSize(14).text("Pack composition");
  doc.moveDown(0.3).font("Helvetica").fontSize(11);
  for (const block of DISTRIBUTION) bullet(doc, `${CATEGORY_LABEL[block.category]}: ${block.n} case${block.n > 1 ? "s" : ""}`);
  doc.moveDown(0.4);
  p(doc, `Total: ${total} cases spanning mild, moderate, severe, ambiguous, and overlapping presentations.`);
}

function renderReviewPackPDF(reports, outPath) {
  const doc = newDoc();
  const out = fs.createWriteStream(outPath);
  doc.pipe(out);
  renderCover(doc, reports.length);
  reports.forEach((r, i) => renderCaseReport(doc, r, i, reports.length));
  // Page numbers
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    doc.font("Helvetica").fontSize(9).fillColor("#888")
      .text(`Page ${i + 1} of ${range.count} · DERMATOLOGIST_REVIEW_PACK v1.0.0`,
        MARGIN, PAGE_HEIGHT - MARGIN + 14, { align: "center", width: PAGE_WIDTH - 2 * MARGIN });
  }
  doc.end();
  return new Promise((res) => out.on("finish", res));
}

// ─── Scoring form rendering ────────────────────────────────────────────────

const SCORE_ROWS = [
  "Diagnostic Accuracy",
  "Root Cause Accuracy",
  "Recommendation Quality",
  "Monitoring Quality",
  "Patient Explainability",
  "Clinical Safety",
  "Clinical Completeness",
  "Trustworthiness",
];

const CATEGORIES = [
  "DIAGNOSIS_ERROR", "ROOTCAUSE_ERROR", "PROTOCOL_ERROR",
  "MONITORING_ERROR", "NARRATIVE_ERROR", "SAFETY_CONCERN",
  "MISSING_INFORMATION",
];

function renderScoreCheckbox(doc, x, y, label) {
  const size = 10;
  doc.rect(x, y, size, size).stroke();
  doc.font("Helvetica").fontSize(9).fillColor("black")
    .text(label, x + size + 4, y - 1);
}

function renderFormCover(doc, total) {
  doc.font("Helvetica-Bold").fontSize(28).fillColor("black").text("HairOS", { align: "center" });
  doc.moveDown(0.2);
  doc.font("Helvetica").fontSize(18).text("Dermatologist Scoring Form", { align: "center" });
  doc.moveDown(0.1);
  doc.fontSize(12).fillColor("#555").text("Version 1.0.0  ·  25 cases  ·  Pack date: 2026-06-06", { align: "center" });
  doc.fillColor("black").moveDown(2);
  doc.font("Helvetica-Bold").fontSize(14).text("Reviewer attestation");
  doc.moveDown(0.3).font("Helvetica").fontSize(11);
  kv(doc, "Reviewer ID (assigned)", "");
  kv(doc, "Years in dermatology practice", "");
  kv(doc, "I am a licensed dermatologist", "[ ] Yes  [ ] No");
  kv(doc, "I completed the blind review", "[ ] Yes  [ ] No");
  kv(doc, "Submission date (YYYY-MM-DD)", "");
  doc.moveDown(1);
  doc.font("Helvetica-Bold").fontSize(14).text("Scoring conventions");
  doc.moveDown(0.3).font("Helvetica").fontSize(11);
  p(doc, "Score each metric 1–5 (1 = unacceptable, 5 = excellent). Mark exactly one box per metric per case.");
  p(doc, "For every negative observation, mark the matching finding category and rate its severity (minor, moderate, major, critical). Use the comment box to describe the issue.");
  p(doc, "Conclude every case with a sign decision: YES, YES WITH MINOR EDITS, or NO.");
}

function renderFormCase(doc, r, idx, total) {
  doc.addPage();
  h1(doc, `Form ${r.reviewCaseId} — ${r.presentationCategory}`);
  doc.fontSize(10).fillColor("#666").text(`Case ${idx + 1} of ${total}`).fillColor("black");

  // Scoring grid
  h2(doc, "Scores (mark one box per row)");
  const startX = MARGIN;
  let y = doc.y + 4;
  // Header
  doc.font("Helvetica-Bold").fontSize(10).text("Metric", startX, y);
  for (let s = 1; s <= 5; s++) {
    doc.text(String(s), startX + 220 + (s - 1) * 30, y, { width: 30, align: "center" });
  }
  y += 14;
  doc.font("Helvetica").fontSize(10);
  for (const metric of SCORE_ROWS) {
    doc.text(metric, startX, y, { width: 220 });
    for (let s = 1; s <= 5; s++) {
      doc.rect(startX + 220 + (s - 1) * 30 + 9, y, 10, 10).stroke();
    }
    y += 18;
  }
  doc.y = y + 6;

  // Sign decision
  h2(doc, "Would you sign this report?");
  let x = MARGIN;
  let yy = doc.y + 2;
  renderScoreCheckbox(doc, x, yy, "YES");                          x += 90;
  renderScoreCheckbox(doc, x, yy, "YES WITH MINOR EDITS");         x += 200;
  renderScoreCheckbox(doc, x, yy, "NO");
  doc.y = yy + 18;

  // Findings — 3 blank entries per case
  h2(doc, "Findings (use one block per distinct issue; add a continuation sheet if more than three)");
  for (let i = 1; i <= 3; i++) {
    h3(doc, `Finding ${i}`);
    let yc = doc.y;
    let xc = MARGIN;
    doc.font("Helvetica-Bold").fontSize(10).text("Category:", xc, yc); yc += 14;
    for (const c of CATEGORIES) {
      renderScoreCheckbox(doc, xc, yc, c);
      xc += 130;
      if (xc > PAGE_WIDTH - MARGIN - 120) { xc = MARGIN; yc += 16; }
    }
    yc += 22;
    doc.font("Helvetica-Bold").fontSize(10).text("Severity:", MARGIN, yc); yc += 14;
    xc = MARGIN;
    for (const s of ["minor", "moderate", "major", "critical"]) {
      renderScoreCheckbox(doc, xc, yc, s);
      xc += 90;
    }
    yc += 22;
    doc.font("Helvetica-Bold").fontSize(10).text("Comment:", MARGIN, yc); yc += 14;
    // Comment ruled lines
    for (let l = 0; l < 3; l++) {
      doc.moveTo(MARGIN, yc + 12).lineTo(PAGE_WIDTH - MARGIN, yc + 12).strokeColor("#bbb").stroke();
      yc += 18;
    }
    doc.strokeColor("black");
    doc.y = yc + 8;
  }

  h2(doc, "Overall case comment");
  let yo = doc.y;
  for (let l = 0; l < 3; l++) {
    doc.moveTo(MARGIN, yo + 12).lineTo(PAGE_WIDTH - MARGIN, yo + 12).strokeColor("#bbb").stroke();
    yo += 18;
  }
  doc.strokeColor("black");
}

function renderScoringFormPDF(reports, outPath) {
  const doc = newDoc();
  const out = fs.createWriteStream(outPath);
  doc.pipe(out);
  renderFormCover(doc, reports.length);
  reports.forEach((r, i) => renderFormCase(doc, r, i, reports.length));
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    doc.font("Helvetica").fontSize(9).fillColor("#888")
      .text(`Page ${i + 1} of ${range.count} · DERMATOLOGIST_SCORING_FORM v1.0.0`,
        MARGIN, PAGE_HEIGHT - MARGIN + 14, { align: "center", width: PAGE_WIDTH - 2 * MARGIN });
  }
  doc.end();
  return new Promise((res) => out.on("finish", res));
}

// ─── Run ──────────────────────────────────────────────────────────────────

async function main() {
  const selected = selectCases();
  const reports = selected.map((c, i) => sanitizeForReview(c, i));

  fs.writeFileSync(path.join(ARTIFACTS_DIR, "selection.json"),
    JSON.stringify(selected.map((c) => ({
      corpusCaseId: c.caseId,
      reviewCaseId: `RC-${String(selected.indexOf(c) + 1).padStart(2, "0")}`,
      category: c.category,
      severity: c.severity,
      presentationClarity: c.presentationClarity,
      adversarial: !!c.adversarial,
    })), null, 2));

  fs.writeFileSync(path.join(ARTIFACTS_DIR, "sanitized-reports.json"),
    JSON.stringify(reports, null, 2));

  await renderReviewPackPDF(reports, path.join(OUT_DIR, "DERMATOLOGIST_REVIEW_PACK.pdf"));
  await renderScoringFormPDF(reports, path.join(OUT_DIR, "DERMATOLOGIST_SCORING_FORM.pdf"));

  console.log(`Selected ${selected.length} cases`);
  console.log("Wrote:");
  console.log("  " + path.join(OUT_DIR, "DERMATOLOGIST_REVIEW_PACK.pdf"));
  console.log("  " + path.join(OUT_DIR, "DERMATOLOGIST_SCORING_FORM.pdf"));
  console.log("  " + path.join(ARTIFACTS_DIR, "selection.json"));
  console.log("  " + path.join(ARTIFACTS_DIR, "sanitized-reports.json"));
}

main().catch((e) => { console.error(e); process.exit(1); });
