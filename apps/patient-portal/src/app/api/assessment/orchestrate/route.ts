import { NextResponse } from 'next/server';
import { orchestrateAssessment, resumeOrchestration } from "@hairos/packages/assessment-orchestrator";
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const { assessmentId } = await req.json();

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

    const isFailedState = assessment.status === 'FAILED' || assessment.status === 'PARTIAL_FAILURE';

    if (isFailedState) {
      await resumeOrchestration(assessmentId);
    } else {
      await orchestrateAssessment(assessmentId);
    }

    return NextResponse.json({ success: true, resumed: isFailedState });
  } catch (error) {
    console.error('Orchestration trigger API failed:', error);
    return NextResponse.json({ error: 'Orchestration failed' }, { status: 500 });
  }
}
