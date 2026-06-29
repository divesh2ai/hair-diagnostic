import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  canManageClinic,
  ForbiddenError,
  getClinicContext,
  handleAuthError,
} from "@/lib/auth";
import {
  mergeWhatsappSettings,
  whatsappSettingsSchema,
} from "@/lib/clinic/whatsapp";

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
      select: { whatsappNumber: true, whatsappSettings: true },
    });
    if (!clinic) return NextResponse.json({ error: "not_found" }, { status: 404 });

    return NextResponse.json({
      whatsappNumber: clinic.whatsappNumber,
      settings: mergeWhatsappSettings(clinic.whatsappSettings),
    });
  } catch (err) {
    const resp = handleAuthError(err);
    if (resp) return resp;
    console.error("[CLINIC WA GET]", err);
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
    const settingsParse = whatsappSettingsSchema.partial().safeParse(body.settings ?? {});
    if (!settingsParse.success) {
      return NextResponse.json(
        { error: "validation", details: settingsParse.error.flatten() },
        { status: 400 },
      );
    }
    const merged = {
      ...mergeWhatsappSettings(
        (await prisma.clinic.findUniqueOrThrow({ where: { id: clinicId } }))
          .whatsappSettings,
      ),
      ...settingsParse.data,
    };

    const updated = await prisma.clinic.update({
      where: { id: clinicId },
      data: {
        ...(typeof body.whatsappNumber === "string" || body.whatsappNumber === null
          ? { whatsappNumber: body.whatsappNumber }
          : {}),
        whatsappSettings: merged,
      },
      select: { whatsappNumber: true, whatsappSettings: true },
    });
    return NextResponse.json({
      whatsappNumber: updated.whatsappNumber,
      settings: mergeWhatsappSettings(updated.whatsappSettings),
    });
  } catch (err) {
    const resp = handleAuthError(err);
    if (resp) return resp;
    console.error("[CLINIC WA PATCH]", err);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

// POST /api/clinic/whatsapp?action=test — stub. Sprint 2 will wire the
// real WhatsApp Business send test; for now we mark connection ATTEMPTED
// and surface the timestamp so the UI loop is testable end-to-end.
export async function POST(req: Request) {
  try {
    const ctx = await getClinicContext();
    if (!canManageClinic(ctx.role)) throw new ForbiddenError();
    const clinicId = pickClinicId(ctx, new URL(req.url));
    if (!clinicId) throw new ForbiddenError("No clinic scope");

    const clinic = await prisma.clinic.findUniqueOrThrow({
      where: { id: clinicId },
    });
    const merged = {
      ...mergeWhatsappSettings(clinic.whatsappSettings),
      connectionStatus: clinic.whatsappNumber ? "CONNECTED" : "UNCONFIGURED",
      lastTestedAt: new Date().toISOString(),
    } as const;
    await prisma.clinic.update({
      where: { id: clinicId },
      data: { whatsappSettings: merged },
    });
    return NextResponse.json({ ok: true, settings: merged });
  } catch (err) {
    const resp = handleAuthError(err);
    if (resp) return resp;
    console.error("[CLINIC WA TEST]", err);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
