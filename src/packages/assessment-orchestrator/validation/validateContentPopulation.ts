/**
 * CONTENT POPULATION VALIDATION
 *
 * Ensures all artifact content is properly populated with non-placeholder,
 * clinically coherent explanations. Fails validation if:
 * - Enum-only content (bare enum names)
 * - Empty strings or null values
 * - "Pending or unavailable" placeholders
 * - Missing required explanation fields
 */

import type { ComposedNarrative } from "../../ai-engine/explanations/composers/types";

const PLACEHOLDER_PATTERNS = [
  /pending\s+or\s+unavailable/i,
  /^[A-Z_]+$/, // Bare enum (all caps with underscores only)
  /^$/, // Empty string
  /^\s*$/, // Whitespace only
  /TODO|FIXME|placeholder/i,
  /\[object object\]/i,
];

export interface ContentValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Check if text looks like a placeholder/enum
 */
function isPlaceholder(text: unknown): boolean {
  if (!text || typeof text !== "string") return true;

  const trimmed = text.trim();
  if (trimmed.length === 0) return true;

  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/**
 * Validate a composed narrative has meaningful content
 */
export function validateComposedNarrative(
  narrative: ComposedNarrative,
  section: string
): ContentValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check full text
  if (isPlaceholder(narrative.full)) {
    errors.push(`${section}.full: Placeholder or empty content`);
  }

  // Check short text
  if (isPlaceholder(narrative.short)) {
    errors.push(`${section}.short: Placeholder or empty content`);
  }

  // Check segments
  if (!narrative.segments || narrative.segments.length === 0) {
    errors.push(`${section}: No segments present`);
  } else {
    for (const segment of narrative.segments) {
      if (isPlaceholder(segment.label)) {
        errors.push(
          `${section}[${segment.label ?? "unnamed"}]: Missing or placeholder label`
        );
      }
      if (isPlaceholder(segment.text)) {
        errors.push(
          `${section}[${segment.label}]: Placeholder or empty text`
        );
      }
      // Warn if segment is suspiciously short
      if (segment.text && segment.text.length < 20) {
        warnings.push(
          `${section}[${segment.label}]: Very short content (${segment.text.length} chars)`
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate narrative payload has all required sections
 */
export function validateNarrativesPayload(
  payload: Record<string, unknown>
): ContentValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required narrative sections
  const requiredNarratives = [
    "doctor_narrative",
    "patient_narrative",
    "therapy_explanation",
    "lifestyle_plan",
    "prognosis",
  ];

  for (const narrative of requiredNarratives) {
    const content = payload[narrative];

    if (!content) {
      errors.push(`${narrative}: Missing`);
      continue;
    }

    if (typeof content === "object" && "full" in (content as Record<string, unknown>)) {
      const result = validateComposedNarrative(
        content as ComposedNarrative,
        narrative
      );
      errors.push(...result.errors);
      warnings.push(...result.warnings);
    } else if (typeof content === "string") {
      if (isPlaceholder(content)) {
        errors.push(`${narrative}: Placeholder string content`);
      }
    }
  }

  // Check for enriched content
  const enrichedTherapyNeeds = payload.enrichedTherapyNeeds;
  if (!enrichedTherapyNeeds || !Array.isArray(enrichedTherapyNeeds)) {
    warnings.push("Missing enrichedTherapyNeeds array");
  } else if (enrichedTherapyNeeds.length === 0) {
    warnings.push("enrichedTherapyNeeds is empty");
  }

  const enrichedRootCauses = payload.enrichedRootCauses;
  if (!enrichedRootCauses || !Array.isArray(enrichedRootCauses)) {
    warnings.push("Missing enrichedRootCauses array");
  } else if (enrichedRootCauses.length === 0) {
    warnings.push("enrichedRootCauses is empty");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate visual journey has content in sections
 */
export function validateVisualJourney(
  journey: Record<string, unknown>
): ContentValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!journey.sections || !Array.isArray(journey.sections)) {
    errors.push("sections: Missing or not an array");
  } else if ((journey.sections as unknown[]).length === 0) {
    warnings.push("sections: Empty array");
  } else {
    for (let i = 0; i < (journey.sections as unknown[]).length; i++) {
      const section = (journey.sections as Record<string, unknown>[])[i];
      if (typeof section === "object" && section !== null) {
        if (
          isPlaceholder(section.defaultTitle as string) ||
          isPlaceholder(section.defaultDescription as string)
        ) {
          errors.push(
            `sections[${i}]: Title or description is placeholder`
          );
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Comprehensive artifact population validation
 */
export function validateArtifactPopulation(
  artifactType: string,
  payload: unknown
): ContentValidationResult {
  if (typeof payload !== "object" || payload === null) {
    return {
      valid: false,
      errors: ["Payload is not an object"],
      warnings: [],
    };
  }

  const payloadObj = payload as Record<string, unknown>;

  switch (artifactType) {
    case "NARRATIVES":
      return validateNarrativesPayload(payloadObj);
    case "VISUAL_JOURNEY":
      return validateVisualJourney(payloadObj);
    default:
      // For other artifact types, just check non-empty
      return {
        valid: Object.keys(payloadObj).length > 0,
        errors:
          Object.keys(payloadObj).length === 0
            ? ["Empty payload object"]
            : [],
        warnings: [],
      };
  }
}

/**
 * Log validation results with context
 */
export function logValidationResult(
  result: ContentValidationResult,
  context: string
): void {
  if (result.valid) {
    console.log(`[CONTENT-VALIDATION] ${context}: PASSED`);
  } else {
    console.error(`[CONTENT-VALIDATION] ${context}: FAILED`);
    for (const error of result.errors) {
      console.error(`  ✗ ${error}`);
    }
  }

  for (const warning of result.warnings) {
    console.warn(`  ⚠ ${warning}`);
  }
}
