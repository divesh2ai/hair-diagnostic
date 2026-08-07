// W8 — Golden regression for the canonical kit-ranking pipeline.
//
//   detectConditions  →  resolveKitInteractions  →  buildKitSequence
//                     →  filterSafetyBlocked (W7 wiring)
//                     →  budget cap  →  final rankedKits
//
// Each fixture below anchors an expected sequence produced by the CURRENT
// production pipeline (captured 2026-07-02 against `main`). If a change to
// clinical logic legitimately alters a sequence, update the expected array
// AND add a comment referencing the source rule. Never adjust silently.
//
// Also asserts:
//   • no duplicate or mutually-exclusive kit combinations in the final list
//   • safety-evaluator findings match expectations
//   • when safety blocks zero kits, no SAFETY_BLOCKED_KITS ruleTrace entry
//     appears — i.e. the safety wiring is a strict no-op for kit ranking
//     under every non-pregnancy code path

import { describe, it, expect } from "@jest/globals";
import type { PatientAnswers } from "../../src/packages/types";
import { evaluateClinicalProfile } from "../../src/packages/ai-engine/clinical-engine/evaluateClinicalProfile";
import { mapTherapyNeeds } from "../../src/packages/ai-engine/therapy-engine/mapTherapyNeeds";
import { scoreKits } from "../../src/packages/ai-engine/kit-scorer/scoreKits";
import { OPEN_CLINIC } from "../../src/sandbox/loaders/fixtureLoader";

// ─────────────────────────────────────────────────────────────────────────────
// Fixture spec

interface KitSequenceFixture {
  name: string;
  answers: PatientAnswers;
  expectedKits: string[];
  /** Safety rule ids expected in the evaluation (any severity). */
  expectedSafetyFindings: string[];
  /** Kit ids the safety evaluator is expected to block. */
  expectedBlockedKits: string[];
  /**
   * Mutually-exclusive kit pairs that must NEVER co-occur in the final list.
   * If either half is absent this is vacuously true.
   */
  mutexPairs?: [string, string][];
}

// Mutually exclusive pairs derived from resolveKitInteractions — encoded here
// as invariants so any future rule that would allow both would fail this test.
const GLOBAL_MUTEX: [string, string][] = [
  // PCOS ⟂ Post-menopause META B (age-gated in resolveKitInteractions)
  ['PRO FACT META B PCOS', 'PRO FACT META B POSTMENOPAUSE'],
  // PCOS+Hypothyroid unify to plain META B — the two variant kits must never co-exist
  ['PRO FACT META B PCOS', 'PRO FACT META B HYPOTHYROID'],
  ['PRO FACT META B HYPOTHYROID', 'PRO FACT META B'],
];

