// Human waiting-time for queue rows: "18 minutes ago" / "2 hours ago" /
// "3 days ago". One place, one style — so every doctor surface reads the
// same and we don't drift into ad-hoc toLocaleString calls.
//
// The doctor cares about *how long a case has been waiting*, not the raw
// timestamp. Absolute timestamps live in the row detail.

export function waitingTime(
  input: Date | string | number | null | undefined,
  now: Date = new Date(),
): string {
  if (!input) return "—";
  const then = input instanceof Date ? input : new Date(input);
  if (isNaN(then.getTime())) return "—";

  const diffMs = now.getTime() - then.getTime();
  if (diffMs < 0) return "just now";
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 45) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;

  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} week${weeks === 1 ? "" : "s"} ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;

  const years = Math.floor(days / 365);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

// Compact waiting badge: "38m" / "31h" / "2d" / "4w" / "7mo".
//
// The long form above reads well in prose ("2 days ago"); it does not read
// well in a chip next to a priority label. This form is for chips only.
//
// Deliberately caps at coarse units rather than emitting large hour counts —
// "763h" is technically accurate and completely unreadable, and the old queue
// badge is exactly where that regression lived.
export function waitingShort(
  input: Date | string | number | null | undefined,
  now: Date = new Date(),
): string {
  if (!input) return "—";
  const then = input instanceof Date ? input : new Date(input);
  if (isNaN(then.getTime())) return "—";

  const diffMs = now.getTime() - then.getTime();
  if (diffMs < 0) return "now";

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h`;

  const days = Math.floor(hours / 24);
  if (days < 14) return `${days}d`;

  const weeks = Math.floor(days / 7);
  if (weeks < 10) return `${weeks}w`;

  const months = Math.floor(days / 30);
  if (months < 24) return `${months}mo`;

  return `${Math.floor(days / 365)}y`;
}

// Duration on its own, for sentences that supply their own verb:
//
//   "Ready for review · waiting 6 min"
//   "Assessment in progress · started 6 min ago"
//
// Neither of those reads well with "6m" (too terse for prose) or "6 minutes
// ago" (the sentence already says "ago"). This is the middle form: a duration,
// abbreviated, with no tense of its own.
//
// Computed in the browser from a server timestamp and re-rendered on a local
// minute tick — the number advances without asking the server what time it is.
// Coarsens deliberately as it grows: "51 hr" is accurate and unreadable, and a
// two-day wait is a scheduling fact that does not need minute precision.
export function elapsedLabel(
  input: Date | string | number | null | undefined,
  now: Date = new Date(),
): string {
  if (!input) return "—";
  const then = input instanceof Date ? input : new Date(input);
  if (isNaN(then.getTime())) return "—";

  const diffMs = now.getTime() - then.getTime();
  // A clock skewed a few seconds the wrong way must not read "-1 min".
  if (diffMs < 60_000) return "under a min";

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr`;

  const days = Math.floor(hours / 24);
  if (days < 14) return `${days} ${days === 1 ? "day" : "days"}`;

  const weeks = Math.floor(days / 7);
  if (weeks < 10) return `${weeks} ${weeks === 1 ? "week" : "weeks"}`;

  const months = Math.floor(days / 30);
  return `${months} ${months === 1 ? "month" : "months"}`;
}

// Absolute timestamp for the row detail / tooltip.
export function absoluteTimestamp(
  input: Date | string | number | null | undefined,
): string {
  if (!input) return "";
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
