/**
 * POST /api/sandbox/run
 *
 * Executes the complete clinical pipeline against a fixture and returns:
 *   - Full QA scorecard (branching, normalization, signal consistency, regression)
 *   - Clinical profile (primary/secondary diagnoses, scalp states, root causes, severity)
 *   - Therapy needs
 *   - Kit recommendations with rule trace
 *   - Narrative (doctor + patient summaries)
 *   - Per-stage orchestration timing
 *
 * All execution is done through EXISTING modules — no mocking, no rebuilds.
 */

import { NextResponse } from 'next/server';
import { loadFixtureById } from '@/lib/server/loadFixtures';

// ── Existing clinical pipeline modules ──────────────────────────────────────
import { evaluateClinicalProfile } from '@hairos/packages/ai-engine/clinical-engine/evaluateClinicalProfile';
import { mapTherapyNeeds }         from '@hairos/packages/ai-engine/therapy-engine/mapTherapyNeeds';
import { scoreKits }               from '@hairos/packages/ai-engine/kit-scorer/scoreKits';
import { buildNarrative }          from '@hairos/packages/ai-engine/explanations/builders/buildNarrative';
import { OPEN_CLINIC }             from '@hairos/sandbox/loaders/fixtureLoader';
import { runQASession }            from '@hairos/sandbox/runQASession';
import type { PatientAnswers }     from '@hairos/packages/types';
import type { BudgetProfile }      from '@hairos/packages/ai-engine/kit-scorer/types';

// ─────────────────────────────────────────────────────────────────────────────

// Sandbox exposes the full clinical pipeline against fixtures with no
// clinic/patient auth. It must never be reachable in production.
const SANDBOX_DISABLED = process.env.NODE_ENV === "production";

export async function POST(req: Request) {
  if (SANDBOX_DISABLED) {
    return new NextResponse(null, { status: 404 });
  }
  try {
    const { fixtureId } = (await req.json()) as { fixtureId?: string };
    if (!fixtureId) {
      return NextResponse.json({ error: 'fixtureId is required' }, { status: 400 });
    }

    const stageTimings: Record<string, number> = {};
    const t = () => Date.now();
    const lap = (stage: string, start: number) => { stageTimings[stage] = Date.now() - start; };

    // ── 1. Load fixture ──────────────────────────────────────────────────────
    const s1 = t();
    const fixture = loadFixtureById(fixtureId);
    const answers = fixture.answers as unknown as PatientAnswers;
    lap('fixture_load', s1);

    const budgetTierMap: Record<string, BudgetProfile> = {
      ESSENTIAL:     { tier: 'ESSENTIAL',     maxKits: 2 },
      STANDARD:      { tier: 'STANDARD',      maxKits: 5 },
      COMPREHENSIVE: { tier: 'COMPREHENSIVE', maxKits: 7 },
    };
    const budget = budgetTierMap[fixture.metadata.budget] ?? budgetTierMap.STANDARD;

    // ── 2. Clinical engine ───────────────────────────────────────────────────
    const s2 = t();
    const clinical = evaluateClinicalProfile(answers);
    lap('clinical', s2);

    // ── 3. Therapy engine ────────────────────────────────────────────────────
    const s3 = t();
    const therapy = mapTherapyNeeds(clinical);
    lap('therapy', s3);

    // ── 4. Recommendation engine ─────────────────────────────────────────────
    const s4 = t();
    const recommendations = scoreKits(clinical, therapy, answers, OPEN_CLINIC, budget);
    lap('recommendations', s4);

    // ── 5. Narrative engine (explanation layer) ──────────────────────────────
    const s5 = t();
    const narrative = buildNarrative({
      clinicalProfile:   clinical,
      therapyNeeds:      therapy,
      kitRecommendation: recommendations,
      narrativeLength:   'detailed',
    });
    lap('narrative', s5);

    // ── 6. QA scorecard + regression (non-fatal if it fails) ─────────────────
    const s6 = t();
    let qaReport: Awaited<ReturnType<typeof runQASession>> | null = null;
    try {
      qaReport = await runQASession(fixtureId);
    } catch (err) {
      console.warn(`[sandbox/run] QA session failed (non-fatal):`, err);
    }
    lap('qa_session', s6);

    // ── Validation: expected vs actual ────────────────────────────────────────
    const actualDiagnoses: string[] = [clinical.primaryDiagnosis as string, ...clinical.secondaryDiagnoses.map((d) => d.key as string)];
    const actualKits       = recommendations.rankedKits.map((k) => k.kitId);
    const expectedDiag     = fixture.expected.diagnoses;
    const expectedInclude  = fixture.expected.mustIncludeKits;
    const expectedExclude  = fixture.expected.mustExcludeKits;

    const missingKits = expectedInclude.filter((k) => !actualKits.includes(k));
    const presentExcluded = expectedExclude.filter((k) => actualKits.includes(k));
    const diagnosisMatch = expectedDiag.length > 0
      ? expectedDiag.some((d) => actualDiagnoses.includes(d))
      : true;

    return NextResponse.json({
      fixtureId,

      // ── Fixture metadata ────────────────────────────────────────────────────
      fixture: {
        metadata: fixture.metadata,
        expected: fixture.expected,
      },

      // ── Full pipeline output ────────────────────────────────────────────────
      pipeline: {
        clinical: {
          primaryDiagnosis:    clinical.primaryDiagnosis,
          primaryScore:        clinical.primaryScore,
          secondaryDiagnoses:  clinical.secondaryDiagnoses,
          allScores:           clinical.allScores,
          scalpStates:         clinical.scalpStates,
          rootCauses:          clinical.rootCauses,
          severity:            clinical.severity,
          flags:               clinical.flags,
        },
        therapy: {
          needs:       [...therapy.needs],
          needReasons: therapy.needReasons,
        },
        recommendations: {
          rankedKits: recommendations.rankedKits.map((k) => ({
            kitId:        k.kitId,
            score:        k.score,
            phase:        k.phase,
            matchedNeeds: k.matchedNeeds,
            reasons:      k.reasons,
          })),
          protocolLabel:          recommendations.protocolLabel,
          protocolRationale:      recommendations.protocolRationale,
          selectionJustification: recommendations.selectionJustification,
          appliedRules:           recommendations.appliedRules,
          ruleTrace:              recommendations.ruleTrace,
        },
        narrative: {
          doctorSummary:  narrative.doctorSummary,
          patientSummary: narrative.patientSummary,
          fullNarrative:  narrative.narrative,
          length:         narrative.length,
        },
      },

      // ── Validation summary ───────────────────────────────────────────────────
      validation: {
        diagnosisMatch,
        missingKits,
        presentExcluded,
        passed: diagnosisMatch && missingKits.length === 0 && presentExcluded.length === 0,
      },

      // ── Per-stage timing (ms) ────────────────────────────────────────────────
      stageTiming: stageTimings,

      // ── QA scorecard (from runQASession) ─────────────────────────────────────
      scorecards:  qaReport?.scorecards ?? [],
      session:     qaReport?.session    ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[sandbox/run] Fatal:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
