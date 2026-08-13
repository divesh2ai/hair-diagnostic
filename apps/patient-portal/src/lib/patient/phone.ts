// Patient mobile identity — normalisation and display.
//
// The mobile number is HairOS's patient identity signal: it is what lets a
// clinic recognise a returning patient instead of minting a fresh record on
// every visit. That only works if every write agrees on one canonical form, so
// this module is the single place a phone number becomes storable.
//
//   UI (India)  +91 | 98765 43210
//   Canonical   +919876543210
//
// India-first, not India-only: a number already in E.164 for another country
// is preserved rather than mangled into +91.

/** Canonical storage form: E.164, no spaces, leading '+'. */
export type E164 = string;

export type PhoneRejection =
  | "empty"
  | "too_short"
  | "too_long"
  | "not_a_mobile"
  | "malformed";

export type PhoneNormalisation =
  | { ok: true; e164: E164; national: string; countryCode: string }
  | { ok: false; reason: PhoneRejection };

const INDIA_CC = "91";
const INDIA_NSN_LENGTH = 10;
// TRAI allocates mobile series 6–9. Landlines and service codes are not
// identities we can message, so they are rejected rather than stored.
const INDIA_MOBILE_PREFIX = /^[6-9]/;

// E.164 caps the whole number at 15 digits; nothing shorter than 8 is a
// dialable subscriber number in practice.
const E164_MIN_DIGITS = 8;
const E164_MAX_DIGITS = 15;

function digitsOf(raw: string): string {
  return raw.replace(/\D/g, "");
}

/**
 * Convert any user-entered form into canonical E.164, or explain why it can't
 * be. Accepts `9876543210`, `+91 98765 43210`, `919876543210`, `09876543210`,
 * and the same with dashes, dots or brackets.
 *
 * A `+` prefix is treated as an explicit country code and honoured: `+9715…`
 * stays a UAE number. Everything else is read as Indian.
 */
export function normaliseMobile(raw: unknown): PhoneNormalisation {
  if (typeof raw !== "string") return { ok: false, reason: "empty" };

  const trimmed = raw.trim();
  if (trimmed === "") return { ok: false, reason: "empty" };

  // Reject anything containing characters that have no business in a phone
  // number — this is an identity field, not a notes field.
  if (/[^\d+\s().\-]/.test(trimmed)) return { ok: false, reason: "malformed" };

  const explicitCountryCode = trimmed.startsWith("+");
  const digits = digitsOf(trimmed);
  if (digits === "") return { ok: false, reason: "empty" };

  if (explicitCountryCode && !digits.startsWith(INDIA_CC)) {
    // Foreign number already carrying its country code. We can't validate the
    // national format for every country, so we only bound the length.
    if (digits.length < E164_MIN_DIGITS) return { ok: false, reason: "too_short" };
    if (digits.length > E164_MAX_DIGITS) return { ok: false, reason: "too_long" };
    return {
      ok: true,
      e164: `+${digits}`,
      national: digits,
      countryCode: "",
    };
  }

  // ── Indian number ───────────────────────────────────────────────────────
  // Strip, in order: the 91 country code, then a single trunk prefix 0.
  let national = digits;
  if (national.length > INDIA_NSN_LENGTH && national.startsWith(INDIA_CC)) {
    national = national.slice(INDIA_CC.length);
  }
  if (national.length > INDIA_NSN_LENGTH && national.startsWith("0")) {
    national = national.slice(1);
  }

  if (national.length < INDIA_NSN_LENGTH) return { ok: false, reason: "too_short" };
  if (national.length > INDIA_NSN_LENGTH) return { ok: false, reason: "too_long" };
  if (!INDIA_MOBILE_PREFIX.test(national)) return { ok: false, reason: "not_a_mobile" };

  return {
    ok: true,
    e164: `+${INDIA_CC}${national}`,
    national,
    countryCode: INDIA_CC,
  };
}

/**
 * Canonical form or null. Use at every write site; never store a raw string in
 * a column another query will compare against.
 */
export function toE164(raw: unknown): E164 | null {
  const result = normaliseMobile(raw);
  return result.ok ? result.e164 : null;
}

/** Human-readable message for a rejected number. Patient-facing copy. */
export function rejectionMessage(reason: PhoneRejection): string {
  switch (reason) {
    case "empty":
      return "Enter a mobile number.";
    case "too_short":
      return "That number is too short — enter all 10 digits.";
    case "too_long":
      return "That number has too many digits.";
    case "not_a_mobile":
      return "Enter a mobile number starting with 6, 7, 8 or 9.";
    case "malformed":
      return "Use digits only.";
  }
}

/** `+919876543210` → `+91 98765 43210`. Falls back to the input unchanged. */
export function formatForDisplay(e164: string | null | undefined): string {
  if (!e164) return "";
  if (!e164.startsWith(`+${INDIA_CC}`)) return e164;
  const national = e164.slice(1 + INDIA_CC.length);
  if (national.length !== INDIA_NSN_LENGTH) return e164;
  return `+${INDIA_CC} ${national.slice(0, 5)} ${national.slice(5)}`;
}

/**
 * `+919876543210` → `••••• 43210`. For surfaces that must confirm *which*
 * number matched without reprinting it — reception screens, shared tablets.
 */
export function maskForDisplay(e164: string | null | undefined): string {
  if (!e164) return "";
  const digits = digitsOf(e164);
  if (digits.length < 4) return "•••••";
  return `••••• ${digits.slice(-5)}`;
}
