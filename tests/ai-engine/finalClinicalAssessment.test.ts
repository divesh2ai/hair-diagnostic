/**
 * Final Clinical Assessment (4-scene video narration) + Universal Recovery
 * Milestones tests.
 *
 * Locked invariants:
 *  - The Final Clinical Assessment yields a 4-scene script
 *    (scene1..scene4 + fullNarration), 90–220 words total.
 *  - Scene 3 follows the strict structure "We identified … To address
 *    this, we have recommended … This is intended to help …" — every
 *    therapy mentioned must be tied to a finding.
 *  - No forbidden product / ingredient / brand / AI vocabulary leaks in.
 *  - Each fixture produces the same universal recoveryMilestones array
 *    (deep-equal to the exported constant), and recoveryRoadmap is empty.
 */

import { describe, test, expect } from 'vitest';
import { evaluateClinicalProfile } from '../../src/packages/ai-engine/clinical-engine/evaluateClinicalProfile';
import { mapTherapyNeeds }         from '../../src/packages/ai-engine/therapy-engine/mapTherapyNeeds';
import { scoreKits }               from '../../src/packages/ai-engine/kit-scorer/scoreKits';
import {
  buildClinicalReport,
  UNIVERSAL_RECOVERY_MILESTONES,
} from '../../src/packages/ai-engine/report-engine/buildClinicalReport';
import {
  loadAllFixtures,
  budgetForFixture,
  OPEN_CLINIC,
} from '../fixtures/loader';

// Forbidden tokens that must never appear anywhere in the narration.
// Mirrors the runtime denylist in buildFinalClinicalAssessment.
const FORBIDDEN: RegExp[] = [
  /\bkits?\b/i, /\bprotocols?\b/i, /\bsupplements?\b/i,
  /\bingredients?\b/i, /\bformulations?\b/i, /\bproducts?\b/i,
  /\bpackages?\b/i, /\bbrands?\b/i,
  /\bAI\b/, /\balgorithms?\b/i, /\bscoring\b/i,
  /\bcurcumin\b/i, /\bmelatonin\b/i, /\bbiotin\b/i, /\blactoferrin\b/i,
  /\bashwagandha\b/i, /\bmoringa\b/i, /\bcolostrum\b/i, /\bquercetin\b/i,
  /\bresveratrol\b/i, /\bminoxidil\b/i, /\bfinasteride\b/i, /\bketoconazole\b/i,
  /\bhair\s*fact\b/i, /\bpro\s*immune\b/i, /\bpro\s*fact\b/i,
  /\bgi\s*gold\b/i, /\bmeta\s*b\b/i, /\bte\s*gold\b/i,
  /\bphenotype\s*inflam/i, /\bmphl\b/i, /\bfphl\b/i,
  /\bguarantee/i, /\bdiscount/i, /\boffer\b/i,
];

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

describe('Final Clinical Assessment (4-scene video narration)', () => {
  const fixtures = loadAllFixtures();

  test('at least one fixture loaded', () => {
    expect(fixtures.length).toBeGreaterThan(0);
  });

  fixtures.forEach((fixture) => {
    describe(`[${fixture.id}]`, () => {
      const profile = evaluateClinicalProfile(fixture.answers);
      const needs   = mapTherapyNeeds(profile);
      const budget  = budgetForFixture(fixture);
      const kits    = scoreKits(profile, needs, fixture.answers, OPEN_CLINIC, budget);
      const patient = {
        name: fixture.answers.name ?? 'Test Patient',
        age:  Number(fixture.answers.age) || 30,
        sex:  fixture.answers.sex,
      };
      const report = buildClinicalReport(patient, profile, needs, kits, fixture.answers);
      const fca = report.finalClinicalAssessment;

      test('all four scenes + title + fullNarration are populated', () => {
        expect(fca.videoTitle.length).toBeGreaterThan(0);
        expect(fca.scene1.length).toBeGreaterThan(20);
        expect(fca.scene2.length).toBeGreaterThan(20);
        expect(fca.scene3.length).toBeGreaterThan(20);
        expect(fca.scene4.length).toBeGreaterThan(20);
        expect(fca.fullNarration.length).toBeGreaterThan(20);
      });

      test('fullNarration is exactly the four scenes joined by blank lines', () => {
        expect(fca.fullNarration).toBe(
          [fca.scene1, fca.scene2, fca.scene3, fca.scene4].join('\n\n'),
        );
      });

      test('total word count is in the 90–220 voiceover band', () => {
        const total = wordCount(fca.fullNarration);
        expect(total).toBeGreaterThanOrEqual(90);
        expect(total).toBeLessThanOrEqual(220);
      });

      test('scene 3 uses the required problem → therapy → benefit structure', () => {
        // At least one full triplet must appear.
        expect(fca.scene3).toMatch(/We identified/i);
        expect(fca.scene3).toMatch(/we have recommended/i);
        expect(fca.scene3).toMatch(/This is intended to help/i);
      });

      test('contains no forbidden product / ingredient / brand / AI vocabulary', () => {
        for (const re of FORBIDDEN) {
          expect(fca.fullNarration).not.toMatch(re);
        }
      });

      test('uses second-person voiceover voice', () => {
        // Direct-to-patient narration — at least one explicit you/your reference.
        expect(fca.fullNarration.toLowerCase()).toMatch(/\byou(r)?\b/);
      });
    });
  });

  test('universal recovery milestones are identical for every fixture', () => {
    const baseline = JSON.stringify(UNIVERSAL_RECOVERY_MILESTONES);
    for (const fixture of fixtures) {
      const profile = evaluateClinicalProfile(fixture.answers);
      const needs   = mapTherapyNeeds(profile);
      const budget  = budgetForFixture(fixture);
      const kits    = scoreKits(profile, needs, fixture.answers, OPEN_CLINIC, budget);
      const patient = {
        name: fixture.answers.name ?? 'Test Patient',
        age:  Number(fixture.answers.age) || 30,
        sex:  fixture.answers.sex,
      };
      const report = buildClinicalReport(patient, profile, needs, kits, fixture.answers);
      expect(JSON.stringify(report.recoveryMilestones)).toBe(baseline);
      expect(report.recoveryRoadmap).toEqual([]);
    }
  });

  test('universal milestones contain exactly the four spec windows', () => {
    expect(UNIVERSAL_RECOVERY_MILESTONES.map((m) => m.window)).toEqual([
      '1–2 Months',
      '3rd Month',
      '4th Month',
      '5th Month Onwards',
    ]);
    for (const m of UNIVERSAL_RECOVERY_MILESTONES) {
      expect(m.bullets).toHaveLength(3);
    }
  });
});
