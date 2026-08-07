import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getClinicContext, handleAuthError } from "@/lib/auth";
import { resolveAssistantReleaseAccess } from "@/lib/assistant/releaseMode";
import { prisma } from "@/lib/prisma";
import { authoritiesForIntent, isPersonalPlanRequest, PrismaCatalogue, PrismaClinicalAuthority, runAssistant, type AssistantRole } from "@hairos/packages/assistant-core";

export const dynamic = "force-dynamic";
const roleFor = (role: string): AssistantRole => role === "PATIENT" ? "PATIENT" : role === "DOCTOR" ? "DOCTOR" : role === "STAFF" ? "CLINIC_STAFF" : "ADMIN";

export async function POST(request: Request) {
  try {
    const auth = await getClinicContext();
    const release = resolveAssistantReleaseAccess(auth);
    if (!release.allowed) return NextResponse.json({ error: "Assistant unavailable", reason: release.reason, mode: release.mode }, { status: release.mode === "DISABLED" ? 404 : 403 });
    if (!auth.clinicId) return NextResponse.json({ error: "A clinic context is required" }, { status: 403 });
    const body = await request.json() as { mode?: string; query?: string; threadId?: string; patientId?: string; assessmentId?: string; language?: string };
    if (!isPersonalPlanRequest(body.mode)) return NextResponse.json({ error: "This endpoint is available only in explicit PERSONAL_PLAN mode" }, { status: 400 });
    const query = body.query?.trim();
    if (!query || query.length > 4000) return NextResponse.json({ error: "Query must contain 1 to 4000 characters" }, { status: 400 });

    let patientId = body.patientId;
    let assessmentId = body.assessmentId;
    if (auth.role === "PATIENT") {
      const patient = await prisma.patient.findFirst({ where: { clinicId: auth.clinicId, supabaseUserId: auth.userId, isActive: true, deletedAt: null }, select: { id: true } });
      if (!patient) return NextResponse.json({ error: "Patient identity is not linked" }, { status: 403 });
      if (patientId && patientId !== patient.id) return NextResponse.json({ error: "Patient scope mismatch" }, { status: 403 });
      patientId = patient.id;
    } else if (patientId) {
      const scopedPatient = await prisma.patient.findFirst({ where: { id: patientId, clinicId: auth.clinicId, deletedAt: null }, select: { id: true } });
      if (!scopedPatient) return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }
    if (assessmentId) {
      const scoped = await prisma.assessment.findFirst({ where: { id: assessmentId, clinicId: auth.clinicId, ...(patientId ? { patientId } : {}) }, select: { id: true, patientId: true } });
      if (!scoped) return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
      patientId = patientId ?? scoped.patientId;
    }

    let thread = body.threadId ? await prisma.assistantThread.findFirst({ where: { id: body.threadId, clinicId: auth.clinicId, createdBy: auth.userId } }) : null;
    if (body.threadId && !thread) return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    if (thread) {
      if ((patientId && thread.patientId && patientId !== thread.patientId) || (assessmentId && thread.assessmentId && assessmentId !== thread.assessmentId)) return NextResponse.json({ error: "Thread clinical scope is immutable" }, { status: 409 });
      patientId = thread.patientId ?? patientId; assessmentId = thread.assessmentId ?? assessmentId;
    } else {
      thread = await prisma.assistantThread.create({ data: { clinicId: auth.clinicId, createdBy: auth.userId, role: auth.role, patientId, assessmentId, language: body.language ?? "en", title: query.slice(0, 80) } });
    }

    await prisma.assistantMessage.create({ data: { threadId: thread.id, role: "USER", content: query, language: body.language ?? "en", graphPath: ["authenticate", `release:${release.mode}`, "scope", "classify"], authorities: [] } });
    const response = await runAssistant({ requestId: crypto.randomUUID(), query, role: roleFor(auth.role), clinicId: auth.clinicId, userId: auth.userId, patientId, assessmentId, language: body.language, internalProvisionalMode: release.internalProvisionalMode }, new PrismaClinicalAuthority(prisma), new PrismaCatalogue(prisma, auth.clinicId));
    const authorities = authoritiesForIntent(response.intent);
    const assistantMessage = await prisma.assistantMessage.create({ data: { threadId: thread.id, role: "ASSISTANT", content: response.answer, intent: response.intent, action: response.action, language: body.language ?? "en", graphPath: ["safety_gate", "intent_route", "authority_route", "tool_or_retrieval", "citation_validator"], authorities, supportedClaims: { sources: response.sources } as Prisma.InputJsonValue } });
    for (const [index, citation] of response.sources.entries()) await prisma.assistantCitation.create({ data: { messageId: assistantMessage.id, claimIndex: index, claimText: response.answer, sourceType: citation.sourceType, sourceId: citation.sourceId, sourceField: citation.field, sourceLabel: citation.label, sourceVersion: citation.version } });
    for (const tool of response.toolCalls) await prisma.assistantToolCall.create({ data: { messageId: assistantMessage.id, toolName: tool.name, input: { query }, redactedOutput: { status: tool.status, sourceIds: tool.sourceIds }, status: tool.status } });
    if (response.safetyFlags.length) await prisma.assistantSafetyEvent.create({ data: { threadId: thread.id, messageId: assistantMessage.id, clinicId: auth.clinicId, patientId, assessmentId, flags: response.safetyFlags, action: response.action, redactedSummary: "Safety route triggered from assistant query" } });
    let escalationState: string | null = null;
    if (["ESCALATE", "URGENT_ESCALATION"].includes(response.action)) {
      const escalation = await prisma.assistantEscalation.create({ data: { threadId: thread.id, messageId: assistantMessage.id, clinicId: auth.clinicId, patientId, assessmentId, reason: response.intent, priority: response.action === "URGENT_ESCALATION" ? "URGENT" : "STANDARD", status: "OPEN", payload: { safetyFlags: response.safetyFlags } } });
      escalationState = escalation.status;
    }
    return NextResponse.json({ ...response, mode: "PERSONAL_PLAN", threadId: thread.id, messageId: assistantMessage.id, releaseMode: release.mode, trace: release.showInternalTrace ? { intent: response.intent, authorities, tools: response.toolCalls, sources: response.sources, provisional: release.internalProvisionalMode, safetyDecision: response.action, escalationState } : undefined });
  } catch (error) { return handleAuthError(error) ?? NextResponse.json({ error: "Internal server error" }, { status: 500 }); }
}