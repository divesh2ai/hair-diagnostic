import { NextResponse } from "next/server";
import { getClinicContext, handleAuthError } from "@/lib/auth";
import { resolveAssistantReleaseAccess } from "@/lib/assistant/releaseMode";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, { params }: { params: Promise<{ threadId: string }> }) {
  try {
    const auth = await getClinicContext();
    const release = resolveAssistantReleaseAccess(auth);
    if (!release.allowed) return NextResponse.json({ error: "Assistant unavailable", reason: release.reason, mode: release.mode }, { status: release.mode === "DISABLED" ? 404 : 403 }); const { threadId } = await params;
    if (!auth.clinicId) return NextResponse.json({ error: "Clinic context required" }, { status: 403 });
    const thread = await prisma.assistantThread.findFirst({ where: { id: threadId, clinicId: auth.clinicId, createdBy: auth.userId } });
    if (!thread) return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    const messages = await prisma.assistantMessage.findMany({ where: { threadId }, orderBy: { createdAt: "asc" } });
    return NextResponse.json({ thread, messages });
  } catch (error) { return handleAuthError(error) ?? NextResponse.json({ error: "Internal server error" }, { status: 500 }); }
}
