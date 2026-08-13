import { NextResponse, type NextRequest } from "next/server";
import { requireDoctorContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Doctor self-context endpoint for the /doctor header chrome. Requires a
// live Doctor row; admins visiting /admin have their own self-context
// endpoints and never hit this route (verified: grep of the codebase
// shows only /doctor/* pages call it).
export async function GET() {
  const authResult = await requireDoctorContext();
  if (authResult instanceof NextResponse) return authResult;
  const { doctor: docCtx, authRole, authEmail } = authResult;

  const [clinic, doctor] = await Promise.all([
    prisma.clinic.findUnique({
      where: { id: docCtx.clinicId },
      select: { name: true, slug: true, logoUrl: true, tagline: true },
    }),
    // Fetch the full render-only fields the profile card needs (photo,
    // specialization, badgeTheme). Trust source is docCtx.id — never a
    // supabaseUserId lookup that could match a stale email fallback row.
    prisma.doctor.findUnique({
      where: { id: docCtx.id },
      select: {
        id: true,
        name: true,
        photoUrl: true,
        specialization: true,
        badgeTheme: true,
      },
    }),
  ]);

  return NextResponse.json({
    clinic,
    doctor,
    role: authRole,
    email: authEmail,
  });
}

// Per-doctor UI preferences. Currently only badgeTheme — the workspace
// accent shown on the /doctor hero identity card. Persisted server-side
// so the pick survives across devices, browsers, and preview URLs (which
// each have their own origin and therefore their own localStorage).
const ALLOWED_BADGE_THEMES = new Set([
  "amber",
  "teal",
  "rose",
  "indigo",
  "emerald",
  "slate",
  "gold",
  "plum",
]);

export async function PATCH(req: NextRequest) {
  const authResult = await requireDoctorContext();
  if (authResult instanceof NextResponse) return authResult;
  const { doctor } = authResult;

  const body = (await req.json().catch(() => null)) as
    | { badgeTheme?: string | null }
    | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const patch: { badgeTheme?: string | null } = {};
  if ("badgeTheme" in body) {
    const v = body.badgeTheme;
    if (v !== null && (typeof v !== "string" || !ALLOWED_BADGE_THEMES.has(v))) {
      return NextResponse.json({ error: "Invalid badgeTheme" }, { status: 400 });
    }
    patch.badgeTheme = v;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const updated = await prisma.doctor.update({
    where: { id: doctor.id },
    data: patch,
    select: { badgeTheme: true },
  });
  return NextResponse.json(updated);
}
