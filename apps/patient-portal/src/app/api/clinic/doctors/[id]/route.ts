import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  assertClinicAccess,
  canManageDoctors,
  ForbiddenError,
  getClinicContext,
  handleAuthError,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(32).nullish(),
  qualification: z.string().max(200).nullish(),
  registrationNumber: z.string().max(64).nullish(),
  biography: z.string().max(5000).nullish(),
  preferredLanguage: z
    .enum(["EN", "HI", "MR", "GU", "PA", "TA", "TE"])
    .optional(),
  avatarUrl: z.string().url().nullish(),
  signatureUrl: z.string().url().nullish(),
  specialization: z.string().max(200).nullish(),
  isActive: z.boolean().optional(),
});

async function loadAndAuthorize(id: string) {
  const ctx = await getClinicContext();
  const doctor = await prisma.doctor.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, clinicId: true },
  });
  if (!doctor) throw new Error("not_found");
  await assertClinicAccess(doctor.clinicId);
  if (!canManageDoctors(ctx.role)) throw new ForbiddenError();
  return doctor;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const doctor = await prisma.doctor.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        clinicId: true,
        name: true,
        email: true,
        phone: true,
        avatarUrl: true,
        photoUrl: true,
        signatureUrl: true,
        qualification: true,
        registrationNumber: true,
        biography: true,
        bio: true,
        specialization: true,
        preferredLanguage: true,
        isActive: true,
        createdAt: true,
      },
    });
    if (!doctor) return NextResponse.json({ error: "not_found" }, { status: 404 });
    await assertClinicAccess(doctor.clinicId);
    return NextResponse.json({
      doctor: { ...doctor, createdAt: doctor.createdAt.toISOString() },
    });
  } catch (err) {
    const resp = handleAuthError(err);
    if (resp) return resp;
    console.error("[CLINIC DOCTOR READ]", err);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await loadAndAuthorize(id);
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const doctor = await prisma.doctor.update({
      where: { id },
      data: parsed.data,
    });
    return NextResponse.json({ doctor });
  } catch (err) {
    if ((err as Error).message === "not_found") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    const resp = handleAuthError(err);
    if (resp) return resp;
    console.error("[CLINIC DOCTOR PATCH]", err);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
