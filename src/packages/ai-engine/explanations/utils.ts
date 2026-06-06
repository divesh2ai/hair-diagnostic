import type {
  ExplanationEntry,
  ExplanationSeverity,
  FallbackExplanation,
  RankedExplanation,
} from './types';

// ─── Severity ordering (higher index = higher priority) ───────────────────────

const SEVERITY_ORDER: Record<ExplanationSeverity, number> = {
  low: 1,
  moderate: 2,
  high: 3,
};

// ─── Fallback handler ─────────────────────────────────────────────────────────

/**
 * Returns a typed fallback when a dictionary key has no registered entry.
 * Always marks isFallback: true so callers can detect and log missing entries.
 */
export function getFallback(key: string): FallbackExplanation {
  return {
    clinical: `No clinical explanation registered for: ${key}`,
    patient: 'Details for this item are not yet available.',
    severity: 'low',
    category: 'unknown',
    isFallback: true,
  };
}

// ─── Dictionary lookup with fallback ─────────────────────────────────────────

/**
 * Safely looks up a key in any dictionary record.
 * Returns the registered entry or a typed fallback — never throws.
 */
export function lookupOrFallback<K extends string>(
  dict: Partial<Record<K, ExplanationEntry>>,
  key: K
): ExplanationEntry | FallbackExplanation {
  return dict[key] ?? getFallback(key);
}

// ─── Audience-specific text extraction ───────────────────────────────────────

/** Extracts the correct text field for a given audience from an ExplanationEntry. */
export function getAudienceText(
  entry: ExplanationEntry,
  audience: 'clinical' | 'patient'
): string {
  return audience === 'clinical' ? entry.clinical : entry.patient;
}

// ─── Bullet generation ────────────────────────────────────────────────────────

/**
 * Converts a list of ExplanationEntry objects to bullet strings for a given audience.
 * Deduplicates automatically.
 */
export function composeBullets(
  entries: ReadonlyArray<ExplanationEntry>,
  audience: 'clinical' | 'patient'
): string[] {
  const bullets = entries.map((e) => getAudienceText(e, audience));
  return deduplicateBullets(bullets);
}

// ─── Deduplication ────────────────────────────────────────────────────────────

/**
 * Removes exact-duplicate strings from a bullet list while preserving order.
 * Case-insensitive: 'Foo' and 'foo' are treated as duplicates (first wins).
 */
export function deduplicateBullets(bullets: string[]): string[] {
  const seen = new Set<string>();
  return bullets.filter((b) => {
    const key = b.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Deduplicates a flat string array preserving insertion order.
 * Used for rule lists, category lists, etc.
 */
export function deduplicateStrings(items: string[]): string[] {
  return [...new Set(items)];
}

// ─── Priority sorting ─────────────────────────────────────────────────────────

/**
 * Sorts ExplanationEntry objects by severity descending (high → moderate → low).
 * Stable sort: entries with equal severity retain their original relative order.
 */
export function sortBySeverityDesc(
  entries: ReadonlyArray<ExplanationEntry>
): ExplanationEntry[] {
  return [...entries].sort((a, b) => {
    const sa = SEVERITY_ORDER[a.severity ?? 'low'];
    const sb = SEVERITY_ORDER[b.severity ?? 'low'];
    return sb - sa;
  });
}

/**
 * Sorts RankedExplanation objects by priority descending.
 */
export function sortByPriorityDesc(
  ranked: ReadonlyArray<RankedExplanation>
): RankedExplanation[] {
  return [...ranked].sort((a, b) => b.priority - a.priority);
}

// ─── Severity mapping helpers ─────────────────────────────────────────────────

/** Maps an ExplanationSeverity to a numeric weight for scoring/prioritisation. */
export function severityWeight(severity: ExplanationSeverity | undefined): number {
  return SEVERITY_ORDER[severity ?? 'low'];
}

/**
 * Given a list of ExplanationEntry objects, returns the highest severity
 * present across the set. Returns 'low' if the list is empty.
 */
export function maxSeverity(
  entries: ReadonlyArray<ExplanationEntry>
): ExplanationSeverity {
  if (entries.length === 0) return 'low';
  return entries.reduce<ExplanationSeverity>((max, e) => {
    const w = SEVERITY_ORDER[e.severity ?? 'low'];
    return w > SEVERITY_ORDER[max] ? (e.severity ?? 'low') : max;
  }, 'low');
}

// ─── Category grouping ────────────────────────────────────────────────────────

/**
 * Groups ExplanationEntry objects by their category field.
 * Entries without a category are grouped under 'uncategorised'.
 */
export function groupByCategory(
  entries: ReadonlyArray<ExplanationEntry>
): Record<string, ExplanationEntry[]> {
  return entries.reduce<Record<string, ExplanationEntry[]>>((acc, e) => {
    const cat = e.category ?? 'uncategorised';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(e);
    return acc;
  }, {});
}

// ─── Sentence capitalisation ──────────────────────────────────────────────────

/** Capitalises the first letter of a string. Used when assembling dynamic sentences. */
export function capitalise(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/** Ensures a string ends with a full stop. Used for consistent bullet formatting. */
export function ensureFullStop(str: string): string {
  const trimmed = str.trimEnd();
  return trimmed.endsWith('.') || trimmed.endsWith('?') || trimmed.endsWith('!')
    ? trimmed
    : `${trimmed}.`;
}

/** Combines capitalise + ensureFullStop for consistent bullet formatting. */
export function formatBullet(str: string): string {
  return ensureFullStop(capitalise(str.trim()));
}

// ─── Safe key normalisation ───────────────────────────────────────────────────

/**
 * Normalises a raw key string to match dictionary key conventions.
 * Trims whitespace only — does not transform case or replace characters,
 * since KitId strings like 'HAIR FACT TE GOLD' must remain exact.
 */
export function normaliseKey(key: string): string {
  return key.trim();
}
