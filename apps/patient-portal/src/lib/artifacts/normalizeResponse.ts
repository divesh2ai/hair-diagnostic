import type { AssessmentArtifact } from "@shared/types/assessment";

/**
 * GATE #3: Hydration Shape Verification
 * Ensures artifacts ALWAYS hydrate as canonical ARRAY format.
 * Fixes the known issue: data?.artifacts?.find is not a function
 */

export interface ArtifactRecord {
  artifactType: string;
  payload: unknown;
  id?: string;
  createdAt?: string;
  generationMs?: number | null;
  schemaVersion?: string | null;
  engineVersion?: string | null;
}

/**
 * Normalize artifacts response to canonical ARRAY format.
 * Input: object map OR array → Output: always array
 *
 * If backend returns:
 * { clinical_profile: {...}, severity_analysis: {...} }
 *
 * Normalize into:
 * [
 *   { artifactType: "clinical_profile", payload: {...}, ... },
 *   { artifactType: "severity_analysis", payload: {...}, ... }
 * ]
 */
export function normalizeArtifactsResponse(
  artifacts: unknown
): ArtifactRecord[] {
  // Already array: pass through as-is
  if (Array.isArray(artifacts)) {
    return artifacts.map(normalizeArtifactRecord);
  }

  // Object map: convert to array
  if (artifacts && typeof artifacts === "object" && !Array.isArray(artifacts)) {
    const map = artifacts as Record<string, unknown>;
    return Object.entries(map).map(([artifactType, record]) => {
      const normalized = normalizeArtifactRecord(record);
      // Use object key as artifactType if not present
      if (!normalized.artifactType) {
        normalized.artifactType = artifactType;
      }
      return normalized;
    });
  }

  // Null, undefined, or invalid: return empty array
  return [];
}

/**
 * Normalize a single artifact record to canonical shape.
 */
function normalizeArtifactRecord(record: unknown): ArtifactRecord {
  if (!record || typeof record !== "object") {
    return { artifactType: "UNKNOWN", payload: null };
  }

  const obj = record as Record<string, unknown>;

  return {
    artifactType: String(obj.type ?? obj.artifactType ?? "UNKNOWN"),
    payload: obj.content ?? obj.payload ?? null,
    id: typeof obj.id === "string" ? obj.id : undefined,
    createdAt:
      typeof obj.createdAt === "string" ? obj.createdAt : undefined,
    generationMs:
      typeof obj.generationMs === "number" ? obj.generationMs : null,
    schemaVersion:
      typeof obj.schemaVersion === "string" ? obj.schemaVersion : undefined,
    engineVersion:
      typeof obj.engineVersion === "string" ? obj.engineVersion : undefined,
  };
}

/**
 * Runtime verification: ensure artifacts are in correct shape BEFORE rendering.
 * Throws if normalization produces invalid state.
 */
export function verifyArtifactShape(artifacts: unknown): ArtifactRecord[] {
  const normalized = normalizeArtifactsResponse(artifacts);

  if (!Array.isArray(normalized)) {
    throw new Error(
      "[HydrationError] Artifact normalization produced non-array result"
    );
  }

  // Verify each artifact has required fields
  for (const artifact of normalized) {
    if (!artifact.artifactType || typeof artifact.artifactType !== "string") {
      throw new Error(
        "[HydrationError] Artifact missing or invalid artifactType"
      );
    }
  }

  return normalized;
}

/**
 * Find artifact by type in normalized array.
 * Safe version of array.find() that guarantees array format.
 */
export function findArtifactByType(
  artifacts: ArtifactRecord[],
  type: string
): ArtifactRecord | null {
  if (!Array.isArray(artifacts)) {
    throw new Error(
      "[HydrationError] artifacts is not an array — cannot call .find()"
    );
  }

  return (
    artifacts.find((a) => a.artifactType === type || a.artifactType === type.toUpperCase()) ??
    null
  );
}

/**
 * Map artifacts by type into Record<type, artifact> for convenient access.
 * Used after normalization to support artifactByType patterns.
 */
export function mapArtifactsByType(
  artifacts: ArtifactRecord[]
): Record<string, ArtifactRecord> {
  if (!Array.isArray(artifacts)) {
    throw new Error(
      "[HydrationError] Cannot map non-array artifacts by type"
    );
  }

  return Object.fromEntries(
    artifacts.map((a) => [a.artifactType, a])
  );
}
