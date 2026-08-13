import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { describeSchemaDrift, isSchemaDriftError } from "@/lib/prismaErrors";
import { rateLimit } from "@/lib/rate-limit";
import { verifyIntakeSession } from "@/lib/patient/intakeSession";

export const dynamic = "force-dynamic";

// POST /api/patient/intake/visit   { token, displayName }  ->  { ok }
//
// Opens the in-clinic visit: "a named patient is filling in the assessment
// right now". Called once, when the intake gate completes — never on QR scan,
// which is why a raw scan does not appear on the Doctor Dashboard.
//
// ── What this endpoint does NOT do ───────────────────────────────────────────
// It creates no Patient and no Assessment. Assessment means submitted, and
// Patient means a person this clinic has a record for; both are written at
// submission, by the identity resolution that runs there. This writes one row
// on a table that holds a name and a start time.
//
// The clinic comes from the signed token, never the body — same rule as
// /api/patient/lookup, for the same reason.
//
// ── Failure is not the patient's problem ─────────────────────────────────────
// Every error path still answers 200 with `{ ok: false }`. The patient is
// standing in a clinic about to answer twenty questions; blocking them because
// a waiting-room list could not be updated would trade a real clinical
// submission for a cosmetic one. The caller ignores the body entirely.

// The name a patient typed at intake. The gate has already validated and
// trimmed it; this is a defensive ceiling, not a second validator.
const MAX_DISPLAY_NAME = 80;

function ok(value: boolean) {
  return NextResponse.json({ ok: value });
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") ?? "local";

  // Generous for a shared clinic tablet behind one address; still a ceiling.
  const perIp = rateLimit(`intake-visit-ip:${ip}`, 60, 60 * 60_000);
  if (!perIp.ok) return ok(false);

  let body: { token?: string; displayName?: string };
  try {
    body = await req.json();
  } catch {
    return ok(false);
  }

  // Expiry IS enforced here: opening a visit is a write triggered by a patient
  // who is present now. The relaxed, link-only read
  // (readIntakeSessionForLinking) exists for submission, where the session may
  // legitimately have aged out mid-assessment.
  const session = verifyIntakeSession(body.token);
  if (!session.ok) return ok(false);

  const displayName = (body.displayName ?? "").trim().replace(/\s+/g, " ");
  if (!displayName) return ok(false);

  try {
    // Upsert on the session, not create. A patient who goes back and corrects
    // their name, or a client that retries a timed-out request, must update
    // the one visit they have — two rows would show the same person twice in
    // the waiting room.
    await prisma.clinicVisit.upsert({
      where: { intakeSessionId: session.sessionId },
      create: {
        clinicId: session.clinicId,
        intakeSessionId: session.sessionId,
        displayName: displayName.slice(0, MAX_DISPLAY_NAME),
      },
      // startedAt is untouched on update: the patient has been in the clinic
      // since the first attempt, and refreshing it would reset a waiting time
      // the doctor is reading.
      update: { displayName: displayName.slice(0, MAX_DISPLAY_NAME) },
    });
    return ok(true);
  } catch (err) {
    if (isSchemaDriftError(err)) {
      console.error(
        `[INTAKE VISIT] ClinicVisit schema not migrated — missing ${describeSchemaDrift(err)}. ` +
          `Apply prisma/migrations/20260813_clinic_visit. The assessment flow is unaffected; ` +
          `the Doctor Dashboard simply shows no in-clinic patients.`,
      );
      return ok(false);
    }
    console.error("[INTAKE VISIT]", err);
    return ok(false);
  }
}
