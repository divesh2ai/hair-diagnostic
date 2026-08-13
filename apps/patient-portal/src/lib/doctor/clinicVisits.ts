// In-clinic visits, as the Doctor Dashboard sees them.
//
// One rule governs this module: an open ClinicVisit is an operational fact
// with a short shelf life. A patient who started an assessment and never
// finished is not "still in the clinic" three days later, and rendering them
// that way would make the In Clinic list untrustworthy — which is worse than
// not having it, because a doctor who learns to ignore a panel has lost the
// panel.
//
// So the dashboard shows visits inside a clinic session and simply stops
// showing the rest. Nothing deletes them, nothing marks them abandoned, and no
// worker sweeps them up. Purging genuinely dead rows is P2; a stale row that
// nobody renders costs a few bytes and tells the truth about what happened.

/**
 * How far back an open visit still counts as "in the clinic".
 *
 * A hair assessment takes minutes. An hour covers a patient who is
 * interrupted, sent for a photo, or leaves the tablet while they take a call;
 * past that, someone who has not submitted has almost certainly left, and
 * showing them keeps a name in the waiting room that reception cannot find.
 *
 * A display window, not a timeout — nothing expires and no row is touched. The
 * dashboard simply stops asking, so the cost of this being slightly too short
 * is a patient who reappears in the Review Queue when they submit, which is
 * the correct place for them anyway.
 */
export const CLINIC_SESSION_WINDOW_MS = 60 * 60 * 1000;

/** The cutoff for the dashboard's open-visit query. */
export function clinicSessionCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - CLINIC_SESSION_WINDOW_MS);
}

/** A row of the In Clinic list, as it crosses the API boundary. */
export interface InClinicVisit {
  id: string;
  displayName: string;
  /** ISO. The browser renders the relative "started 3 min ago" text. */
  startedAt: string;
}
