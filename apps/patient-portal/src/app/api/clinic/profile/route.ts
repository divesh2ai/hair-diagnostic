import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  canManageClinic,
  ForbiddenError,
  getClinicContext,
  handleAuthError,
} from "@/lib/auth";
import { clinicCacheTag } from "@/lib/clinics/getClinicLandingData";

export const dynamic = "force-dynamic";

// /api/clinic/profile — branding + contact for the current clinic. Used by
// the Clinic Admin Branding page; Super Admin can hit it with ?clinicId=.
function resolveClinicId(ctxClinicId: string | null, override: string | null, isSA: boolean) {
  if (isSA) return override ?? ctxClinicId;
  return ctxClinicId;
}

export async function GET(req: Request) {
  try {
    const ctx = await getClinicContext();
    const isSA = ctx.role === "SUPER_ADMIN";
    const clinicId = resolveClinicId(
      ctx.clinicId,
      new URL(req.url).searchParams.get("clinicId"),
      isSA,
    );
    if (!clinicId) throw new ForbiddenError("No clinic scope");

    const clinic = await prisma.clinic.findFirst({
      where: { id: clinicId, deletedAt: null },
    });
    if (!clinic) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ clinic });
  } catch (err) {
    const resp = handleAuthError(err);
    if (resp) return resp;
    console.error("[CLINIC PROFILE GET]", err);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

const patchSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  tagline: z.string().max(200).nullish(),
  logoUrl: z.string().url().nullish(),
  primaryColor: z.string().max(16).nullish(),
  secondaryColor: z.string().max(16).nullish(),
  accentColor: z.string().max(16).nullish(),
  footerText: z.string().max(500).nullish(),
  whatsappNumber: z.string().max(32).nullish(),
  website: z.string().url().nullish(),
  address: z.string().max(500).nullish(),
  phone: z.string().max(32).nullish(),
  email: z.string().email().nullish(),
});

export async function PATCH(req: Request) {
  try {
    const ctx = await getClinicContext();
    if (!canManageClinic(ctx.role)) throw new ForbiddenError();
    const isSA = ctx.role === "SUPER_ADMIN";
    const url = new URL(req.url);
    const clinicId = resolveClinicId(
      ctx.clinicId,
      url.searchParams.get("clinicId"),
      isSA,
    );
    if (!clinicId) throw new ForbiddenError("No clinic scope");

    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const clinic = await prisma.clinic.update({
      where: { id: clinicId },
      data: parsed.data,
    });
    // Landing page renders name/tagline/address from the cached loader —
    // invalidate so the next patient visit sees the edit immediately.
    revalidateTag(clinicCacheTag(clinic.slug), 'max');
    return NextResponse.json({ clinic });
  } catch (err) {
    const resp = handleAuthError(err);
    if (resp) return resp;
    console.error("[CLINIC PROFILE PATCH]", err);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
