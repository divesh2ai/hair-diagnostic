export interface ArtifactIntegrityResult {
  passed: boolean;
  missingTypes: string[];
  errors: string[];
}

const REQUIRED_ARTIFACT_TYPES = [
  "CLINICAL_REASONING",
  "SEVERITY_ANALYSIS",
  "THERAPY_PLAN",
  "RECOMMENDATIONS",
];

export function validateArtifactIntegrity(
  artifactTypes: string[]
): ArtifactIntegrityResult {
  const missingTypes = REQUIRED_ARTIFACT_TYPES.filter((t) => !artifactTypes.includes(t));
  const errors = missingTypes.map((t) => `Missing required artifact: ${t}`);

  return {
    passed: missingTypes.length === 0,
    missingTypes,
    errors,
  };
}
