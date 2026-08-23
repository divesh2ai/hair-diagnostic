import { NextResponse } from "next/server";
import { assertSuperAdmin, handleAuthError } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";
import {
  loadOrderSnapshot,
  orderFilterSchema,
  MAX_EXPORT_ROWS,
} from "@/lib/admin/orders/snapshot";
import {
  buildOrdersWorkbook,
  exportFilename,
  describeFilters,
  WORKBOOK_SCHEMA_VERSION,
} from "@/lib/admin/orders/workbook";

// GET /api/admin/orders/export — platform-wide kit order intent workbook.
//
// Super Admin only. This is the widest cross-tenant read in the console: one
// request returns every clinic's order intents, so it is guarded like a
// mutation, audited like a mutation, and fails closed when it cannot be
// audited.
//
// exceljs is imported only through this server route handler, so it never
// reaches a client bundle.

export const dynamic = "force-dynamic";
// Workbook assembly is CPU-bound and must not run on the edge runtime.
export const runtime = "nodejs";

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function GET(req: Request) {
  const startedAt = Date.now();
  try {
    // assertSuperAdmin passes ONLY SystemRole.SUPER_ADMIN. ORG_ADMIN,
    // CLINIC_ADMIN, STAFF and DOCTOR are all rejected here.
    const ctx = await assertSuperAdmin();

    const url = new URL(req.url);
    const raw = Object.fromEntries(
      [
        "from",
        "to",
        "state",
        "city",
        "clinicId",
        "status",
        "doctorId",
      ]
        .map((k) => [k, url.searchParams.get(k) ?? undefined])
        .filter(([, v]) => v !== undefined && v !== ""),
    );

    const parsed = orderFilterSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const snapshot = await loadOrderSnapshot(parsed.data);

    // Never truncate a privileged export. An oversized result is refused with
    // an actionable message rather than silently cut to the first N rows,
    // which would hand the administrator a partial workbook that looks whole.
    if ("overflow" in snapshot) {
      return NextResponse.json(
        {
          error: "too_many_rows",
          message: `This export matches ${snapshot.count.toLocaleString()} intents, above the limit of ${snapshot.limit.toLocaleString()}. Narrow the date range, state or clinic and try again.`,
          count: snapshot.count,
          limit: snapshot.limit,
        },
        { status: 422 },
      );
    }

    const filename = exportFilename(snapshot.generatedAt);
    const buffer = await buildOrdersWorkbook(snapshot, {
      actorId: ctx.userId,
      actorRole: ctx.role,
      // A human-readable environment label. Deliberately not an env var
      // VALUE — no secret, connection string or key reaches the workbook.
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
      rowCount: snapshot.rows.length,
    });

    // ── Fail closed ────────────────────────────────────────────────────────
    // Awaited and deliberately NOT wrapped in its own try/catch: if the audit
    // row cannot be written, the throw propagates to the handler catch and
    // the caller receives a 500 WITHOUT the workbook. A successful privileged
    // cross-tenant export that is absent from the audit trail is not an
    // acceptable outcome, so the export is sacrificed instead.
    //
    // Metadata is the filter envelope only: no patient reference, no clinic
    // contents, no kit lineup, no doctor name, no exported rows.
    await writeAuditLog({
      action: "ADMIN_ORDER_EXPORT",
      entityType: "KitOrderIntentExport",
      entityId: filename,
      actorId: ctx.userId,
      actorRole: ctx.role,
      actorType: "admin",
      metadata: {
        filters: parsed.data,
        filterSummary: describeFilters(parsed.data),
        rowCount: snapshot.rows.length,
        clinicsRepresented: snapshot.clinics.length,
        statesRepresented: snapshot.states.length,
        filename,
        schemaVersion: WORKBOOK_SCHEMA_VERSION,
        rowLimit: MAX_EXPORT_ROWS,
        durationMs: Date.now() - startedAt,
      },
    });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "content-type": XLSX_MIME,
        "content-disposition": `attachment; filename="${filename}"`,
        "content-length": String(buffer.byteLength),
        "cache-control": "no-store",
        "x-export-row-count": String(snapshot.rows.length),
        "x-export-schema": WORKBOOK_SCHEMA_VERSION,
      },
    });
  } catch (err) {
    const resp = handleAuthError(err);
    if (resp) return resp;
    console.error("[ADMIN ORDER EXPORT]", err);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
