import { NextResponse, after } from 'next/server';
import {
  runAssessmentPhaseA,
  runAssessmentPhaseB,
  resumeOrchestration,
  PhaseAAlreadyRunningError,
} from "@hairos/packages/assessment-orchestrator";
import { prisma } from '@/lib/prisma';

/**
 * Trigger orchestration for a submitted assessment.
 *
 * Phase A (clinical-critical, ~3–5 s) is awaited. The HTTP response returns
 * as soon as the doctor has everything needed to begin consultation. Phase B
 * (narratives + PDF) continues in the background via `after()` so the patient
 * portal can poll for the final PDF without holding the doctor's request open.
 *
 * Failure modes:
 * - FAILED states resume the whole pipeline.
 * - Phase A failures return 500.
 * - Phase B failures are recorded as PARTIAL_FAILURE; the response has
 *   already returned, so they're invisible to the caller.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { assessmentId?: string; force?: boolean };
    const { assessmentId, force } = body;
    if (!assessmentId) {
      return NextResponse.json({ error: 'Missing assessmentId' }, { status: 400 });
    }

    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      select: { status: true },
    });
    if (!assessment) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
    }

    const isFailedState =
      assessment.status === 'FAILED' || assessment.status === 'PARTIAL_FAILURE';

    // Force-regenerate: caller explicitly wants a stored COMPLETED report to be
    // rebuilt (e.g. after a code change to buildClinicalReport). We flip the row
    // into PARTIAL_FAILURE so resumeOrchestration is willing to touch it, then
    // re-run the whole pipeline. Only valid for terminal states — never for
    // in-flight ones (which would race the live worker's lease).
    if (force && assessment.status === 'COMPLETED') {
      await prisma.assessment.update({
        where: { id: assessmentId },
        data: { status: 'PARTIAL_FAILURE', retryCount: 0 },
      });
      await resumeOrchestration(assessmentId);
      return NextResponse.json({ success: true, resumed: true, forced: true });
    }

    if (isFailedState) {
      await resumeOrchestration(assessmentId);
      return NextResponse.json({ success: true, resumed: true });
    }

    // Run Phase A inline — doctor needs this to begin consultation. The
    // atomic claim inside runAssessmentPhaseA is the single-flight guarantee;
    // a duplicate request lands here and gets a friendly 200 pointing at the
    // in-flight run instead of a second execution.
    let ctx;
    try {
      ctx = await runAssessmentPhaseA(assessmentId);
    } catch (err) {
      if (err instanceof PhaseAAlreadyRunningError) {
        return NextResponse.json({
          success: true,
          alreadyRunning: true,
          status: err.currentStatus,
          executionId: err.executionId,
        });
      }
      throw err;
    }

    // Schedule Phase B to run after the response flushes. Vercel keeps the
    // lambda alive for the duration of `after()` callbacks (subject to the
    // function timeout).
    after(async () => {
      await runAssessmentPhaseB(ctx);
    });

    return NextResponse.json({
      success: true,
      status: 'CLINICAL_READY',
      assessmentId,
    });
  } catch (error) {
    console.error('Orchestration trigger API failed:', error);
    return NextResponse.json({ error: 'Orchestration failed' }, { status: 500 });
  }
}
