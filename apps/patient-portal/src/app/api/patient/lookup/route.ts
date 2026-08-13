import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { describeSchemaDrift, isSchemaDriftError } from "@/lib/prismaErrors";
import { rateLimit } from "@/lib/rate-limit";
import { lookupIdentity, toRelationship } from "@/lib/patient/identity";
import { normaliseMobile, rejectionMessage } from "@/lib/patient/phone";
import { verifyIntakeSession } from "@/lib/patient/intakeSession";

export const dynamic = "force-dynamic";

// POST /api/patient/lookup   { token, phone }  ->  { relationship, provisional }
//
// Answers exactly one question before the assessment starts: should this visit
// be routed as NEW or RETURNING? Nothing else.
//
// ── What this endpoint refuses to return ─────────────────────────────────────
// No name. No visit dates. No assessment count. No diagnosis, doctor, kit or
// any other clinical value. Not to anonymous callers and not to authenticated
// staff either — a clinician who needs a patient's history opens the patient
// record, where the access is attributable, rather than pulling it out of an
// intake endpoint keyed on a phone number.
//
// IDENTITY_AMBIGUOUS and RETURNING_CANDIDATE both surface as RETURNING. The
// distinction is real and is recorded server-side, but telling a caller that a
// number appears on two records is itself a statement about someone's clinic
// attendance.
//
// The answer is `provisional: true` in every case. A phone number is an
// identity *signal*; historical clinical information stays sealed until the
// number is verified (OTP) or a member of the clinic reconciles the record in
// person.

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") ?? "local";

  // Layer 1 — per address. Tighter than /submit because this endpoint takes a
  // phone number as input, so it is the one an enumeration attempt reaches for.
  const perIp = rateLimit(`patient-lookup-ip:${ip}`, 10, 60_000);
  if (!perIp.ok) {
    return NextResponse.json(
      { success: false, error: "Too many lookups. Please wait a moment." },
      { status: 429 },
    );
  }

  let body: { token?: string; phone?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  // The clinic comes from the signed intake session, never from the request
  // body. A caller cannot widen the scope or point it at another clinic.
  const session = verifyIntakeSession(body.token);
  if (!session.ok) {
    return NextResponse.json(
      {
        success: false,
        error:
          session.error === "EXPIRED"
            ? "This intake session has expired. Please start again."
            : "Invalid intake session.",
      },
      { status: 401 },
    );
  }

  // Layer 2 — per issued session. One intake needs a couple of attempts at a
  // mistyped number; it never needs dozens. This is the ceiling that makes a
  // stolen token useless for sweeping a number range.
  const perSession = rateLimit(`patient-lookup-sess:${session.sessionId}`, 6, 30 * 60_000);
  if (!perSession.ok) {
    return NextResponse.json(
      { success: false, error: "Too many attempts for this session." },
      { status: 429 },
    );
  }

  const phone = normaliseMobile(body.phone);
  if (!phone.ok) {
    return NextResponse.json(
      { success: false, error: rejectionMessage(phone.reason) },
      { status: 400 },
    );
  }

  try {
    const identity = await lookupIdentity(prisma, session.clinicId, phone.e164);

    // `identity` is null only when normalisation fails, which the guard above
    // already rejected. Treat any residual null as NEW rather than leaking a
    // different response shape for it.
    return NextResponse.json({
      success: true,
      relationship: identity ? toRelationship(identity.state) : "NEW",
      // Never omitted, never false. Consumers must not be able to read the
      // absence of this flag as "verified".
      provisional: true,
    });
  } catch (err) {
    // Code deployed ahead of its migration. Answering 500 here sends the
    // patient a "check your connection" screen and sends the operator nothing
    // useful, while the cause is exactly known and exactly fixable.
    if (isSchemaDriftError(err)) {
      console.error(
        `[PATIENT LOOKUP] identity schema not migrated — missing ${describeSchemaDrift(err)}. ` +
          `Apply prisma/migrations/20260812_patient_mobile_identity before serving this route.`,
      );
      return NextResponse.json(
        {
          success: false,
          // The client keys on this to stop offering a retry that cannot work,
          // and to stop blaming the patient's network.
          code: "IDENTITY_LOOKUP_UNAVAILABLE",
          error: "Identity lookup is unavailable at this clinic right now.",
        },
        { status: 503 },
      );
    }

    console.error("[PATIENT LOOKUP]", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
