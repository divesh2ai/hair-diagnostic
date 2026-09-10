import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDoctorContext } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";
import {
  loadPatientOrderSummaryAll,
  summaryFilterSchema,
  type SummaryScope,
} from "@/lib/doctor/orderSummary/query";
import { buildSummaryCsv, csvFilename } from "@/lib/doctor/orderSummary/csv";
import {
  buildSummaryWorkbook,
  summaryExportFilename,
  describeSummaryRange,
} from "@/lib/doctor/orderSummary/workbook";

// GET /api/doctor/orders/summary/export?format=csv|xlsx
//
// Exports the SAME filtered, clinic-scoped row set the table shows — not the
// current page. Scope is derived from the authenticated Doctor row, exactly as
// the JSON route does, so the download cannot reach another clinic's data.
// exceljs is imported only through this server handler.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function GET(req: Request) {
  const auth = await requireDoctorContext();
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const format = (url.searchParams.get("format") ?? "csv").toLowerCase();
  if (format !== "csv" && format !== "xlsx") {
    return NextResponse.json(
      { error: "bad_format", message: "format must be csv or xlsx" },
      { status: 400 },
    );
  }

  const raw = Object.fromEntries(
    ["from", "to", "doctorId", "status", "search", "sort", "dir"]
      .map((k) => [k, url.searchParams.get(k) ?? undefined])
      .filter(([, v]) => v !== undefined && v !== ""),
  );
  const parsed = summaryFilterSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  if (parsed.data.from && parsed.data.to && parsed.data.from > parsed.data.to) {
    return NextResponse.json(
      { error: "invalid_range", message: "The From date is after the To date." },
      { status: 400 },
    );
  }

  const scope: SummaryScope = { kind: "clinic", clinicId: auth.doctor.clinicId };

  try {
    const result = await loadPatientOrderSummaryAll(prisma, scope, parsed.data);
    if ("overflow" in result) {
      return NextResponse.json(
        {
          error: "too_many_rows",
          message: `This export matches ${result.count.toLocaleString()} orders, above the limit of ${result.limit.toLocaleString()}. Narrow the date range and try again.`,
          count: result.count,
          limit: result.limit,
        },
        { status: 422 },
      );
    }

    const { rows, metrics, generatedAt } = result;

    // Audit the export (fail closed): the row is awaited before the file is
    // returned. Metadata is the filter envelope + counts only — no patient
    // names, kit lineups or amounts.
    const auditBase = {
      action: "DOCTOR_ORDER_SUMMARY_EXPORT" as const,
      entityType: "KitOrderIntentSummaryExport",
      actorId: auth.authUserId,
      actorRole: auth.authRole,
      actorType: auth.authRole === "DOCTOR" ? ("doctor" as const) : ("admin" as const),
      metadata: {
        clinicId: auth.doctor.clinicId,
        format,
        range: describeSummaryRange(parsed.data),
        filters: parsed.data,
        rowCount: rows.length,
        patientOrders: metrics.patientOrders,
      },
    };

    if (format === "csv") {
      const filename = csvFilename(generatedAt);
      const csv = buildSummaryCsv(rows);
      await writeAuditLog({ ...auditBase, entityId: filename });
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="${filename}"`,
          "cache-control": "no-store",
          "x-export-row-count": String(rows.length),
        },
      });
    }

    const filename = summaryExportFilename(generatedAt);
    const buffer = await buildSummaryWorkbook(rows, {
      // Prefer the human clinic name (present on every row) over the opaque id.
      clinicLabel: rows[0]?.clinicName ?? auth.doctor.clinicId,
      actorName: auth.doctor.name,
      actorRole: auth.authRole,
      generatedAt,
      filters: parsed.data,
      metrics,
    });
    await writeAuditLog({ ...auditBase, entityId: filename });
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "content-type": XLSX_MIME,
        "content-disposition": `attachment; filename="${filename}"`,
        "content-length": String(buffer.byteLength),
        "cache-control": "no-store",
        "x-export-row-count": String(rows.length),
      },
    });
  } catch (err) {
    console.error("[DOCTOR ORDER SUMMARY EXPORT]", err);
    return NextResponse.json(
      { error: "internal", message: "We couldn't generate this export. Please try again." },
      { status: 500 },
    );
  }
}
