import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertSuperAdmin, handleAuthError, getClinicContext } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// GET /api/admin/support/[id]
// Load a full ticket + thread. Marks adminLastSeenAt.
export async function GET(_req: Request, { params }: Params) {
  try {
    await assertSuperAdmin();
    const { id } = await params;

    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
      include: {
        doctor: { select: { id: true, name: true, email: true, clinicId: true } },
        clinic: { select: { id: true, name: true } },
        messages: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!ticket) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Mark admin as having seen this thread.
    await prisma.supportTicket.update({
      where: { id: ticket.id },
      data: { adminLastSeenAt: new Date() },
    });

    return NextResponse.json({ ticket });
  } catch (err) {
    const resp = handleAuthError(err);
    if (resp) return resp;
    console.error("[ADMIN SUPPORT GET/:id]", err);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

// PATCH /api/admin/support/[id]
// Change status or priority. Audited.
export async function PATCH(req: Request, { params }: Params) {
  try {
    await assertSuperAdmin();
    const ctx = await getClinicContext();
    const { id } = await params;

    let body: { status?: string; priority?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const VALID_STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;
    const VALID_PRIORITIES = ["NORMAL", "HIGH", "URGENT"] as const;

    if (body.status && !VALID_STATUSES.includes(body.status as (typeof VALID_STATUSES)[number])) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    if (body.priority && !VALID_PRIORITIES.includes(body.priority as (typeof VALID_PRIORITIES)[number])) {
      return NextResponse.json({ error: "Invalid priority" }, { status: 400 });
    }

    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
    });
    if (!ticket) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (body.status) {
      data.status = body.status;
      if (body.status === "RESOLVED" || body.status === "CLOSED") {
        data.resolvedAt = new Date();
      } else {
        data.resolvedAt = null;
      }
    }
    if (body.priority) data.priority = body.priority;

    const updated = await prisma.supportTicket.update({
      where: { id: ticket.id },
      data,
    });

    await writeAuditLog({
      action: "SUPPORT_TICKET_UPDATED",
      entityType: "SupportTicket",
      entityId: ticket.id,
      actorId: ctx.userId,
      actorRole: ctx.role as never,
      actorType: "admin",
      metadata: {
        subject: ticket.subject,
        previousStatus: ticket.status,
        newStatus: updated.status,
        previousPriority: ticket.priority,
        newPriority: updated.priority,
      },
    });

    return NextResponse.json({ ticket: updated });
  } catch (err) {
    const resp = handleAuthError(err);
    if (resp) return resp;
    console.error("[ADMIN SUPPORT PATCH/:id]", err);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
