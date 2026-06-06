import type { AssessmentArtifact } from "@shared/types/assessment";

export function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function safeObject<T extends Record<string, unknown> = Record<string, unknown>>(
  value: unknown
): T {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as T)
    : ({} as T);
}

export function normalizeArtifacts(
  artifacts:
    | Record<string, AssessmentArtifact>
    | AssessmentArtifact[]
    | null
    | undefined
): AssessmentArtifact[] {
  if (Array.isArray(artifacts)) return artifacts;
  if (artifacts && typeof artifacts === "object") {
    return Object.values(artifacts).filter(isAssessmentArtifact);
  }
  return [];
}

export function safeArtifactLookup(
  artifacts:
    | Record<string, AssessmentArtifact>
    | AssessmentArtifact[]
    | null
    | undefined,
  type: string
): AssessmentArtifact | null {
  return normalizeArtifacts(artifacts).find((artifact) => artifact.type === type) ?? null;
}

export function artifactMapByType(artifacts: AssessmentArtifact[]): Record<string, AssessmentArtifact> {
  return Object.fromEntries(artifacts.map((artifact) => [artifact.type, artifact]));
}

function isAssessmentArtifact(value: unknown): value is AssessmentArtifact {
  const candidate = safeObject(value);
  return typeof candidate.id === "string" && typeof candidate.type === "string";
}
