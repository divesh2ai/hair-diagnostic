import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import type { ClinicStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertSuperAdmin, handleAuthError } from "@/lib/auth";
import { clinicCacheTag } from "@/lib/clinics/getClinicLandingData";
import { writeAuditLog, type AuditAction } from "@/lib/audit/writeAuditLog";

export const dynamic = "force-dynamic";

// GET /api/admin/clinics/[id]
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await assertSuperAdmin();
    const { id } = await params;

    const clinic = await prisma.clinic.findFirst({
      where: { id, deletedAt: null },
      include: {
        subscription: true,
        _count: { select: { doctors: true, patients: true } },
      },
    });
    if (!clinic) return NextResponse.json({ error: "not_found" }, { status: 404 });

    return NextResponse.json({ clinic });
  } catch (err) {
    const resp = handleAuthError(err);
    if (resp) return resp;
    console.error("[ADMIN CLINIC READ]", err);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

const patchSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  // slug intentionally NOT editable — it's a public URL key.
  region: z.string().min(1).max(60).optional(),
  language: z.string().min(2).max(8).optional(),
  timezone: z.string().min(1).max(60).optional(),
  email: z.string().email().nullish(),
  phone: z.string().max(32).nullish(),
  whatsappNumber: z.string().max(32).nullish(),
  address: z.string().max(500).nullish(),
  primaryColor: z.string().max(16).nullish(),
  secondaryColor: z.string().max(16).nullish(),
  accentColor: z.string().max(16).nullish(),
  footerText: z.string().max(500).nullish(),
  logoUrl: z.string().url().nullish(),
  tagline: z.string().max(200).nullish(),
  website: z.string().url().nullish(),
  supportedLanguages: z
    .array(z.enum(["EN", "HI", "MR", "GU", "PA", "TA", "TE"]))
    .optional(),
  subscription: z
    .object({
      plan: z.enum(["TRIAL", "STARTER", "PROFESSIONAL", "ENTERPRISE"]).optional(),
      status: z
        .enum(["ACTIVE", "PAST_DUE", "SUSPENDED", "CANCELED", "EXPIRED"])
        .optional(),
      monthlyAssessmentLimit: z.number().int().positive().nullish(),
      doctorSeatLimit: z.number().int().positive().nullish(),
      storageMbLimit: z.number().int().positive().nullish(),
      notes: z.string().max(2000).nullish(),
    })
    .optional(),
});

// PATCH /api/admin/clinics/[id] — partial update; subscription upserts.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await assertSuperAdmin();
    const { id } = await params;
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { subscription, ...clinicPatch } = parsed.data;

    const existing = await prisma.clinic.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const clinic = await prisma.clinic.update({
      where: { id },
      data: clinicPatch,
    });
    // Super-admin cosmetic edit — SWR is fine. Lifecycle transitions
    // (activate / suspend / archive) go through POST and use 'max'.
    revalidateTag(clinicCacheTag(clinic.slug), 'default');

    if (subscription) {
      await prisma.subscription.upsert({
        where: { clinicId: id },
        create: { clinicId: id, ...subscription },
        update: subscription,
      });
    }

    // Record WHICH fields changed, never their values — clinic config can
    // carry contact details, and the audit envelope is deliberately small.
    // A subscription plan/status change is called out separately because it
    // is the commercially significant edit inside this handler.
    await writeAuditLog({
      action: "CLINIC_UPDATED",
      entityType: "Clinic",
      entityId: id,
      actorId: ctx.userId,
      actorRole: ctx.role,
      actorType: "admin",
      metadata: {
        clinicId: id,
        slug: clinic.slug,
        fieldsChanged: Object.keys(clinicPatch).sort(),
        ...(subscription
          ? {
              subscriptionPlan: subscription.plan ?? null,
              subscriptionStatus: subscription.status ?? null,
            }
          : {}),
      },
    });

    return NextResponse.json({ clinic });
  } catch (err) {
    const resp = handleAuthError(err);
    if (resp) return resp;
    console.error("[ADMIN CLINIC PATCH]", err);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

const lifecycleSchema = z.object({
  action: z.enum(["suspend", "activate", "archive"]),
});

// POST /api/admin/clinics/[id] — lifecycle transitions. Soft-delete on archive.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await assertSuperAdmin();
    const { id } = await params;
    const body = await req.json();
    const parsed = lifecycleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_action" }, { status: 400 });
    }

    const clinic = await prisma.clinic.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!clinic) return NextResponse.json({ error: "not_found" }, { status: 404 });

    let nextStatus: ClinicStatus;
    let isActive: boolean;
    let deletedAt: Date | null = null;
    switch (parsed.data.action) {
      case "suspend":
        nextStatus = "SUSPENDED";
        isActive = false;
        break;
      case "activate":
        nextStatus = "ACTIVE";
        isActive = true;
        break;
      case "archive":
        nextStatus = "ARCHIVED";
        isActive = false;
        deletedAt = new Date();
        break;
    }

    const updated = await prisma.clinic.update({
      where: { id },
      data: { status: nextStatus, isActive, deletedAt },
      select: { id: true, slug: true, status: true, isActive: true, deletedAt: true },
    });
    // Activation / suspension / archive gates whether the landing page
    // renders at all. Immediate purge — a suspended clinic must never
    // serve one more request from a stale entry.
    revalidateTag(clinicCacheTag(updated.slug), 'max');

    // Archive is a soft-delete of an entire tenant and was previously
    // completely silent. Awaited, not fire-and-forget: a tenant lifecycle
    // change that cannot be attributed should fail loudly rather than
    // succeed unrecorded.
    const LIFECYCLE_ACTIONS: Record<typeof parsed.data.action, AuditAction> = {
      suspend: "CLINIC_SUSPENDED",
      activate: "CLINIC_ACTIVATED",
      archive: "CLINIC_ARCHIVED",
    };
    await writeAuditLog({
      action: LIFECYCLE_ACTIONS[parsed.data.action],
      entityType: "Clinic",
      entityId: id,
      actorId: ctx.userId,
      actorRole: ctx.role,
      actorType: "admin",
      metadata: {
        clinicId: id,
        slug: updated.slug,
        status: updated.status,
        softDeleted: updated.deletedAt !== null,
      },
    });

    return NextResponse.json({
      clinic: {
        id: updated.id,
        status: updated.status,
        isActive: updated.isActive,
        deletedAt: updated.deletedAt,
      },
    });
  } catch (err) {
    const resp = handleAuthError(err);
    if (resp) return resp;
    console.error("[ADMIN CLINIC LIFECYCLE]", err);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
