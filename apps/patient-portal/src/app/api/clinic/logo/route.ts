import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import {
  canManageClinic,
  ForbiddenError,
  getClinicContext,
  handleAuthError,
} from "@/lib/auth";
import { clinicCacheTag } from "@/lib/clinics/getClinicLandingData";

// POST   /api/clinic/logo — upload the current clinic's logo file.
// DELETE /api/clinic/logo — clear it.
//
// The clinic logo is CLINIC-WIDE branding. It is writable by the clinic's
// managers (SUPER_ADMIN / ORG_ADMIN / CLINIC_ADMIN) AND by a DOCTOR acting on
// THEIR OWN clinic — at launch the clinician is usually the clinic owner, so
// the doctor profile exposes this. A doctor is always scoped to ctx.clinicId;
// only a Super Admin may target another clinic with ?clinicId=.
//
// Storage mirrors /api/doctor/me/avatar: service-role upload into the PRIVATE
// `doctor-avatars` bucket (a clinic-published, non-patient asset in the same
// trust tier), with the Clinic row holding the stable /api/avatar/<path> URL.
// After the write the clinic landing cache is revalidated so patient-facing
// pages pick up the new logo.

const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);
const MAX_BYTES = 4 * 1024 * 1024;

function extFor(type: string): string {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/svg+xml") return "svg";
  return "jpg";
}

function resolveClinicId(ctxClinicId: string | null, override: string | null, isSA: boolean) {
  if (isSA) return override ?? ctxClinicId;
  return ctxClinicId;
}

export async function POST(req: Request) {
  try {
    const ctx = await getClinicContext();
    if (!canManageClinic(ctx.role) && ctx.role !== "DOCTOR") throw new ForbiddenError();
    const isSA = ctx.role === "SUPER_ADMIN";
    const clinicId = resolveClinicId(
      ctx.clinicId,
      new URL(req.url).searchParams.get("clinicId"),
      isSA,
    );
    if (!clinicId) throw new ForbiddenError("No clinic scope");

    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }
    if (!ALLOWED.has(file.type)) {
      return NextResponse.json(
        { error: "Only PNG, JPEG, WebP or SVG images are allowed" },
        { status: 400 },
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Image exceeds 4MB limit" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: "Storage not configured" }, { status: 500 });
    }
    const supabase = createClient(supabaseUrl, serviceKey);

    const path = `clinic-logos/${clinicId}-${Date.now()}.${extFor(file.type)}`;
    const bytes = new Uint8Array(await file.arrayBuffer());

    const { error: uploadErr } = await supabase.storage
      .from("doctor-avatars")
      .upload(path, bytes, { contentType: file.type, upsert: true });

    if (uploadErr) {
      console.error("[clinic logo] upload failed:", uploadErr);
      const isMissingBucket = /bucket not found/i.test(uploadErr.message);
      return NextResponse.json(
        {
          error: isMissingBucket
            ? "Logo storage is not set up for this environment yet. Please contact an administrator."
            : "Upload failed",
        },
        { status: isMissingBucket ? 503 : 500 },
      );
    }

    const logoUrl = `/api/avatar/${encodeURIComponent(path)}`;
    const clinic = await prisma.clinic.update({
      where: { id: clinicId },
      data: { logoUrl },
      select: { slug: true },
    });
    revalidateTag(clinicCacheTag(clinic.slug), "default");

    return NextResponse.json({ logoUrl });
  } catch (err) {
    const resp = handleAuthError(err);
    if (resp) return resp;
    console.error("[CLINIC LOGO POST]", err);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const ctx = await getClinicContext();
    if (!canManageClinic(ctx.role) && ctx.role !== "DOCTOR") throw new ForbiddenError();
    const isSA = ctx.role === "SUPER_ADMIN";
    const clinicId = resolveClinicId(
      ctx.clinicId,
      new URL(req.url).searchParams.get("clinicId"),
      isSA,
    );
    if (!clinicId) throw new ForbiddenError("No clinic scope");

    const clinic = await prisma.clinic.update({
      where: { id: clinicId },
      data: { logoUrl: null },
      select: { slug: true },
    });
    revalidateTag(clinicCacheTag(clinic.slug), "default");
    return NextResponse.json({ logoUrl: null });
  } catch (err) {
    const resp = handleAuthError(err);
    if (resp) return resp;
    console.error("[CLINIC LOGO DELETE]", err);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
