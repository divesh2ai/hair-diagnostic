import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  clinicScope,
  getClinicContext,
  handleAuthError,
  isSuperAdmin,
  canManageDoctors,
  ForbiddenError,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/clinic/doctors — clinic-scoped list.
export async function GET(req: Request) {
  try {
    const ctx = await getClinicContext();
    const url = new URL(req.url);
    const search = url.searchParams.get("search")?.trim() ?? "";
    const requestedClinicId = url.searchParams.get("clinicId");
    const scope = isSuperAdmin(ctx.role)
      ? requestedClinicId
        ? { clinicId: requestedClinicId }
        : {}
      : clinicScope(ctx);

    const where: Prisma.DoctorWhereInput = {
      ...scope,
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
              { phone: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const rows = await prisma.doctor.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        avatarUrl: true,
        photoUrl: true,
        qualification: true,
        registrationNumber: true,
        preferredLanguage: true,
        isActive: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      rows: rows.map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        phone: r.phone,
        avatarUrl: r.avatarUrl ?? r.photoUrl,
        qualification: r.qualification,
        registrationNumber: r.registrationNumber,
        preferredLanguage: r.preferredLanguage,
        isActive: r.isActive,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    const resp = handleAuthError(err);
    if (resp) return resp;
    console.error("[CLINIC DOCTORS LIST]", err);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

const createSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  phone: z.string().max(32).nullish(),
  qualification: z.string().max(200).nullish(),
  registrationNumber: z.string().max(64).nullish(),
  biography: z.string().max(5000).nullish(),
  preferredLanguage: z
    .enum(["EN", "HI", "MR", "GU", "PA", "TA", "TE"])
    .default("EN"),
  avatarUrl: z.string().url().nullish(),
  signatureUrl: z.string().url().nullish(),
  specialization: z.string().max(200).nullish(),
  // Super Admin can target any clinic; clinic admins always create within their own.
  clinicId: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const ctx = await getClinicContext();
    if (!canManageDoctors(ctx.role)) throw new ForbiddenError();
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { clinicId: requestedClinicId, ...data } = parsed.data;
    const clinicId = isSuperAdmin(ctx.role)
      ? (requestedClinicId ?? ctx.clinicId)
      : ctx.clinicId;
    if (!clinicId) throw new ForbiddenError("No clinic scope");

    const doctor = await prisma.doctor.create({
      data: { ...data, clinicId },
      select: { id: true, name: true, email: true },
    });
    return NextResponse.json({ doctor }, { status: 201 });
  } catch (err) {
    const resp = handleAuthError(err);
    if (resp) return resp;
    console.error("[CLINIC DOCTOR CREATE]", err);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
