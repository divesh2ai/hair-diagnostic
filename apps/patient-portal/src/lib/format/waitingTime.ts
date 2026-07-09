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
