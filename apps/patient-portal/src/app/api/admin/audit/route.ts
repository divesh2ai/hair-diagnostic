import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertSuperAdmin, handleAuthError } from "@/lib/auth";

export const dynamic = "force-dynamic";

// RFC 4180 field escaping. The previous export stripped commas out of clinic
// names (`.replace(/,/g, " ")`) which silently altered the exported data and
// still broke on quotes and newlines — either of which shifted every
// subsequent column, corrupting an audit artefact that may be read as
// evidence. Quote when needed; double any embedded quote.
function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function csvRow(values: string[]): string {
  return values.map(csvField).join(",");
}

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

    // Hard ceiling on a single CSV export. The cap itself is fine; silently
    // returning the first 5000 rows of a larger result as though it were the
    // complete log was not — a truncated export that looks whole is worse
    // than no export. The total is now always counted so truncation can be
    // surfaced to the caller.
    const EXPORT_CAP = 5000;

    const [rows, total] = await prisma.$transaction([
      prisma.auditLog.findMany({
        where,
        take: exportCsv ? EXPORT_CAP : limit,
        skip: exportCsv ? 0 : offset,
        orderBy: { createdAt: "desc" },
        include: {
          assessment: {
            select: { clinic: { select: { id: true, name: true, slug: true } } },
          },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    if (exportCsv) {
      const truncated = total > rows.length;
      const header = [
        "createdAt",
        "actorId",
        "actorRole",
        "actorType",
        "action",
        "entityType",
        "entityId",
        "clinicId",
        "clinicName",
      ];
      const lines = rows.map((r) =>
        csvRow([
          r.createdAt.toISOString(),
          r.actorId ?? "",
          r.actorRole ?? "",
          r.actorType ?? "",
          r.action,
          r.entityType,
          r.entityId,
          r.assessment?.clinic.id ?? "",
          r.assessment?.clinic.name ?? "",
        ]),
      );

      // The UI triggers this as a browser download, so response headers are
      // invisible to the person receiving the file — the filename is the only
      // signal they will actually read. Say so there as well as in headers.
      const filename = truncated
        ? `audit-PARTIAL-first-${rows.length}-of-${total}-${Date.now()}.csv`
        : `audit-${total}-rows-${Date.now()}.csv`;

      return new NextResponse([csvRow(header), ...lines].join("\r\n"), {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="${filename}"`,
          "x-export-truncated": String(truncated),
          "x-export-row-count": String(rows.length),
          "x-export-total": String(total),
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
