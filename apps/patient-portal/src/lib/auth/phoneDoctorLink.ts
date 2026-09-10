import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";

// First-login (and every subsequent login) resolution for a doctor who
// authenticated via phone OTP.
//
// ── Why this exists separately from the JWT claims hook ────────────────────
// The hook (custom_access_token_hook.sql) already fallback-matches a
// pre-provisioned Doctor by phone digits, so the FIRST token minted right
// after OTP verification already carries role=DOCTOR — the proxy will let
// the request through before this function ever runs. What the hook does
// NOT do is write anything back: Doctor.supabaseUserId stays null and
// provisioningStatus stays whatever it was. This function is the one place
// that performs that write, exactly once, idempotently, with a conflict
// check — the same job acceptInvitation() does for the email path.
//
// ── Never auto-creates a Doctor ─────────────────────────────────────────────
// A verified phone that matches no Doctor row is refused. OTP verification
// proves control of a phone number; it proves nothing about clinical
// authorization. Only a Super-Admin-provisioned Doctor row may ever reach
// the clinic workspace.

export type PhoneDoctorLinkResult =
  | { ok: true; doctorId: string; clinicId: string; alreadyLinked: boolean }
  | { ok: false; reason: "unregistered" | "conflict" };

/**
 * Normalise the way Supabase and Doctor.phone can each represent the same
 * number ("+919876543210" vs "919876543210") down to digits only, so a
 * mismatch in leading '+' never causes a false negative.
 */
function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, "");
}

export async function resolveOrLinkDoctorByPhone(input: {
  supabaseUserId: string;
  verifiedPhone: string;
}): Promise<PhoneDoctorLinkResult> {
  const phoneDigits = digitsOnly(input.verifiedPhone);
  if (!phoneDigits) return { ok: false, reason: "unregistered" };

  // Scan for the live Doctor row this phone belongs to. Digit-only compare
  // in application code (rather than a SQL regexp) keeps this function
  // testable without a real Postgres connection; the authorization-bearing
  // copy of this same match lives in the claims hook and runs in the DB.
  const candidates = await prisma.doctor.findMany({
    where: { isActive: true, deletedAt: null, phone: { not: null } },
    select: { id: true, clinicId: true, phone: true, supabaseUserId: true },
  });
  const doctor = candidates.find(
    (d) => d.phone && digitsOnly(d.phone) === phoneDigits,
  );

  if (!doctor) {
    // No PII in the audit row beyond what's already attached to the auth
    // identity itself — the phone number is not written here.
    await writeAuditLog({
      action: "DOCTOR_PHONE_LOGIN_DENIED_UNREGISTERED",
      entityType: "AuthUser",
      entityId: input.supabaseUserId,
      actorId: input.supabaseUserId,
      actorType: "doctor",
    });
    return { ok: false, reason: "unregistered" };
  }

  if (doctor.supabaseUserId === input.supabaseUserId) {
    // Re-login: already linked to this exact identity. No write needed.
    return {
      ok: true,
      doctorId: doctor.id,
      clinicId: doctor.clinicId,
      alreadyLinked: true,
    };
  }

  if (doctor.supabaseUserId && doctor.supabaseUserId !== input.supabaseUserId) {
    // This phone number matches a Doctor row already linked to a DIFFERENT
    // Supabase identity. Never silently relink — that would let a second
    // party who somehow verified the same number (SIM swap, provisioning
    // error) take over clinical access. Fail closed and audit it.
    await writeAuditLog({
      action: "DOCTOR_PHONE_LOGIN_DENIED_CONFLICT",
      entityType: "Doctor",
      entityId: doctor.id,
      actorId: input.supabaseUserId,
      actorType: "doctor",
      clinicId: doctor.clinicId,
      metadata: { reason: "supabaseUserId_conflict" },
    });
    return { ok: false, reason: "conflict" };
  }

  // First login: doctor.supabaseUserId is null. Link atomically — the
  // WHERE clause re-asserts supabaseUserId IS NULL so a race between two
  // concurrent first-login attempts (should never happen for one phone, but
  // cheap to guard) can only let one of them win.
  const updated = await prisma.doctor.updateMany({
    where: { id: doctor.id, supabaseUserId: null },
    data: { supabaseUserId: input.supabaseUserId, provisioningStatus: "ACTIVE" },
  });

  if (updated.count === 0) {
    // Lost the race, or another request linked it a moment ago. Re-read to
    // find out which identity actually won.
    const fresh = await prisma.doctor.findUnique({
      where: { id: doctor.id },
      select: { supabaseUserId: true, clinicId: true },
    });
    if (fresh?.supabaseUserId === input.supabaseUserId) {
      return { ok: true, doctorId: doctor.id, clinicId: doctor.clinicId, alreadyLinked: true };
    }
    await writeAuditLog({
      action: "DOCTOR_PHONE_LOGIN_DENIED_CONFLICT",
      entityType: "Doctor",
      entityId: doctor.id,
      actorId: input.supabaseUserId,
      actorType: "doctor",
      clinicId: doctor.clinicId,
      metadata: { reason: "race_lost" },
    });
    return { ok: false, reason: "conflict" };
  }

  await writeAuditLog({
    action: "DOCTOR_PHONE_LOGIN_LINKED",
    entityType: "Doctor",
    entityId: doctor.id,
    actorId: input.supabaseUserId,
    actorType: "doctor",
    clinicId: doctor.clinicId,
  });

  return { ok: true, doctorId: doctor.id, clinicId: doctor.clinicId, alreadyLinked: false };
}
