// Turning an OTP failure into something true.
//
// Every phone-OTP failure used to surface as the raw Supabase message, or as
// a flat "Could not verify code" — so "your code expired", "you asked for too
// many codes", "SMS is not configured on this project" and "your account is
// not linked" all read to the doctor as "you typed it wrong". They then retype
// a code that can never work.
//
// Supabase does not expose stable machine codes for all of these on the client,
// so classification is by the shapes GoTrue actually returns. Matching is
// deliberately broad-to-narrow and falls back to `unknown` rather than guessing.

export type OtpFailure =
  | "invalid"
  | "expired"
  | "rate_limited"
  | "provider_unavailable"
  | "send_failed"
  | "unknown";

/** Refusals that come from HairOS AFTER Supabase verified the code. */
export type DoctorLinkFailure =
  | "unregistered"
  | "inactive"
  | "conflict"
  | "link_failed";

/**
 * Classify a Supabase auth error raised while SENDING or VERIFYING an OTP.
 *
 * `phase` matters: an unrecognised failure while sending is a send failure,
 * while verifying it is a verification failure. Reporting a send outage as a
 * bad code is exactly the confusion this function exists to stop.
 */
export function classifyOtpError(
  message: string | null | undefined,
  phase: "send" | "verify",
): OtpFailure {
  const m = (message ?? "").toLowerCase();
  if (!m) return phase === "send" ? "send_failed" : "unknown";

  // Provider/config gaps first — these are never the doctor's fault, and their
  // wording often also contains "phone"/"otp", so they must not fall through
  // to the invalid-code branch.
  // "Signups not allowed for otp" is GoTrue's wording when the project refuses
  // to create the user — a project-configuration state, not a typo in the code,
  // so it belongs here rather than in the invalid-code branch below.
  if (
    /provider|not.*(support|enabl|configur|allow)|signups?\s+not|disabled|unsupported|sms.*(provider|config)/.test(m)
  ) {
    return "provider_unavailable";
  }

  if (/rate|too many|limit|exceed/.test(m)) return "rate_limited";
  if (/expired|has expired|timeout/.test(m)) return "expired";
  if (/invalid|incorrect|wrong|mismatch|token.*not.*found/.test(m)) return "invalid";

  return phase === "send" ? "send_failed" : "unknown";
}

/** Doctor-facing copy. Never leaks a provider's own wording. */
export function otpFailureMessage(failure: OtpFailure): string {
  switch (failure) {
    case "invalid":
      return "That code is not correct. Check the 6 digits and try again.";
    case "expired":
      return "That code has expired. Tap Resend to get a new one.";
    case "rate_limited":
      return "Too many attempts. Wait a minute before requesting another code.";
    case "provider_unavailable":
      return "Mobile sign-in isn't available right now. Use email, or contact FACT Support.";
    case "send_failed":
      return "We couldn't send the code. Check the number and try again.";
    case "unknown":
      return "We couldn't verify that code. Try again, or contact FACT Support.";
  }
}

/**
 * Doctor-facing copy for a code that VERIFIED but whose account cannot enter
 * the workspace. Distinct from every OTP message above: the code was right.
 */
export function doctorLinkFailureMessage(failure: DoctorLinkFailure): string {
  switch (failure) {
    case "unregistered":
      return "This mobile number is not registered for FACT Doctor access. Please contact FACT Support.";
    case "inactive":
      return "This doctor account is no longer active. Please contact FACT Support.";
    case "conflict":
      return "This mobile number is already linked to another FACT account. Please contact FACT Support.";
    case "link_failed":
      return "We verified your number but could not open your account. Please contact FACT Support.";
  }
}

/** Map the link route's JSON `reason` onto a known failure. */
export function toDoctorLinkFailure(reason: unknown): DoctorLinkFailure {
  return reason === "unregistered" || reason === "inactive" || reason === "conflict"
    ? reason
    : "link_failed";
}
