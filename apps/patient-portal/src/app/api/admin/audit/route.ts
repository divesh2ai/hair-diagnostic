import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertSuperAdmin, handleAuthError } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/admin/audit?search=&action=&clinicId=&from=&to=&limit=&offset=&export=csv
export async function GET(req: Request) {
  try {
    await assertSuperAdmin();
    const url = new URL(req.url);
    const search = url.searchParams.get("search")?.trim() ?? "";
    const action = url.searchParams.get("action")?.trim() ?? "";
    const clinicId = url.searchParams.get("clinicId");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const exportCsv = url.searchParams.get("export") === "csv";
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 500);
    const offset = Math.max(Number(url.searchParams.get("offset") ?? 0), 0);

    const where: Prisma.AuditLogWhereInput = {
      ...(action ? { action } : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { actorId: { contains: search, mode: "insensitive" } },
              { entityType: { contains: search, mode: "insensitive" } },
              { entityId: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(clinicId
        ? {
            assessment: { clinicId },
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        take: exportCsv ? 5000 : limit,
        skip: exportCsv ? 0 : offset,
        orderBy: { createdAt: "desc" },
        include: {
          assessment: {
            select: { clinic: { select: { id: true, name: true, slug: true } } },
          },
        },
      }),
      exportCsv ? Promise.resolve(0) : prisma.auditLog.count({ where }),
    ]);

    if (exportCsv) {
      const header =
        "createdAt,actorId,actorRole,actorType,action,entityType,entityId,clinicId,clinicName\n";
      const lines = rows.map((r) =>
        [
          r.createdAt.toISOString(),
          r.actorId ?? "",
          r.actorRole ?? "",
          r.actorType ?? "",
          r.action,
          r.entityType,
          r.entityId,
          r.assessment?.clinic.id ?? "",
          (r.assessment?.clinic.name ?? "").replace(/,/g, " "),
        ].join(","),
      );
      return new NextResponse(header + lines.join("\n"), {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="audit-${Date.now()}.csv"`,
        },
      });
    }

    return NextResponse.json({
      rows: rows.map((r) => ({
        id: r.id,
        createdAt: r.createdAt.toISOString(),
        actorId: r.actorId,
        actorRole: r.actorRole,
        actorType: r.actorType,
        action: r.action,
        entityType: r.entityType,
        entityId: r.entityId,
        clinic: r.assessment?.clinic ?? null,
        metadata: r.metadata,
      })),
      total,
      limit,
      offset,
    });
  } catch (err) {
    const resp = handleAuthError(err);
    if (resp) return resp;
    console.error("[ADMIN AUDIT]", err);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
