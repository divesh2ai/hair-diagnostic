import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertSuperAdmin, handleAuthError } from "@/lib/auth";
import { resolveActors } from "@/lib/admin/auditEnrichment";

export const dynamic = "force-dynamic";

// GET /api/admin/clinical-governance?action=&entityType=&q=&from=&to=&limit=&offset=&id=
//
// Every decision taken about patient-visible clinical content.
//
// ── Why this endpoint exists ────────────────────────────────────────────────
// Knowledge review writes its history to `KnowledgeReviewAction`, a table the
// Super Admin audit console has never read. So approving a claim, rejecting
// it, publishing it to patients or rolling a document version back — the most
// clinically consequential actions on the platform — left a trail nobody could
// find from the console.
//
// ── Reads the existing source of truth, unchanged ───────────────────────────
// No migration, no backfill, no copy. `KnowledgeReviewAction` remains the
// system of record and keeps being written exactly as it is today; this is a
// read surface over it. Unifying the two logs into one durable event stream is
// SA-2 work, and doing it properly needs the AuditLog schema change first.
//
// Worth noting for that phase: this table is RICHER than AuditLog. It records
// previousValue, newValue and a free-text reason, none of which AuditLog can
// express. The unification should lift AuditLog up to this shape, not flatten
// this one down.

/** Page size ceiling. Before/after payloads are whole records, so keep it small. */
const MAX_LIMIT = 100;

/**
 * Which top-level fields differ between the before and after snapshots.
 *
 * The list view returns this instead of the full payloads: it answers "what
 * changed" in one line without shipping two complete clinical records per row.
 * The full values are available from the single-row detail fetch.
 */
function changedKeys(before: unknown, after: unknown): string[] {
  if (!before || !after || typeof before !== "object" || typeof after !== "object") {
    return [];
  }
  const a = before as Record<string, unknown>;
  const b = after as Record<string, unknown>;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const changed: string[] = [];
  for (const key of keys) {
    // updatedAt moves on every write and says nothing about intent.
    if (key === "updatedAt") continue;
    if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) changed.push(key);
  }
  return changed.sort();
}

export async function GET(req: Request) {
  try {
    await assertSuperAdmin();

    const url = new URL(req.url);
    const id = url.searchParams.get("id")?.trim() ?? "";
    const action = url.searchParams.get("action")?.trim() ?? "";
    const entityType = url.searchParams.get("entityType")?.trim() ?? "";
    const q = url.searchParams.get("q")?.trim() ?? "";
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const limit = Math.min(
      Math.max(Number(url.searchParams.get("limit") ?? 50), 1),
      MAX_LIMIT,
    );
    const offset = Math.max(Number(url.searchParams.get("offset") ?? 0), 0);

    // Detail fetch: one row, with the complete before/after payloads.
    if (id) {
      const row = await prisma.knowledgeReviewAction.findUnique({
        where: { id },
      });
      if (!row) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      const actors = await resolveActors([row.actorId]);
      const actor = actors.get(row.actorId) ?? null;
      return NextResponse.json({
        row: {
          id: row.id,
          createdAt: row.createdAt.toISOString(),
          action: row.action,
          entityType: row.entityType,
          entityId: row.entityId,
          reason: row.reason,
          actorId: row.actorId,
          actor: actor
            ? {
                name: actor.name,
                email: actor.email,
                currentRole: actor.currentRole,
                source: actor.source,
              }
            : null,
          previousValue: row.previousValue,
          newValue: row.newValue,
          changedKeys: changedKeys(row.previousValue, row.newValue),
        },
      });
    }

    const where: Prisma.KnowledgeReviewActionWhereInput = {
      ...(action ? { action } : {}),
      ...(entityType ? { entityType } : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
      ...(q
        ? {
            OR: [
              { entityId: { contains: q, mode: "insensitive" } },
              { reason: { contains: q, mode: "insensitive" } },
              { actorId: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [rows, total, actionFacets, entityFacets] = await prisma.$transaction([
      prisma.knowledgeReviewAction.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: "desc" },
      }),
      prisma.knowledgeReviewAction.count({ where }),
      // Facets are derived from the data rather than hardcoded, so the filter
      // controls can only ever offer values that actually exist. This is the
      // same reason the audit action filter now uses a known-values list: a
      // filter that can be set to something impossible returns a confident
      // empty result that reads as evidence of absence.
      prisma.knowledgeReviewAction.groupBy({
        by: ["action"],
        _count: true,
        orderBy: { action: "asc" },
      }),
      prisma.knowledgeReviewAction.groupBy({
        by: ["entityType"],
        _count: true,
        orderBy: { entityType: "asc" },
      }),
    ]);

    const actors = await resolveActors(rows.map((r) => r.actorId));

    return NextResponse.json({
      rows: rows.map((r) => {
        const actor = actors.get(r.actorId) ?? null;
        return {
          id: r.id,
          createdAt: r.createdAt.toISOString(),
          action: r.action,
          entityType: r.entityType,
          entityId: r.entityId,
          reason: r.reason,
          actorId: r.actorId,
          actor: actor
            ? {
                name: actor.name,
                email: actor.email,
                currentRole: actor.currentRole,
                source: actor.source,
              }
            : null,
          hasBefore: r.previousValue !== null,
          hasAfter: r.newValue !== null,
          changedKeys: changedKeys(r.previousValue, r.newValue),
        };
      }),
      total,
      limit,
      offset,
      facets: {
        // `_count: true` yields a plain count, but Prisma's generated type for
        // groupBy widens it; coerce rather than cast so a missing value is 0
        // instead of NaN in the sort.
        actions: actionFacets
          .map((f) => ({ value: f.action, count: Number(f._count ?? 0) }))
          .sort((a, b) => b.count - a.count),
        entityTypes: entityFacets
          .map((f) => ({ value: f.entityType, count: Number(f._count ?? 0) }))
          .sort((a, b) => b.count - a.count),
      },
    });
  } catch (err) {
    const resp = handleAuthError(err);
    if (resp) return resp;
    console.error("[ADMIN CLINICAL GOVERNANCE]", err);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
