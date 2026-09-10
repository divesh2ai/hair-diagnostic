import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertSuperAdmin, handleAuthError } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";
import { AUDIT_ACTIONS, isKnownAuditAction } from "@/lib/audit/actions";
import {
  resolveActors,
  resolveClinics,
  type EnrichableRow,
} from "@/lib/admin/auditEnrichment";

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

export interface ActionFacetEntry {
  value: string;
  /** Rows carrying this action. 0 for a canonical action never yet written. */
  count: number;
  /** In the current application taxonomy. */
  canonical: boolean;
}

/**
 * The union of what the platform writes and what the log holds.
 *
 * Canonical-but-unused actions are included with count 0 so an investigator
 * can see that an action exists and has never fired — for governance events
 * that is itself the finding. Historical-only actions are marked
 * `canonical: false` so the UI can label them as legacy rather than silently
 * mixing two taxonomies.
 */
function buildActionFacet(
  historical: { action: string; _count: number | unknown }[],
): ActionFacetEntry[] {
  const counts = new Map<string, number>();
  for (const row of historical) {
    counts.set(row.action, Number(row._count ?? 0));
  }
  const entries: ActionFacetEntry[] = AUDIT_ACTIONS.map((value) => ({
    value,
    count: counts.get(value) ?? 0,
    canonical: true,
  }));
  for (const [value, count] of counts) {
    if (!isKnownAuditAction(value)) {
      entries.push({ value, count, canonical: false });
    }
  }
  return entries;
}

