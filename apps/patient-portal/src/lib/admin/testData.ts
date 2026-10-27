// Test / demo clinic classification for the Super Admin command centre.
//
// ── Why this exists ──────────────────────────────────────────────────────────
// Staging carries two kinds of record that must never be weighed as if they
// were the same thing: real clinics being rolled out, and the QA / demo rows
// used to exercise the product. Mixed together they corrupt every "how is the
// business doing?" number — a demo clinic with 62 synthetic patients makes the
// network look busier and more verified than it is.
//
// ── The one rule that keeps this honest ──────────────────────────────────────
// A record is only ever marked TEST on an EXPLICIT marker — a whole token
// ("test", "qa", "demo", …) in its slug or name, or a seeded test id. Nothing
// is inferred from how a name "feels". When the only signal is weaker than that
// — e.g. a first-party brand prefix with no test token — the verdict is
// UNCERTAIN, never TEST and never REAL: those rows are surfaced for a human to
// decide, not quietly swept into either bucket. This is the guardrail the task
// states directly: "Do not guess from names alone when records are ambiguous."
//
// Pure module: no imports, no I/O. The caller supplies already-loaded fields.

export type ClinicDataClass = "real" | "test" | "uncertain";

/**
 * Whole-word tokens that mark a record as test/demo beyond doubt. Matched
 * against TOKENS (slug split on `-`, name split on non-alphanumerics), never as
 * substrings — so "latest" or "Contest Clinic" is not swept up by "test".
 */
export const TEST_TOKENS: readonly string[] = [
  "test",
  "tests",
  "qa",
  "demo",
  "sandbox",
  "sample",
  "dummy",
  "fixture",
  "example",
  "staging",
  "seed",
];

/**
 * First-party brand tokens. A clinic whose slug/name is the vendor's own brand
 * (rather than a third-party practice) is very likely an internal demo, but the
 * brand alone is not proof — DrFACT could legitimately run a real flagship. So
 * a brand match with no test token yields UNCERTAIN, for human review.
 */
export const INTERNAL_BRAND_TOKENS: readonly string[] = ["drfact", "hairos"];

/**
 * Id prefixes handed out by the seed / QA provisioning scripts. An id is a
 * stronger, non-cosmetic signal than a name: these are literally how the
 * staging QA rows are created.
 */
const TEST_ID_PREFIXES: readonly string[] = [
  "staging-qa-",
  "test-",
  "demo-",
  "seed-",
  "qa-",
];

export type ClinicClassificationInput = {
  id: string;
  name: string;
  slug: string;
};

export type ClinicClassification = {
  dataClass: ClinicDataClass;
  /** The literal evidence behind the verdict, so it can be argued with. */
  signals: string[];
};

/** Lower-cased whole tokens from a slug (`a-b-c`) and a name (`A B & C`). */
function tokensOf(slug: string, name: string): Set<string> {
  const out = new Set<string>();
  for (const part of slug.toLowerCase().split(/[^a-z0-9]+/)) {
    if (part) out.add(part);
  }
  for (const part of name.toLowerCase().split(/[^a-z0-9]+/)) {
    if (part) out.add(part);
  }
  return out;
}

/**
 * Classify one clinic as real / test / uncertain from explicit markers only.
 *
 * Precedence: an explicit TEST marker always wins (id prefix or a test token).
 * Failing that, a first-party brand token with no test marker is UNCERTAIN.
 * Everything else is REAL — a third-party practice name is not evidence of a
 * demo, and treating it as one would hide real rollout from the dashboard.
 */
export function classifyClinicDataClass(
  input: ClinicClassificationInput,
): ClinicClassification {
  const signals: string[] = [];
  const id = input.id.toLowerCase();
  const tokens = tokensOf(input.slug, input.name);

  const idPrefix = TEST_ID_PREFIXES.find((p) => id.startsWith(p));
  if (idPrefix) signals.push(`id prefix "${idPrefix}"`);

  const testToken = TEST_TOKENS.filter((t) => tokens.has(t));
  for (const t of testToken) signals.push(`token "${t}"`);

  if (idPrefix || testToken.length > 0) {
    return { dataClass: "test", signals };
  }

  const brand = INTERNAL_BRAND_TOKENS.filter((b) => tokens.has(b));
  if (brand.length > 0) {
    return {
      dataClass: "uncertain",
      signals: brand.map((b) => `first-party brand "${b}" (no test marker)`),
    };
  }

  return { dataClass: "real", signals: [] };
}

/** Is this a record we exclude from real-business metrics by default? */
export function isConfirmedTest(input: ClinicClassificationInput): boolean {
  return classifyClinicDataClass(input).dataClass === "test";
}

export type DataClassTotals = {
  real: number;
  test: number;
  uncertain: number;
};

/** Roll a list of clinics up into per-class counts. */
export function tallyDataClasses(
  clinics: ClinicClassificationInput[],
): DataClassTotals {
  const totals: DataClassTotals = { real: 0, test: 0, uncertain: 0 };
  for (const c of clinics) totals[classifyClinicDataClass(c).dataClass] += 1;
  return totals;
}
