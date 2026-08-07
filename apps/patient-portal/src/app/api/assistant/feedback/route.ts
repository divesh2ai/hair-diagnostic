import { NextResponse } from "next/server";
import { getClinicContext, handleAuthError } from "@/lib/auth";
import { resolveAssistantReleaseAccess } from "@/lib/assistant/releaseMode";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const auth = await getClinicContext();
    const release = resolveAssistantReleaseAccess(auth);
    if (!release.allowed) return NextResponse.json({ error: "Assistant unavailable", reason: release.reason, mode: release.mode }, { status: release.mode === "DISABLED" ? 404 : 403 });
    if (!auth.clinicId) return NextResponse.json({ error: "Clinic context required" }, { status: 403 });
    const body = await request.json() as { threadId?: string; messageId?: string; helpful?: boolean; rating?: number; category?: string; comment?: string };
    if (!body.threadId) return NextResponse.json({ error: "threadId is required" }, { status: 400 });
    const thread = await prisma.assistantThread.findFirst({ where: { id: body.threadId, clinicId: auth.clinicId, createdBy: auth.userId }, select: { id: true } });
    if (!thread) return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    const feedback = await prisma.assistantFeedback.create({ data: { threadId: thread.id, messageId: body.messageId, clinicId: auth.clinicId, userId: auth.userId, helpful: body.helpful, rating: body.rating, category: body.category, comment: body.comment?.slice(0, 2000) } });
    return NextResponse.json({ id: feedback.id }, { status: 201 });
  } catch (error) { return handleAuthError(error) ?? NextResponse.json({ error: "Internal server error" }, { status: 500 }); }
}
