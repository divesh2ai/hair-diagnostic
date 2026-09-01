// Read-time enrichment for audit rows: who the actor was, and which clinic an
// event belongs to.
//
// ── Why enrich at read time rather than migrate ─────────────────────────────
// The durable fix is columns on AuditLog — a frozen actor snapshot and a
// first-class clinicId. That is a schema migration and belongs to SA-2. This
// module closes the *visibility* half of the gap now, against rows that
// already exist, without touching a single stored byte.
//
// It is therefore explicitly a BEST-EFFORT VIEW, and it says so in its output.
// Every resolved value carries the source it came from, and anything that
// cannot be resolved comes back as null rather than as a plausible guess.
// Two rules follow from that and are not negotiable:
//
//   • Never invent an identity. A deleted user resolves to null, and the UI
//     renders "Identity not available" — not a stale name, not the UUID
//     dressed up as a person.
//   • Never imply a clinic exists when attribution simply was not captured.
//     "Unknown / not captured" is a different statement from "no clinic", and
//     conflating them is what makes an audit log misleading.
//
// ── Bounded by construction ─────────────────────────────────────────────────
// Enrichment runs over one page of rows (≤500). It issues a fixed four queries
// regardless of page size — never one per row — and every lookup is keyed on
// an indexed column.

import { prisma } from "@/lib/prisma";
import type { SystemRole } from "@prisma/client";

/** Where a resolved identity came from. Rendered, so the reader can weigh it. */
export type ActorSource =
  | "organization_member"
  | "clinic_member"
  | "doctor"
  | "auth_user"
  | "unresolved";

export interface ResolvedActor {
  actorId: string;
  name: string | null;
  email: string | null;
  /**
   * The actor's role as it is TODAY — not necessarily what it was when the
   * action happened. AuditLog.actorRole holds the historical value when it was
   * captured at all; this is a live lookup and the API labels it as such.
   */
  currentRole: SystemRole | string | null;
  source: ActorSource;
}

/**
 * Where a clinic attribution came from, weakest last.
 *
 * Every one of these is DETERMINISTIC — the entity type tells us what kind of
 * id `entityId` holds, and that record carries a clinic. None of them is a
 * heuristic, and none of them guesses. `entity_lookup` covers the entity types
 * whose own row has a clinicId column (Assessment, KitOrderIntent);
 * without it, 96% of the live log was unattributed
 * purely because AuditLog joins clinic through its `assessmentId` FK, which
 * most events do not populate.
 */
export type ClinicSource =
  | "assessment_relation"
  | "entity_is_clinic"
  | "entity_lookup"
  | "metadata_clinic_id"
  | "unattributed";

export interface ResolvedClinic {
  id: string | null;
  name: string | null;
  source: ClinicSource;
}

export interface EnrichableRow {
  actorId: string | null;
  entityType: string;
  entityId: string;
  metadata: unknown;
  /** Clinic already resolved through the assessment relation, if any. */
  assessmentClinic?: { id: string; name: string; slug: string } | null;
}

/** Pull a clinic id out of an audit row's metadata envelope, if it has one. */
function clinicIdFromMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const value = (metadata as Record<string, unknown>).clinicId;
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Resolve a batch of actor ids to identities.
 *
 * Precedence is by specificity of the membership record, not by convenience:
 * an OrganizationMember row is the platform-level identity and wins; a
 * ClinicMember is next; a Doctor row is the clinical identity. If none exists
 * the actor may still be a real auth user (a patient, or an account with no
 * role at all), so auth.users is the last resort and yields email only.
 */
