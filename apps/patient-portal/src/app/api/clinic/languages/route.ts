import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  canManageClinic,
  ForbiddenError,
  getClinicContext,
  handleAuthError,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

const LANGS = ["EN", "HI", "MR", "GU", "PA", "TA", "TE"] as const;

export async function GET(req: Request) {
  try {
    const ctx = await getClinicContext();
    const isSA = ctx.role === "SUPER_ADMIN";
    const clinicId = isSA
      ? (new URL(req.url).searchParams.get("clinicId") ?? ctx.clinicId)
      : ctx.clinicId;
    if (!clinicId) throw new ForbiddenError("No clinic scope");

    const clinic = await prisma.clinic.findFirst({
      where: { id: clinicId, deletedAt: null },
      select: { supportedLanguages: true, language: true },
    });
    if (!clinic) return NextResponse.json({ error: "not_found" }, { status: 404 });

    // Empty array = all enabled. The UI shows them as enabled in that case.
    return NextResponse.json({
      supportedLanguages:
        clinic.supportedLanguages.length === 0 ? LANGS.slice() : clinic.supportedLanguages,
      defaultLanguage: clinic.language,
    });
  } catch (err) {
    const resp = handleAuthError(err);
    if (resp) return resp;
    console.error("[CLINIC LANGS GET]", err);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

const patchSchema = z.object({
  supportedLanguages: z.array(z.enum(LANGS)).min(1),
  defaultLanguage: z.enum(LANGS).optional(),
});

export async function PATCH(req: Request) {
  try {
    const ctx = await getClinicContext();
    if (!canManageClinic(ctx.role)) throw new ForbiddenError();
    const isSA = ctx.role === "SUPER_ADMIN";
    const clinicId = isSA
      ? (new URL(req.url).searchParams.get("clinicId") ?? ctx.clinicId)
      : ctx.clinicId;
    if (!clinicId) throw new ForbiddenError("No clinic scope");

    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { supportedLanguages, defaultLanguage } = parsed.data;
    if (defaultLanguage && !supportedLanguages.includes(defaultLanguage)) {
      return NextResponse.json(
        { error: "default_not_in_supported" },
        { status: 400 },
      );
    }

    const clinic = await prisma.clinic.update({
      where: { id: clinicId },
      data: {
        supportedLanguages,
        ...(defaultLanguage ? { language: defaultLanguage.toLowerCase() } : {}),
      },
      select: { supportedLanguages: true, language: true },
    });

    return NextResponse.json(clinic);
  } catch (err) {
    const resp = handleAuthError(err);
    if (resp) return resp;
    console.error("[CLINIC LANGS PATCH]", err);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
