import * as fs from 'fs';
import * as path from 'path';

import { evaluateClinicalProfile } from '../../clinical-engine/evaluateClinicalProfile';
import { mapTherapyNeeds } from '../../therapy-engine/mapTherapyNeeds';
import { scoreKits } from '../../kit-scorer/scoreKits';
import { OPEN_CLINIC } from '../../../../sandbox/loaders/fixtureLoader';
import { FIXTURES } from './fixtures';
import type { RecommendationTrace } from '..';

// ─────────────────────────────────────────────────────────────────────────────
// Trace + invariant regression suite.
//
// For each fixture, run the LIVE pipeline once with `trace: true` and assert
// only the machine-checkable invariants required for this milestone. Actual
// traces are written to scratchpad/traces/*.json for review.
// ─────────────────────────────────────────────────────────────────────────────

const TRACE_OUT_DIR = path.resolve(
  __dirname,
  '../../../../../../',
  'C:/Users/ERA/AppData/Local/Temp/claude/D--Dr-Fact-Folder-RAG-Chatbot-Dashboard/61146cfc-3f76-4030-95c2-1094bfa4eb68/scratchpad/traces',
);

// Fallback: dump alongside the test file if the scratchpad path is unavailable.
const FALLBACK_OUT_DIR = path.resolve(__dirname, '__traces__');

function outDir(): string {
  try {
    fs.mkdirSync(TRACE_OUT_DIR, { recursive: true });
    return TRACE_OUT_DIR;
  } catch {
    fs.mkdirSync(FALLBACK_OUT_DIR, { recursive: true });
    return FALLBACK_OUT_DIR;
  }
}

function runFixture(id: string, answers: Record<string, unknown>, provenance?: any) {
  const profile = evaluateClinicalProfile(answers);
  const therapy = mapTherapyNeeds(profile);
  const result = scoreKits(
    profile,
    therapy,
    answers,
    OPEN_CLINIC,
    { tier: 'STANDARD', maxKits: 5 },
    { trace: true, assessmentId: id, fixtureProvenance: provenance },
  );
  return { profile, therapy, result };
}

describe('recommendation-decision trace + invariants', () => {
  for (const fixture of FIXTURES) {
    describe(`fixture: ${fixture.id}`, () => {
      const { result } = runFixture(fixture.id, fixture.answers, fixture.provenance);
      const trace = result.trace as RecommendationTrace | undefined;
      const decisions = result.decisions ?? [];

      it('produces a trace with correct provenance', () => {
        expect(trace).toBeDefined();
        expect(trace!.provenance.pipelineVersion).toBe('current-live');
        expect(trace!.provenance.traceMode).toBe(true);
        expect(trace!.provenance.derivedFromSingleExecution).toBe(true);
        expect(trace!.provenance.orderingDependencies.length).toBeGreaterThan(0);
      });

      it('every kit in finalSequence has status=recommended and safety.allowed=true', () => {
        for (const kitId of trace!.finalSequence) {
          const d = decisions.find((x) => x.kitId === kitId);
          expect(d).toBeDefined();
          expect(d!.status).toBe('recommended');
          expect(d!.safety.allowed).toBe(true);
          expect(d!.conditionsMatched.length).toBeGreaterThan(0);
          expect(d!.reasonCodes.length).toBeGreaterThan(0);
          expect(d!.ordering.finalRank).not.toBeNull();
        }
      });

      it('every safety-blocked kit is excluded with null finalRank and blocking codes', () => {
        for (const kitId of trace!.safetyBlocks.map((b) => b.kitId)) {
          const d = decisions.find((x) => x.kitId === kitId);
          if (!d) continue; // adapter emits only kits in the evaluated universe
          expect(d.status).toBe('excluded');
          expect(d.safety.allowed).toBe(false);
          expect(d.ordering.finalRank).toBeNull();
          expect(d.safety.blockingCodes.length).toBeGreaterThan(0);
          expect(trace!.finalSequence).not.toContain(kitId);
        }
      });

      it('writes the trace to disk for review', () => {
        const dir = outDir();
        const filePath = path.join(dir, `${fixture.id}.trace.json`);
        fs.writeFileSync(filePath, JSON.stringify(trace, null, 2), 'utf8');
        expect(fs.existsSync(filePath)).toBe(true);
      });
    });
  }

  // ── Non-trace path invariant — traces must not leak into default calls ───
  it('scoreKits without options.trace does not attach decisions or trace fields', () => {
    const fixture = FIXTURES[0];
    const profile = evaluateClinicalProfile(fixture.answers);
    const therapy = mapTherapyNeeds(profile);
    const result = scoreKits(profile, therapy, fixture.answers, OPEN_CLINIC, {
      tier: 'STANDARD',
      maxKits: 5,
    });
    expect(result.decisions).toBeUndefined();
    expect(result.trace).toBeUndefined();
    expect(result.diagnostics).toBeUndefined();
  });
});
