import { createHash } from "node:crypto";

// Deterministic SHA-256 over a normalized JSON form. Keys are sorted at every
// object level so reordered properties don't produce different hashes. Used by
// the orchestrator to skip duplicate versions when the recomposed Consultation
// is byte-identical to the current one.
export function contentHash(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return "[" + value.map(stableStringify).join(",") + "]";
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return (
    "{" +
    keys
      .map((k) => JSON.stringify(k) + ":" + stableStringify(obj[k]))
      .join(",") +
    "}"
  );
}
