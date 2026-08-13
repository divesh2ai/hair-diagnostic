import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { signIntakeSession } from "@/lib/patient/intakeSession";

export const dynamic = "force-dynamic";

// POST /api/patient/intake/session   { clinicSlug }  ->  { token, expiresAt }
//
// Opens an anonymous intake session for one clinic. This is the only place a
// clinic slug is accepted from the client; every later step in the intake flow
// reads its clinic from the signed token instead, so a caller cannot point the
// identity lookup at a clinic it was never handed by a QR code.
//
// Issuing a token proves nothing about the patient. It only scopes what the
// following requests are allowed to ask about.

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") ?? "local";

  // A real intake opens one session per visit. This ceiling is generous for a
  // shared clinic tablet behind one NAT address and still refuses a script
  // that wants a fresh scope for every number it tries.
  const { ok } = rateLimit(`intake-session:${ip}`, 30, 60 * 60_000);
  if (!ok) {
    return NextResponse.json(
      { success: false, error: "Too many intake sessions. Please try again later." },
      { status: 429 },
    );
  }

  let body: { clinicSlug?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const clinicSlug = (body.clinicSlug ?? "").trim();
  if (!clinicSlug) {
    return NextResponse.json(
      { success: false, error: "clinicSlug is required" },
      { status: 400 },
    );
  }

  try {
    const clinic = await prisma.clinic.findUnique({
      where: { slug: clinicSlug },
      select: { id: true, isActive: true, deletedAt: true },
    });

    if (!clinic || clinic.deletedAt) {
      return NextResponse.json(
        { success: false, error: "Clinic not found" },
        { status: 404 },
      );
    }
    if (!clinic.isActive) {
      return NextResponse.json(
        { success: false, error: "Clinic is not accepting assessments" },
        { status: 403 },
      );
    }

    const session = signIntakeSession(clinic.id);

    return NextResponse.json({
      success: true,
      token: session.token,
      expiresAt: new Date(session.expiresAt).toISOString(),
    });
  } catch (err) {
    console.error("[INTAKE SESSION]", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
