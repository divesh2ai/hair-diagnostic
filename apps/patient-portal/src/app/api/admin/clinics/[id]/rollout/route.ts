// POST   /api/admin/clinics/[id]/rollout   — record a milestone sign-off
// DELETE /api/admin/clinics/[id]/rollout   — clear a milestone sign-off
//
// Manual rollout attestations for the Super Admin console. These write ONLY to
// ClinicMilestoneSignoff and AuditLog — never to a clinical record — so the
// dashboard rule "do not mutate clinical records from the dashboard" holds.
// Every write is audited (with before/after state) and carries the clinicId so
// it appears in the clinic's own audit feed.
//
// Capability-gated: where the ClinicMilestoneSignoff migration has not been
// applied the table does not exist, and a write returns 409 "not provisioned"
// rather than a 500 — the read side already degrades to NOT_CONNECTED.

import { NextResponse } from "next/server";
import { Prisma, ClinicMilestone, MilestoneOutcome } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertSuperAdmin, handleAuthError } from "@/lib/auth";
import {
  MILESTONE_KEYS,
  MILESTONE_OUTCOMES,
} from "@/lib/admin/opsDashboard/rollout";

export const dynamic = "force-dynamic";

const postSchema = z.object({
  milestone: z.enum(MILESTONE_KEYS),
  outcome: z.enum(MILESTONE_OUTCOMES),
  evidence: z.string().trim().max(2000).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  // Branch scope for per-branch milestones (e.g. BRANCH_QR). Omit for a
  // clinic-level sign-off.
  locationId: z.string().min(1).max(64).optional().nullable(),
});

const deleteSchema = z.object({
  milestone: z.enum(MILESTONE_KEYS),
  locationId: z.string().min(1).max(64).optional().nullable(),
});

/** A missing table/enum (migration not applied here), not a real failure. */
function isNotProvisioned(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2021" || err.code === "P2022") return true;
    if (err.code === "P2010") {
      const meta = (err.meta ?? {}) as { code?: string; message?: string };
      if (["42P01", "42703", "42704"].includes(meta.code ?? "")) return true;
      return /does not exist/i.test(meta.message ?? err.message);
    }
  }
  const msg = err instanceof Error ? err.message : String(err);
  return /does not exist/i.test(msg);
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await assertSuperAdmin();
    const { id } = await ctx.params;
    const parsed = postSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { milestone, outcome, evidence, notes, locationId } = parsed.data;

    const clinic = await prisma.clinic.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!clinic) return NextResponse.json({ error: "not_found" }, { status: 404 });

    // If a branch is named it must belong to this clinic — never let a sign-off
    // attach to another tenant's branch.
    if (locationId) {
      const loc = await prisma.clinicLocation.findFirst({
        where: { id: locationId, clinicId: id, deletedAt: null },
        select: { id: true },
      });
      if (!loc) return NextResponse.json({ error: "invalid_location" }, { status: 400 });
    }

    try {
      // One current row per (clinic, milestone, branch) — enforced by partial
      // unique indexes in the DB. Prisma cannot address a partial/nullable
      // compound unique, so find-then-write rather than upsert-by-key.
      const existing = await prisma.clinicMilestoneSignoff.findFirst({
        where: {
          clinicId: id,
          milestone: milestone as ClinicMilestone,
          locationId: locationId ?? null,
        },
      });

      const now = new Date();
      const saved = existing
        ? await prisma.clinicMilestoneSignoff.update({
            where: { id: existing.id },
            data: {
              outcome: outcome as MilestoneOutcome,
              evidence: evidence ?? null,
              notes: notes ?? null,
              actorId: actor.userId,
              actorRole: actor.role,
              signedOffAt: now,
            },
          })
        : await prisma.clinicMilestoneSignoff.create({
            data: {
              clinicId: id,
              locationId: locationId ?? null,
              milestone: milestone as ClinicMilestone,
              outcome: outcome as MilestoneOutcome,
              evidence: evidence ?? null,
              notes: notes ?? null,
              actorId: actor.userId,
              actorRole: actor.role,
              signedOffAt: now,
            },
          });

      // Audit the attestation directly (writeAuditLog cannot set clinicId, which
      // this row needs to surface in the clinic's audit feed). before/after are
      // the attestation outcomes only — never clinical content.
      await prisma.auditLog.create({
        data: {
          action: "CLINIC_MILESTONE_SIGNED_OFF",
          entityType: "ClinicMilestoneSignoff",
          entityId: saved.id,
          actorId: actor.userId,
          actorRole: actor.role,
          actorRoleSnapshot: actor.role,
          actorType: "admin",
          clinicId: id,
          clinicName: clinic.name,
          source: "web",
          beforeState: existing
            ? { outcome: existing.outcome, evidence: existing.evidence, notes: existing.notes }
            : undefined,
          afterState: { outcome: saved.outcome, evidence: saved.evidence, notes: saved.notes },
          metadata: { milestone, outcome, locationId: locationId ?? null },
        },
      });

      return NextResponse.json({
        signoff: {
          milestone,
          outcome: saved.outcome,
          evidence: saved.evidence,
          notes: saved.notes,
          actorName: saved.actorName,
          actorRole: saved.actorRole,
          signedOffAt: saved.signedOffAt.toISOString(),
        },
      });
    } catch (err) {
      if (isNotProvisioned(err)) {
        return NextResponse.json(
          {
            error: "not_provisioned",
            message:
              "Milestone sign-off storage is not provisioned in this environment. Apply migration 20261105_clinic_milestone_signoff.",
          },
          { status: 409 },
        );
      }
      throw err;
    }
  } catch (err) {
    const resp = handleAuthError(err);
    if (resp) return resp;
    console.error("[ADMIN CLINIC ROLLOUT POST]", err);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await assertSuperAdmin();
    const { id } = await ctx.params;
    const parsed = deleteSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { milestone, locationId } = parsed.data;

    const clinic = await prisma.clinic.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!clinic) return NextResponse.json({ error: "not_found" }, { status: 404 });

    try {
      const existing = await prisma.clinicMilestoneSignoff.findFirst({
        where: {
          clinicId: id,
          milestone: milestone as ClinicMilestone,
          locationId: locationId ?? null,
        },
      });
      if (!existing) return NextResponse.json({ ok: true, cleared: false });

      await prisma.clinicMilestoneSignoff.delete({ where: { id: existing.id } });
      await prisma.auditLog.create({
        data: {
          action: "CLINIC_MILESTONE_CLEARED",
          entityType: "ClinicMilestoneSignoff",
          entityId: existing.id,
          actorId: actor.userId,
          actorRole: actor.role,
          actorRoleSnapshot: actor.role,
          actorType: "admin",
          clinicId: id,
          clinicName: clinic.name,
          source: "web",
          beforeState: { outcome: existing.outcome, evidence: existing.evidence, notes: existing.notes },
          metadata: { milestone, locationId: locationId ?? null },
        },
      });
      return NextResponse.json({ ok: true, cleared: true });
    } catch (err) {
      if (isNotProvisioned(err)) {
        return NextResponse.json(
          { error: "not_provisioned", message: "Milestone sign-off storage is not provisioned." },
          { status: 409 },
        );
      }
      throw err;
    }
  } catch (err) {
    const resp = handleAuthError(err);
    if (resp) return resp;
    console.error("[ADMIN CLINIC ROLLOUT DELETE]", err);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
