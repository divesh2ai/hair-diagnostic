import { prisma } from "@/lib/prisma";
import { isDoctorSessionCurrent } from "./doctorSessionPolicy";
import { doctorScreenIsUnlocked, matchesGoogleSessionBinding } from "./googleSessionBinding";

type Claims = { sub?: string; session_id?: string; user_role?: string; clinic_id?: string };

export async function checkLiveDoctorSession(claims: Claims, binding?: string, screen?: string): Promise<"active" | "locked" | "expired" | "denied"> {
  if (!claims.sub || !claims.session_id || !claims.clinic_id) return "denied";
  const [session] = await prisma.$queryRaw<{ createdAt: Date; google: boolean }[]>`
    SELECT s.created_at AS "createdAt",
      EXISTS (
        SELECT 1 FROM auth.identities i WHERE i.user_id = s.user_id AND i.provider = 'google'
      ) AS google
    FROM auth.sessions s
    JOIN public."Doctor" d ON s.user_id::text IN (d."supabaseUserId", d."supabasePhoneUserId")
    JOIN public."Clinic" c ON c.id = d."clinicId"
    WHERE s.id::text = ${claims.session_id} AND s.user_id::text = ${claims.sub}
      AND (s.not_after IS NULL OR s.not_after > now())
      AND c.id = ${claims.clinic_id} AND c."isActive" AND c.status = 'ACTIVE'
      AND c."deletedAt" IS NULL AND d."isActive" AND d."deletedAt" IS NULL
  `;
  if (!session) return "denied";
  if (session.google && (
    !isDoctorSessionCurrent(session.createdAt) || !matchesGoogleSessionBinding(claims.session_id, binding)
  )) return "expired";
  if (session.google && binding && !doctorScreenIsUnlocked(binding, screen)) return "locked";
  return "active";
}
