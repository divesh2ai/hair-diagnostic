import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertSuperAdmin, handleAuthError } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/admin/clinics?search=&status=&limit=&offset=
export async function GET(req: Request) {
  try {
    await assertSuperAdmin();

    const url = new URL(req.url);
    const search = url.searchParams.get("search")?.trim() ?? "";
    const status = url.searchParams.get("status");
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);
    const offset = Math.max(Number(url.searchParams.get("offset") ?? 0), 0);

    const where: Prisma.ClinicWhereInput = {
      deletedAt: null,
      ...(status ? { status: status as Prisma.EnumClinicStatusFilter["equals"] } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { slug: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.clinic.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          slug: true,
          logoUrl: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { doctors: true, patients: true } },
        },
      }),
      prisma.clinic.count({ where }),
    ]);

    return NextResponse.json({
      rows: rows.map((r) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        logoUrl: r.logoUrl,
        status: r.status,
        doctorCount: r._count.doctors,
        patientCount: r._count.patients,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
      total,
      limit,
      offset,
    });
  } catch (err) {
    const resp = handleAuthError(err);
    if (resp) return resp;
    console.error("[ADMIN CLINICS LIST]", err);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

const createSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "lowercase letters, digits, hyphens only"),
  region: z.string().min(1).max(60).default("IN"),
  language: z.string().min(2).max(8).default("en"),
  timezone: z.string().min(1).max(60).default("Asia/Kolkata"),
  email: z.string().email().nullish(),
  phone: z.string().max(32).nullish(),
  whatsappNumber: z.string().max(32).nullish(),
  address: z.string().max(500).nullish(),
  primaryColor: z.string().max(16).nullish(),
  secondaryColor: z.string().max(16).nullish(),
  accentColor: z.string().max(16).nullish(),
  logoUrl: z.string().url().nullish(),
  tagline: z.string().max(200).nullish(),
  website: z.string().url().nullish(),
});

// POST /api/admin/clinics — create
export async function POST(req: Request) {
  try {
    await assertSuperAdmin();
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const data = parsed.data;

    const existing = await prisma.clinic.findUnique({ where: { slug: data.slug } });
    if (existing) {
      return NextResponse.json(
        { error: "slug_taken" },
        { status: 409 },
      );
    }

    const clinic = await prisma.clinic.create({
      data: {
        name: data.name,
        slug: data.slug,
        region: data.region,
        language: data.language,
        timezone: data.timezone,
        email: data.email ?? null,
        phone: data.phone ?? null,
        whatsappNumber: data.whatsappNumber ?? null,
        address: data.address ?? null,
        primaryColor: data.primaryColor ?? null,
        secondaryColor: data.secondaryColor ?? null,
        accentColor: data.accentColor ?? null,
        logoUrl: data.logoUrl ?? null,
        tagline: data.tagline ?? null,
        website: data.website ?? null,
      },
      select: { id: true, slug: true, name: true },
    });

    return NextResponse.json({ clinic }, { status: 201 });
  } catch (err) {
    const resp = handleAuthError(err);
    if (resp) return resp;
    console.error("[ADMIN CLINIC CREATE]", err);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
