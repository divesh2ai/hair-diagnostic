/**
 * Conference / pilot mode.
 *
 * A doctor trying the product at a conference completes an assessment as a
 * patient would and then wants to see both reports immediately. They have no
 * clinic login, and no doctor is standing by to approve the consultation.
 *
 * When this flag is ON, a signed review token (the same HMAC token the
 * patient's own preview page already carries — see `lib/reviewToken`) is
 * accepted as proof of access to the ONE-PAGE PATIENT REPORT. The token is
 * bound to a single assessmentId and expires, so it grants access to that one
 * assessment and nothing else.
 *
 * When it is OFF — the default, and the state of every normal clinic
 * deployment — the report keeps its existing authorisation exactly: a clinic
 * session cookie scoped to the assessment's clinic, or a Super Admin. Nothing
 * about the production workflow is relaxed by shipping this code; the
 * behaviour only changes where CONFERENCE_MODE is explicitly set.
 *
 * Server-side only. Deliberately not NEXT_PUBLIC_* — the client never needs
 * to know, and exposing it would advertise the relaxed path.
 *
 * The detailed clinical report (`/api/assessment/pdf`) already accepts the
 * same token and already carries a testing-phase approval relaxation, so it
 * needs no flag of its own.
 */
export function isConferenceMode(): boolean {
  return process.env.CONFERENCE_MODE === "1";
}
