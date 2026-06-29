import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  canManageClinic,
  ForbiddenError,
  getClinicContext,
  handleAuthError,
} from "@/lib/auth";
import {
  clinicSettingsSchema,
  mergeClinicSettings,
} from "@/lib/clinic/settings";

export const dynamic = "force-dynamic";

function pickClinicId(ctx: { role: string; clinicId: string | null }, url: URL) {
  if (ctx.role === "SUPER_ADMIN") {
    return url.searchParams.get("clinicId") ?? ctx.clinicId;
  }
  return ctx.clinicId;
}

export async function GET(req: Request) {
  try {
    const ctx = await getClinicContext();
    const clinicId = pickClinicId(ctx, new URL(req.url));
    if (!clinicId) throw new ForbiddenError("No clinic scope");

    const clinic = await prisma.clinic.findFirst({
      where: { id: clinicId, deletedAt: null },
      select: { settings: true, timezone: true },
    });
    if (!clinic) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({
      settings: mergeClinicSettings(clinic.settings),
      timezone: clinic.timezone,
    });
  } catch (err) {
    const resp = handleAuthError(err);
    if (resp) return resp;
    console.error("[CLINIC SETTINGS GET]", err);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const ctx = await getClinicContext();
    if (!canManageClinic(ctx.role)) throw new ForbiddenError();
    const clinicId = pickClinicId(ctx, new URL(req.url));
    if (!clinicId) throw new ForbiddenError("No clinic scope");

    const body = await req.json();
    const settingsParse = clinicSettingsSchema.partial().safeParse(body.settings ?? {});
    if (!settingsParse.success) {
      return NextResponse.json(
        { error: "validation", details: settingsParse.error.flatten() },
        { status: 400 },
      );
    }
    const current = await prisma.clinic.findUniqueOrThrow({
      where: { id: clinicId },
      select: { settings: true },
    });
    const merged = {
      ...mergeClinicSettings(current.settings),
      ...settingsParse.data,
    };
    const updated = await prisma.clinic.update({
      where: { id: clinicId },
      data: {
        settings: merged,
        ...(typeof body.timezone === "string" ? { timezone: body.timezone } : {}),
      },
      select: { settings: true, timezone: true },
    });
    return NextResponse.json({
      settings: mergeClinicSettings(updated.settings),
      timezone: updated.timezone,
    });
  } catch (err) {
    const resp = handleAuthError(err);
    if (resp) return resp;
    console.error("[CLINIC SETTINGS PATCH]", err);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
