import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";
import { isLinkedIdentity } from "./doctorIdentity";

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
  | { ok: false; reason: "unregistered" | "conflict" | "inactive" };

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
    // `isActive` is deliberately NOT filtered here: a deactivated doctor whose
    // number still matches must be told their access is closed, not that their
    // number is unrecognised. Liveness is decided below so the two cases stay
    // distinguishable. Soft-deleted rows stay excluded — those are gone, not
    // suspended.
    where: { deletedAt: null, phone: { not: null } },
    select: {
      id: true,
      clinicId: true,
      phone: true,
      isActive: true,
      supabaseUserId: true,
      supabasePhoneUserId: true,
    },
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

  if (!doctor.isActive) {
    // Matched a real, provisioned number whose clinical access has been
    // withdrawn. Audited separately so "we closed this account" is never
    // reported to the doctor as "we do not know this number".
    await writeAuditLog({
      action: "DOCTOR_PHONE_LOGIN_DENIED_INACTIVE",
      entityType: "Doctor",
      entityId: doctor.id,
      actorId: input.supabaseUserId,
      actorType: "doctor",
      clinicId: doctor.clinicId,
    });
    return { ok: false, reason: "inactive" };
  }

  if (isLinkedIdentity(doctor, input.supabaseUserId)) {
    // Re-login on either linked identity. No write needed.
    return {
      ok: true,
      doctorId: doctor.id,
      clinicId: doctor.clinicId,
      alreadyLinked: true,
    };
  }

  if (doctor.supabasePhoneUserId && doctor.supabasePhoneUserId !== input.supabaseUserId) {
    // A DIFFERENT phone identity already owns this doctor. Two distinct auth
    // users both holding the same verified number means a SIM swap or a
    // provisioning error, not a second channel for one person. Fail closed.
    await writeAuditLog({
      action: "DOCTOR_PHONE_LOGIN_DENIED_CONFLICT",
      entityType: "Doctor",
      entityId: doctor.id,
      actorId: input.supabaseUserId,
      actorType: "doctor",
      clinicId: doctor.clinicId,
      metadata: { reason: "phone_identity_conflict" },
    });
    return { ok: false, reason: "conflict" };
  }

  if (doctor.supabaseUserId && doctor.supabaseUserId !== input.supabaseUserId) {
    // ── The mobile-login defect this closes ───────────────────────────────
    // Supabase mints a SEPARATE auth user per channel: the phone user carries
    // `phone` and no `email`, the email user the reverse. So a doctor who had
    // already signed in by email reached here with a genuine second uid for
    // the same person, and this branch used to refuse it outright — the OTP
    // verified, then the doctor was signed straight back out. That is exactly
    // what happened to the drfact-mumbai doctor (audit:
    // DOCTOR_PHONE_LOGIN_DENIED_CONFLICT, reason supabaseUserId_conflict).
    //
    // Attaching the phone identity alongside the existing one is safe, and is
    // NOT the loose matching this function otherwise refuses:
    //
    //   • the number matched Doctor.phone in FULL, digit for digit — never a
    //     suffix or a fuzzy compare;
    //   • Doctor.phone is Super-Admin-provisioned, so control of that exact
    //     number is the same grade of evidence as control of the provisioned
    //     email that linked `supabaseUserId` in the first place;
    //   • the column is @unique, so this identity cannot also name another
    //     Doctor row, and the clinic is whatever the matched row says — no
    //     cross-clinic reach;
    //   • the existing identity is left untouched, so email stays a working
    //     fallback.
    //
    // The guard below refuses if the incumbent already proved a phone of its
    // own, and the updateMany re-asserts both columns so a concurrent link
    // cannot be overwritten.
    const attached = await prisma.doctor.updateMany({
      where: {
        id: doctor.id,
        supabaseUserId: doctor.supabaseUserId,
        supabasePhoneUserId: null,
      },
      data: { supabasePhoneUserId: input.supabaseUserId, provisioningStatus: "ACTIVE" },
    });

    if (attached.count === 0) {
      const fresh = await prisma.doctor.findUnique({
        where: { id: doctor.id },
        select: { supabaseUserId: true, supabasePhoneUserId: true, clinicId: true },
      });
      if (fresh && isLinkedIdentity(fresh, input.supabaseUserId)) {
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
      action: "DOCTOR_PHONE_IDENTITY_ATTACHED",
      entityType: "Doctor",
      entityId: doctor.id,
      actorId: input.supabaseUserId,
      actorType: "doctor",
      clinicId: doctor.clinicId,
    });

    return { ok: true, doctorId: doctor.id, clinicId: doctor.clinicId, alreadyLinked: false };
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
      select: { supabaseUserId: true, supabasePhoneUserId: true, clinicId: true },
    });
    if (fresh && isLinkedIdentity(fresh, input.supabaseUserId)) {
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