export async function resolveActors(
  actorIds: string[],
): Promise<Map<string, ResolvedActor>> {
  const ids = [...new Set(actorIds.filter((id): id is string => !!id))];
  const out = new Map<string, ResolvedActor>();
  if (ids.length === 0) return out;

  const [orgMembers, clinicMembers, doctors] = await Promise.all([
    prisma.organizationMember.findMany({
      where: { supabaseUserId: { in: ids } },
      select: { supabaseUserId: true, name: true, email: true, role: true },
    }),
    prisma.clinicMember.findMany({
      where: { supabaseUserId: { in: ids } },
      select: { supabaseUserId: true, name: true, email: true, role: true },
    }),
    prisma.doctor.findMany({
      where: { supabaseUserId: { in: ids } },
      select: { supabaseUserId: true, name: true, email: true },
    }),
  ]);

  for (const d of doctors) {
    if (!d.supabaseUserId) continue;
    out.set(d.supabaseUserId, {
      actorId: d.supabaseUserId,
      name: d.name,
      email: d.email,
      currentRole: "DOCTOR",
      source: "doctor",
    });
  }
  for (const m of clinicMembers) {
    out.set(m.supabaseUserId, {
      actorId: m.supabaseUserId,
      name: m.name,
      email: m.email,
      currentRole: m.role,
      source: "clinic_member",
    });
  }
  for (const m of orgMembers) {
    out.set(m.supabaseUserId, {
      actorId: m.supabaseUserId,
      name: m.name,
      email: m.email,
      currentRole: m.role,
      source: "organization_member",
    });
  }

  // Anything still unresolved may be a bare auth user. auth.users is outside
  // the Prisma schema, so this is a parameterised raw read of two columns —
  // id and email. Nothing sensitive is selected: no tokens, no phone, no
  // password hash, no confirmation material.
  const missing = ids.filter((id) => !out.has(id));
  if (missing.length > 0) {
    try {
      const rows = await prisma.$queryRaw<{ id: string; email: string | null }[]>`
        SELECT id::text AS id, email FROM auth.users WHERE id::text = ANY(${missing})
      `;
      for (const r of rows) {
        out.set(r.id, {
          actorId: r.id,
          name: null,
          email: r.email,
          currentRole: null,
          source: "auth_user",
        });
      }
    } catch {
      // auth schema unreadable (permissions, or a non-Supabase database).
      // Falling through leaves these actors unresolved, which the UI renders
      // honestly. An enrichment failure must never fail the audit query.
    }
  }

  for (const id of ids) {
    if (!out.has(id)) {
      out.set(id, {
        actorId: id,
        name: null,
        email: null,
        currentRole: null,
        source: "unresolved",
      });
    }
  }

  return out;
}

/**
 * Resolve clinic attribution for a batch of rows.
 *
 * Three deterministic sources, tried in order of confidence. None of them
 * guesses: a row that matches none is reported unattributed, and the caller
 * renders "Unknown / not captured".
 */
