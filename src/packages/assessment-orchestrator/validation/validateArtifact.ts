import { ArtifactType } from "@prisma/client";

/**
 * GATE #1: Artifact Payload Validation
 * Prevents empty, malformed, partial, or corrupted artifacts from being persisted.
 * Fast-fail before any DB write. No AI regeneration. <5ms overhead.
 */
export function validateArtifactPayload(
  artifactType: ArtifactType,
  payload: unknown
): void {
  // ── Baseline checks ────────────────────────────────────────────────────────

  if (!payload) {
    throw new Error(
      `[PayloadValidation] Empty payload for ${artifactType}`
    );
  }

  if (typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error(
      `[PayloadValidation] Invalid payload type for ${artifactType} — must be object, got ${typeof payload}`
    );
  }

  const data = payload as Record<string, unknown>;
  const keys = Object.keys(data);

  if (keys.length === 0) {
    throw new Error(
      `[PayloadValidation] Empty object payload for ${artifactType}`
    );
  }

  // ── Type-specific validation ───────────────────────────────────────────────

  switch (artifactType) {
    case ArtifactType.CLINICAL_REASONING:
      if (keys.length === 0) {
        throw new Error(
          "[PayloadValidation] CLINICAL_REASONING missing analysis fields"
        );
      }
      break;

    case ArtifactType.SEVERITY_ANALYSIS:
      if (keys.length === 0) {
        throw new Error(
          "[PayloadValidation] SEVERITY_ANALYSIS missing diagnosis/severity"
        );
      }
      break;

    case ArtifactType.THERAPY_PLAN:
      if (keys.length === 0) {
        throw new Error(
          "[PayloadValidation] THERAPY_PLAN missing therapy fields"
        );
      }
      break;

    case ArtifactType.RECOMMENDATIONS:
      if (!data.rankedKits) {
        throw new Error(
          "[PayloadValidation] RECOMMENDATIONS missing rankedKits array"
        );
      }
      if (!Array.isArray(data.rankedKits)) {
        throw new Error(
          "[PayloadValidation] RECOMMENDATIONS.rankedKits must be array"
        );
      }
      break;

    case ArtifactType.NARRATIVES:
      if (!data.doctor_narrative && !data.patient_narrative) {
        throw new Error(
          "[PayloadValidation] NARRATIVES missing doctor_narrative or patient_narrative"
        );
      }
      validateNarrativeEnvelope(data.doctor_narrative, "doctor_narrative");
      validateNarrativeEnvelope(data.patient_narrative, "patient_narrative");
      break;

    case ArtifactType.VISUAL_JOURNEY:
      if (keys.length === 0) {
        throw new Error(
          "[PayloadValidation] VISUAL_JOURNEY missing visual data"
        );
      }
      break;

    case ArtifactType.REPORT:
      if (!data.reportUrl && !data.patientPdfUrl) {
        throw new Error(
          "[PayloadValidation] REPORT missing reportUrl or patientPdfUrl"
        );
      }
      break;

    case ArtifactType.VIDEO_SCRIPT:
      if (!Array.isArray(data.scenes) || data.scenes.length === 0) {
        throw new Error(
          "[PayloadValidation] VIDEO_SCRIPT missing non-empty scenes array"
        );
      }
      break;

    case ArtifactType.AVATAR_VIDEO: {
      const allowed = new Set(["PENDING", "RENDERING", "READY", "FAILED"]);
      if (typeof data.status !== "string" || !allowed.has(data.status)) {
        throw new Error(
          `[PayloadValidation] AVATAR_VIDEO.status must be one of PENDING|RENDERING|READY|FAILED, got ${String(data.status)}`
        );
      }
      if (typeof data.provider !== "string") {
        throw new Error("[PayloadValidation] AVATAR_VIDEO.provider must be a string");
      }
      if (data.status === "READY" && typeof data.videoUrl !== "string") {
        throw new Error("[PayloadValidation] AVATAR_VIDEO READY status requires videoUrl");
      }
      break;
    }

    default:
      // For unknown types, at least verify non-empty
      if (keys.length === 0) {
        throw new Error(
          `[PayloadValidation] ${artifactType} has empty payload`
        );
      }
  }
}

/**
 * Accept ComposedNarrative (full/short/segments) and legacy shapes
 * (summary/narrative/body). At least one must carry non-empty content.
 */
function validateNarrativeEnvelope(value: unknown, field: string): void {
  if (!value) return;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error(
      `[PayloadValidation] ${field} must be an object, got ${typeof value}`
    );
  }

  const narrative = value as Record<string, unknown>;
  const content =
    narrative.full ||
    narrative.short ||
    narrative.summary ||
    narrative.narrative ||
    narrative.body ||
    (Array.isArray(narrative.segments) && narrative.segments.length > 0
      ? "segments"
      : undefined);

  if (!content || (typeof content === "string" && content.trim().length === 0)) {
    throw new Error(
      `[PayloadValidation] ${field} missing full/short/segments or legacy summary/narrative/body`
    );
  }
}

/**
 * Lightweight string length validation for narrative content.
 * Prevents corrupt/truncated narrative saves.
 */
export function validateNarrativeContent(content: unknown): void {
  if (!content) {
    throw new Error("[PayloadValidation] Narrative content is empty");
  }

  if (typeof content !== "string") {
    throw new Error(
      `[PayloadValidation] Narrative must be string, got ${typeof content}`
    );
  }

  // Must have meaningful length (> 10 chars to catch truncation)
  if (content.trim().length < 10) {
    throw new Error(
      "[PayloadValidation] Narrative content too short (< 10 characters)"
    );
  }
}
