import { redirect } from "next/navigation";
import { getClinicContext, UnauthorizedError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Post-login landing router. Called by /login after verifyOtp succeeds so
// that role-priority (not "/doctor for everyone") decides where the user
// lands.
//
// Priority — highest-privilege operational surface first, matching the
// authorisation decisions locked 2026-08-10:
//   SUPER_ADMIN  → /admin
//   ORG_ADMIN    → /admin
//   CLINIC_ADMIN → /clinic
//   DOCTOR       → /doctor  (only when a live Doctor row exists)
//   STAFF        → /clinic
//   anything else / patient → /
//
// ?next= is honoured only when it points to a surface the caller can
// actually enter — a random ?next=/doctor from a session-expired admin
// without a Doctor row is silently ignored (routes to /admin instead) so
// role alone never grants Doctor authority.
export default async function PostLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  let ctx;
  try {
    ctx = await getClinicContext();
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect("/login");
    throw err;
  }

  const params = await searchParams;
  const next = params?.next;

  const hasDoctorRow = await prisma.doctor
    .findFirst({
      where: {
        supabaseUserId: ctx.userId,
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
    })
    .then((r) => !!r);

  const canEnter = (path: string): boolean => {
    if (path.startsWith("/doctor")) return hasDoctorRow;
    if (path.startsWith("/admin")) {
      return ctx.role === "SUPER_ADMIN" || ctx.role === "ORG_ADMIN";
    }
    if (path.startsWith("/clinic")) {
      return (
        ctx.role === "SUPER_ADMIN" ||
        ctx.role === "ORG_ADMIN" ||
        ctx.role === "CLINIC_ADMIN" ||
        ctx.role === "STAFF"
      );
    }
    return true;
  };

  if (next && next.startsWith("/") && canEnter(next)) {
    redirect(next);
  }

  const priorityTarget = (() => {
    if (ctx.role === "SUPER_ADMIN" || ctx.role === "ORG_ADMIN") return "/admin";
    if (ctx.role === "CLINIC_ADMIN" || ctx.role === "STAFF") return "/clinic";
    if (ctx.role === "DOCTOR" && hasDoctorRow) return "/doctor";
    if (ctx.role === "DOCTOR") return "/login?reason=forbidden";
    return "/";
  })();

  redirect(priorityTarget);
}