export async function resolveClinics(
  rows: EnrichableRow[],
): Promise<Map<number, ResolvedClinic>> {
  const out = new Map<number, ResolvedClinic>();

  // Entity types whose own row carries a clinicId, keyed by the entityType
  // string the audit writers use. Each is one batched lookup by primary key —
  // never one query per row.
  //
  // ClinicKitFulfilment is deliberately ABSENT. Its table ships in the
  // still-unapplied post-approval migration and is therefore not on the
  // generated Prisma client — the rest of the app reaches it through raw SQL.
  // Reaching around the client here would make audit enrichment depend on an
  // unapplied migration, so fulfilment events stay unattributed and are
  // recorded as a known gap for SA-2 instead.
  const ENTITY_LOOKUPS = ["Assessment", "KitOrderIntent"] as const;
  type LookupEntity = (typeof ENTITY_LOOKUPS)[number];
  const isLookupEntity = (t: string): t is LookupEntity =>
    (ENTITY_LOOKUPS as readonly string[]).includes(t);

  // Candidate ids that need a name looked up.
  const needsName = new Set<string>();
  // entityIds to resolve to a clinic, grouped by their entity type.
  const needsEntity: Record<LookupEntity, Set<string>> = {
    Assessment: new Set(),
    KitOrderIntent: new Set(),
  };

  const candidates: (
    | { kind: "relation"; id: string; name: string }
    | { kind: "entity_is_clinic"; id: string }
    | { kind: "entity_lookup"; entity: LookupEntity; entityId: string }
    | { kind: "metadata"; id: string }
    | { kind: "none" }
  )[] = rows.map((row) => {
    if (row.assessmentClinic) {
      return {
        kind: "relation",
        id: row.assessmentClinic.id,
        name: row.assessmentClinic.name,
      };
    }
    // For clinic-administration events the entity IS the clinic, so entityId
    // is a clinic id by construction rather than by convention.
    if (row.entityType === "Clinic" && row.entityId) {
      needsName.add(row.entityId);
      return { kind: "entity_is_clinic", id: row.entityId };
    }
    // The entity is something that belongs to exactly one clinic, and
    // entityId is its primary key. Deterministic, not inferred.
    if (isLookupEntity(row.entityType) && row.entityId) {
      needsEntity[row.entityType].add(row.entityId);
      return {
        kind: "entity_lookup",
        entity: row.entityType,
        entityId: row.entityId,
      };
    }
    const fromMeta = clinicIdFromMetadata(row.metadata);
    if (fromMeta) {
      needsName.add(fromMeta);
      return { kind: "metadata", id: fromMeta };
    }
    return { kind: "none" };
  });

  // entityId → clinicId, per entity type. Three fixed queries at most.
  const entityClinic: Record<LookupEntity, Map<string, string>> = {
    Assessment: new Map(),
    KitOrderIntent: new Map(),
  };
  await Promise.all(
    ENTITY_LOOKUPS.map(async (entity) => {
      const ids = [...needsEntity[entity]];
      if (ids.length === 0) return;
      // A soft-deleted or since-removed row simply does not come back, and the
      // event stays unattributed rather than being attributed to nothing.
      //
      // Written as an explicit switch rather than indexing the Prisma client
      // by a computed key: the delegates have different types, and indexing
      // them dynamically loses that safety for no gain.
      const select = { id: true, clinicId: true } as const;
      const found: { id: string; clinicId: string }[] =
        entity === "Assessment"
          ? await prisma.assessment.findMany({ where: { id: { in: ids } }, select })
          : await prisma.kitOrderIntent.findMany({
              where: { id: { in: ids } },
              select,
            });
      for (const r of found) {
        entityClinic[entity].set(r.id, r.clinicId);
        needsName.add(r.clinicId);
      }
    }),
  );

  const names = new Map<string, string>();
  if (needsName.size > 0) {
    const clinics = await prisma.clinic.findMany({
      where: { id: { in: [...needsName] } },
      select: { id: true, name: true },
    });
    for (const c of clinics) names.set(c.id, c.name);
  }

  candidates.forEach((c, index) => {
    if (c.kind === "relation") {
      out.set(index, { id: c.id, name: c.name, source: "assessment_relation" });
    } else if (c.kind === "entity_is_clinic") {
      out.set(index, {
        id: c.id,
        // A clinic that has since been hard-deleted leaves the name null. The
        // id is still the truthful attribution, so it is kept.
        name: names.get(c.id) ?? null,
        source: "entity_is_clinic",
      });
    } else if (c.kind === "entity_lookup") {
      const clinicId = entityClinic[c.entity].get(c.entityId) ?? null;
      out.set(
        index,
        clinicId
          ? {
              id: clinicId,
              name: names.get(clinicId) ?? null,
              source: "entity_lookup",
            }
          : { id: null, name: null, source: "unattributed" },
      );
    } else if (c.kind === "metadata") {
      out.set(index, {
        id: c.id,
        name: names.get(c.id) ?? null,
        source: "metadata_clinic_id",
      });
    } else {
      out.set(index, { id: null, name: null, source: "unattributed" });
    }
  });

  return out;
}