// GET /api/admin/audit?search=&action=&clinicId=&from=&to=&limit=&offset=&export=csv
export async function GET(req: Request) {
  try {
    const ctx = await assertSuperAdmin();
    const url = new URL(req.url);
    const search = url.searchParams.get("search")?.trim() ?? "";
    const action = url.searchParams.get("action")?.trim() ?? "";
    const clinicId = url.searchParams.get("clinicId");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const exportCsv = url.searchParams.get("export") === "csv";
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 500);
    const offset = Math.max(Number(url.searchParams.get("offset") ?? 0), 0);

    // ── The action taxonomy is canonical PLUS history ─────────────────────
    // The canonical list in lib/audit/actions.ts describes what the platform
    // writes TODAY. It does not describe everything the log CONTAINS: four
    // rows predate it and use a dotted convention (`clinic.activated`,
    // `doctor.invited`, …). Validating against the canonical list alone made
    // those events unreachable from the console — an audit row that exists and
    // cannot be filtered to is, for an investigator, an audit row that is
    // missing.
    //
    // So the facet is the UNION of the canonical list and the distinct values
    // actually present, and an action is valid if it appears in either. The
    // distinct scan is bounded by the cardinality of `action` (24 today, and
    // taxonomies do not grow quickly); once this migration's
    // (action, createdAt) index lands, Postgres can satisfy it index-only.
    const historicalActions = await prisma.auditLog.groupBy({
      by: ["action"],
      _count: true,
      orderBy: { action: "asc" },
    });
    const historicalSet = new Set(historicalActions.map((a) => a.action));

    // Unknown = neither something we write nor something we have ever written.
    // Still distinguished from "valid filter, no matches" so the UI can say
    // which of the two it is.
    const unknownAction =
      action.length > 0 &&
      !isKnownAuditAction(action) &&
      !historicalSet.has(action);

    const where: Prisma.AuditLogWhereInput = {
      ...(action && !unknownAction ? { action } : {}),
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

    // Short-circuit an unknown action before querying: the filter can match
    // nothing by construction, so the round trip is waste.
    if (unknownAction) {
      return NextResponse.json({
        rows: [],
        total: 0,
        limit,
        offset,
        unknownAction: true,
        requestedAction: action,
        actionFacet: buildActionFacet(historicalActions),
      });
    }

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

    // Read-time enrichment. Fixed cost per page, never per row. See
    // lib/admin/auditEnrichment for why this is a view and not a migration.
    const enrichable: EnrichableRow[] = rows.map((r) => ({
      actorId: r.actorId,
      entityType: r.entityType,
      entityId: r.entityId,
      metadata: r.metadata,
      assessmentClinic: r.assessment?.clinic ?? null,
    }));
    const [actors, clinics] = await Promise.all([
      resolveActors(rows.map((r) => r.actorId).filter((id): id is string => !!id)),
      resolveClinics(enrichable),
    ]);

    if (exportCsv) {
      const truncated = total > rows.length;

      // ── FAIL CLOSED ────────────────────────────────────────────────────────
      // Exporting the audit log is a bulk cross-tenant read of the platform's
      // complete activity history — the single most sensitive read the console
      // offers, and until now the only privileged export that left no trace.
      // It is audited on the request path and AWAITED: if the audit row cannot
      // be written, the workbook is not returned. This matches the standard
      // ADMIN_ORDER_EXPORT already set for the order workbook.
      try {
        await writeAuditLog({
          action: "AUDIT_LOG_EXPORTED",
          entityType: "AuditLog",
          entityId: "export",
          actorId: ctx.userId,
          actorRole: ctx.role,
          actorType: "admin",
          metadata: {
            format: "csv",
            rowCount: rows.length,
            matchedTotal: total,
            truncated,
            exportCap: EXPORT_CAP,
            // The filter envelope, so a reviewer can reproduce exactly what
            // left the building. `search` is free text an investigator typed
            // and could contain a patient identifier, so only its presence and
            // length are recorded — never its contents.
            filters: {
              action: action || null,
              clinicId: clinicId || null,
              from: from || null,
              to: to || null,
              searchProvided: search.length > 0,
              searchLength: search.length,
            },
          },
        });
      } catch (auditErr) {
        console.error("[ADMIN AUDIT EXPORT] audit write failed", auditErr);
        return NextResponse.json(
          {
            error:
              "Export refused: the export could not be recorded in the audit log.",
          },
          { status: 500 },
        );
      }

      const header = [
        "createdAt",
        "actorId",
        "actorEmail",
        "actorName",
        "actorRoleAtEvent",
        "actorRoleCurrent",
        "actorType",
        "action",
        "entityType",
        "entityId",
        "clinicId",
        "clinicName",
        "clinicAttributionSource",
      ];
      const lines = rows.map((r, i) => {
        const actor = r.actorId ? actors.get(r.actorId) : undefined;
        const clinic = clinics.get(i);
        return csvRow([
          r.createdAt.toISOString(),
          r.actorId ?? "",
          actor?.email ?? "",
          actor?.name ?? "",
          // The role stored ON the row — historical, and often absent.
          r.actorRole ?? "",
          // The role the actor holds today. Different column on purpose: these
          // are different claims and must never be silently merged.
          String(actor?.currentRole ?? ""),
          r.actorType ?? "",
          r.action,
          r.entityType,
          r.entityId,
          clinic?.id ?? "",
          clinic?.name ?? "",
          clinic?.source ?? "unattributed",
        ]);
      });

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
      rows: rows.map((r, i) => {
        const actor = r.actorId ? actors.get(r.actorId) : undefined;
        const clinic = clinics.get(i);
        return {
          id: r.id,
          createdAt: r.createdAt.toISOString(),
          actorId: r.actorId,
          // Enrichment is additive: actorId stays exactly as stored so the
          // immutable identifier remains available for investigation.
          actor: actor
            ? {
                name: actor.name,
                email: actor.email,
                currentRole: actor.currentRole,
                source: actor.source,
              }
            : null,
          actorRole: r.actorRole,
          actorType: r.actorType,
          action: r.action,
          entityType: r.entityType,
          entityId: r.entityId,
          clinic: clinic?.id
            ? { id: clinic.id, name: clinic.name, source: clinic.source }
            : null,
          clinicAttribution: clinic?.source ?? "unattributed",
          metadata: r.metadata,
        };
      }),
      total,
      limit,
      offset,
      unknownAction: false,
      // Canonical + historical, each labelled, so the picker can never offer a
      // value that matches nothing and can never hide a value that exists.
      actionFacet: buildActionFacet(historicalActions),
    });
  } catch (err) {
    const resp = handleAuthError(err);
    if (resp) return resp;
    console.error("[ADMIN AUDIT]", err);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
