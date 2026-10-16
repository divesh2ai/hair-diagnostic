// Dashboard hero greeting name for a clinician.
//
// ── The P0 this fixes ───────────────────────────────────────────────────────────────
// The dashboard hero renders `${name}.` (CommandBand appends the full stop).
// The name used to be built by a local helper that stripped only a leading
// "Dr" and then prefixed "Dr " to the first remaining token. A clinician
// stored as "Mrs. Meha Mhatre" therefore kept "Mrs." as her "first name" and
// rendered as "Dr Mrs.." — an unstripped title and a doubled stop at once.
//
// This recognises the common leading honorifics and addresses the clinician by
// first name. It returns the hero name WITHOUT the trailing stop, because
// CommandBand still owns that.

// Leading honorifics we recognise, with or without a trailing period, matched
// case-insensitively. The trailing word boundary (whitespace or end) is what
// keeps a real name such as "Drew" from being read as the title "Dr". Longer
// forms precede shorter ones so "mrs"/"miss" win over "mr"/"ms".
const LEADING_TITLE = /^\s*(dr|mrs|mr|miss|ms)\.?(?:\s+|$)/i;

/**
 * The clinician's dashboard greeting name.
 *
 *   "Dr Avinash Agarwal"  -> "Dr Avinash"   (an existing "Dr" title kept verbatim)
 *   "Mrs. Meha Mhatre"    -> "Dr. Meha"     (a non-"Dr" title is normalised)
 *   "Meha Mhatre"         -> "Dr. Meha"     (no title -> addressed as Dr.)
 *   null / "" / "Dr."     -> "Doctor"       (nothing usable)
 *
 * Returned WITHOUT a trailing full stop — CommandBand renders `${name}.`.
 */
export function doctorHeroName(name: string | null | undefined): string {
  if (!name) return "Doctor";
  const trimmed = name.trim();
  if (!trimmed) return "Doctor";

  const titleMatch = trimmed.match(LEADING_TITLE);
  const hasDrTitle = titleMatch ? titleMatch[1].toLowerCase() === "dr" : false;
  const remainder = titleMatch ? trimmed.slice(titleMatch[0].length) : trimmed;

  const firstName = remainder.split(/\s+/)[0]?.trim();
  if (!firstName) return "Doctor";

  // Preserve an already-"Dr" clinician's greeting exactly as stored (e.g.
  // "Dr Avinash"); otherwise address the clinician in the clinical form.
  if (hasDrTitle) {
    const storedTitle = titleMatch![0].trim(); // "Dr" or "Dr."
    return `${storedTitle} ${firstName}`;
  }
  return `Dr. ${firstName}`;
}