const FIXTURES: KitSequenceFixture[] = [
  {
    name: "male-aga-no-contraindications",
    answers: {
      age: 32,
      sex: "Male",
      grade: "Grade 2",
      cause: ["Genetics"],
      hairtype: ["Thinning at crown"],
    } as PatientAnswers,
    expectedKits: ["PHENOTYPE INFLAMATION", "PRO IMMUNE GOLD", "MPHL"],
    expectedSafetyFindings: ["SAFETY_DRUG_INTERACTIONS_NOT_EVALUATED"],
    expectedBlockedKits: [],
  },
  {
    name: "pcos-only",
    answers: {
      age: 28,
      sex: "Female",
      hormonal: ["PCOS"],
      grade: "Grade 2",
    } as PatientAnswers,
    expectedKits: ["PRO FACT META B PCOS", "PHENOTYPE INFLAMATION", "FPHL"],
    expectedSafetyFindings: [
      "SAFETY_INPUT_PREGNANCY_UNKNOWN_FEMALE_REPRODUCTIVE_AGE",
      "SAFETY_DRUG_INTERACTIONS_NOT_EVALUATED",
    ],
    expectedBlockedKits: [],
  },
  {
    name: "hypothyroid-only",
    answers: {
      age: 35,
      sex: "Female",
      thyroid: ["Hypothyroidism"],
    } as PatientAnswers,
    expectedKits: ["PRO FACT META B HYPOTHYROID"],
    expectedSafetyFindings: [
      "SAFETY_INPUT_PREGNANCY_UNKNOWN_FEMALE_REPRODUCTIVE_AGE",
      "SAFETY_DRUG_INTERACTIONS_NOT_EVALUATED",
    ],
    expectedBlockedKits: [],
  },
  {
    name: "pcos-plus-hypothyroid-unifies-to-plain-META-B",
    answers: {
      age: 30,
      sex: "Female",
      hormonal: ["PCOS"],
      thyroid: ["Hypothyroidism"],
    } as PatientAnswers,
    // Rule 3b (locked 2026-06-17) — the two variant kits collapse to plain META B.
    expectedKits: ["PRO FACT META B"],
    expectedSafetyFindings: [
      "SAFETY_INPUT_PREGNANCY_UNKNOWN_FEMALE_REPRODUCTIVE_AGE",
      "SAFETY_DRUG_INTERACTIONS_NOT_EVALUATED",
    ],
    expectedBlockedKits: [],
  },
  {
    name: "telogen-effluvium-acute-window",
    answers: {
      age: 32,
      sex: "Female",
      cause: ["Stress"],
      duration: "1-3 months",
      count: "50-100 hairs",
    } as PatientAnswers,
    expectedKits: ["HAIR FACT TE GOLD"],
    expectedSafetyFindings: [
      "SAFETY_INPUT_PREGNANCY_UNKNOWN_FEMALE_REPRODUCTIVE_AGE",
      "SAFETY_DRUG_INTERACTIONS_NOT_EVALUATED",
    ],
    expectedBlockedKits: [],
  },
  {
    name: "post-menopause",
    answers: {
      age: 55,
      sex: "Female",
      hormonal: ["Post-menopause"],
    } as PatientAnswers,
    expectedKits: ["PRO FACT META B POSTMENOPAUSE"],
    expectedSafetyFindings: ["SAFETY_DRUG_INTERACTIONS_NOT_EVALUATED"],
    expectedBlockedKits: [],
  },
  {
    name: "pregnancy-locks-to-single-safe-kit",
    answers: {
      age: 28,
      sex: "Female",
      hormonal: ["Currently pregnant"],
      // Add pattern signals that would normally produce FPHL — pregnancy lock
      // MUST strip them completely.
      grade: "Grade 3",
      cause: ["Genetics"],
    } as PatientAnswers,
    expectedKits: ["HEALTHY - 9"],
    expectedSafetyFindings: [
      "SAFETY_PREGNANCY_KIT_LOCK",
      "SAFETY_PREGNANCY_TOPICAL_BLOCK",
      "SAFETY_DRUG_INTERACTIONS_NOT_EVALUATED",
    ],
    // The safety evaluator blocks pregnancy-unsafe TOPICAL products, not kit
    // ids — the KIT set is already reduced to HEALTHY - 9 by
    // resolveKitInteractions PREGNANCY_LOCK, so evaluator.blockedKits stays [].
    expectedBlockedKits: [],
  },
  {
    name: "planning-pregnancy-does-not-alter-kit-ranking",
    answers: {
      age: 30,
      sex: "Female",
      planning_pregnancy: true,
      grade: "Grade 2",
    } as PatientAnswers,
    // Planning-pregnancy is a TOPICAL block only — kit ranking is unchanged
    // from the same female-Grade2 baseline.
    expectedKits: ["PHENOTYPE INFLAMATION", "FPHL"],
    expectedSafetyFindings: [
      "SAFETY_PLANNING_PREGNANCY_TOPICAL_BLOCK",
      "SAFETY_DRUG_INTERACTIONS_NOT_EVALUATED",
    ],
    expectedBlockedKits: [],
  },
  {
    name: "hypertension-does-not-alter-kit-ranking",
    answers: {
      age: 45,
      sex: "Male",
      hasHypertension: true,
      grade: "Grade 3",
      cause: ["Genetics"],
    } as PatientAnswers,
    // Hypertension blocks MINOXIDIL TOPICALS. Kit ranking is unchanged.
    expectedKits: ["PHENOTYPE INFLAMATION", "PRO IMMUNE GOLD", "MPHL"],
    expectedSafetyFindings: [
      "SAFETY_HYPERTENSION_MINOXIDIL_BLOCK",
      "SAFETY_DRUG_INTERACTIONS_NOT_EVALUATED",
    ],
    expectedBlockedKits: [],
  },
  {
    name: "male-under-18-does-not-alter-kit-ranking",
    answers: {
      age: 17,
      sex: "Male",
      grade: "Grade 2",
      cause: ["Genetics"],
    } as PatientAnswers,
    // Under-18 blocks FINASTERIDE TOPICALS. Kit ranking is unchanged.
    expectedKits: ["PHENOTYPE INFLAMATION", "MPHL"],
    expectedSafetyFindings: [
      "SAFETY_FINASTERIDE_MALE_UNDER_18",
      "SAFETY_DRUG_INTERACTIONS_NOT_EVALUATED",
    ],
    expectedBlockedKits: [],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Golden regression + per-fixture invariants

describe("Kit-sequence golden regression (W8)", () => {
  for (const fx of FIXTURES) {
    describe(fx.name, () => {
      const profile = evaluateClinicalProfile(fx.answers);
      const therapy = mapTherapyNeeds(profile);
      const rec = scoreKits(profile, therapy, fx.answers, OPEN_CLINIC);
      const actual = rec.rankedKits.map((k) => k.kitId);

      it("emits the exact expected kit sequence in the exact expected order", () => {
        expect(actual).toEqual(fx.expectedKits);
      });

      it("has no duplicate kits in the final list", () => {
        expect(new Set(actual).size).toBe(actual.length);
      });

      it("does not co-schedule any mutually-exclusive kit pair", () => {
        for (const [a, b] of [...GLOBAL_MUTEX, ...(fx.mutexPairs ?? [])]) {
          const both = actual.includes(a) && actual.includes(b);
          expect(both).toBe(false);
        }
      });

      it("produces the expected safety-evaluator findings (ruleId set)", () => {
        const seen = new Set((rec.safety?.findings ?? []).map((f) => f.ruleId));
        for (const rid of fx.expectedSafetyFindings) {
          expect(seen.has(rid)).toBe(true);
        }
      });

      it("produces exactly the expected safety-blocked kit list", () => {
        expect(rec.safety?.blockedKits ?? []).toEqual(fx.expectedBlockedKits);
      });

      it("emits a SAFETY_BLOCKED_KITS ruleTrace entry ONLY when safety actually blocked a kit", () => {
        const traceHit = rec.ruleTrace.some((r) => r.rule === "SAFETY_BLOCKED_KITS");
        expect(traceHit).toBe(fx.expectedBlockedKits.length > 0);
      });
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Non-interference — the strongest property we care about.
//
// Every fixture above has `expectedBlockedKits === []`. Any sequence change
// against the golden is therefore, by definition, NOT caused by safety —
// because the safety wiring did not remove any kit. If a golden update ever
// coincides with `expectedBlockedKits.length > 0`, that's the moment to
// classify the change explicitly (see the report table).

describe("Non-interference — safety wiring is a no-op for every eligible fixture (W8)", () => {
  for (const fx of FIXTURES) {
    it(`${fx.name}: safety.blockedKits is empty ⇒ rankedKits matches golden byte-for-byte`, () => {
      if (fx.expectedBlockedKits.length > 0) {
        return; // Not applicable to this fixture — see controlled-promotion tests.
      }
      const profile = evaluateClinicalProfile(fx.answers);
      const therapy = mapTherapyNeeds(profile);
      const rec = scoreKits(profile, therapy, fx.answers, OPEN_CLINIC);
      expect(rec.safety?.blockedKits ?? []).toEqual([]);
      // Byte-for-byte equality with the frozen golden — no extra kits, no
      // reordering, no missing kits.
      expect(rec.rankedKits.map((k) => k.kitId)).toEqual(fx.expectedKits);
    });
  }
});
