import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertSuperAdmin, handleAuthError } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/admin/support?status=OPEN&clinicId=&q=
// Super Admin inbox: all support tickets across all clinics, with unread counts.
export async function GET(req: Request) {
  try {
    await assertSuperAdmin();

    const url = new URL(req.url);
    const statusFilter = url.searchParams.get("status")?.trim() ?? "";
    const clinicFilter = url.searchParams.get("clinicId")?.trim() ?? "";
    const q = url.searchParams.get("q")?.trim().toLowerCase() ?? "";

    const tickets = await prisma.supportTicket.findMany({
      where: {
        ...(statusFilter ? { status: statusFilter as never } : {}),
        ...(clinicFilter ? { clinicId: clinicFilter } : {}),
      },
      include: {
        doctor: { select: { id: true, name: true, email: true } },
        clinic: { select: { id: true, name: true } },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { body: true, authorRole: true, createdAt: true },
        },
        _count: { select: { messages: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    let rows = tickets.map((t) => {
      // Admin unread: doctor messages after adminLastSeenAt.
      const doctorMessages = t.messages.filter((m) => m.authorRole === "DOCTOR");
      const unread = t.adminLastSeenAt
        ? doctorMessages.filter(
            (m) => new Date(m.createdAt) > new Date(t.adminLastSeenAt!),
          ).length
        : doctorMessages.length;

      const ageMs = Date.now() - new Date(t.createdAt).getTime();
      const ageHours = Math.floor(ageMs / 3_600_000);

      return {
        id: t.id,
        category: t.category,
        priority: t.priority,
        status: t.status,
        subject: t.subject,
        doctor: t.doctor,
        clinic: t.clinic,
        assessmentId: t.assessmentId,
        consultationId: t.consultationId,
        reportVersionId: t.reportVersionId,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        resolvedAt: t.resolvedAt,
        lastMessage: t.messages[0] ?? null,
        messageCount: t._count.messages,
        unreadCount: unread,
        ageHours,
      };
    });

    if (q) {
      rows = rows.filter(
        (r) =>
          r.subject.toLowerCase().includes(q) ||
          r.doctor.name.toLowerCase().includes(q) ||
          (r.doctor.email ?? "").toLowerCase().includes(q) ||
          r.clinic.name.toLowerCase().includes(q),
      );
    }

    const summary = {
      total: rows.length,
      open: rows.filter((r) => r.status === "OPEN").length,
      inProgress: rows.filter((r) => r.status === "IN_PROGRESS").length,
      resolved: rows.filter((r) => r.status === "RESOLVED").length,
      closed: rows.filter((r) => r.status === "CLOSED").length,
      totalUnread: rows.reduce((n, r) => n + r.unreadCount, 0),
    };

    return NextResponse.json({ tickets: rows, summary });
  } catch (err) {
    const resp = handleAuthError(err);
    if (resp) return resp;
    console.error("[ADMIN SUPPORT GET]", err);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
