import { PrismaClient, ArtifactType, Prisma } from "@prisma/client";
import { validateArtifactPayload } from "../validation/validateArtifact";
import { validateArtifactPopulation, logValidationResult } from "../validation/validateContentPopulation";

/**
 * GATE #2: Narrative Persistence Integrity
 * Guarantees narrative generation actually reaches the database.
 * Validates → persists → verifies → marks complete.
 * Hard failures on any step. No silent catches.
 */

/**
 * Persist an artifact with full validation and integrity verification.
 * @throws On empty/invalid payload, on DB write failure, on verification failure
 */
export async function persistArtifact(
  prisma: PrismaClient,
  assessmentId: string,
  type: ArtifactType,
  content: unknown,
  generationMs?: number
): Promise<{
  id: string;
  assessmentId: string;
  type: ArtifactType;
  content: unknown;
}> {
  // ── Step 1: Validate payload before touching DB ────────────────────────────
  validateArtifactPayload(type, content);

  // ── Step 2: Persist to database ────────────────────────────────────────────
  let saved;
  try {
    saved = await prisma.aIArtifact.upsert({
      where: { assessmentId_type: { assessmentId, type } },
      create: {
        assessmentId,
        type,
        content: content as Prisma.InputJsonValue,
        generationMs: generationMs ?? null,
      },
      update: {
        content: content as Prisma.InputJsonValue,
        generationMs: generationMs ?? null,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `[PersistenceError] Failed to persist ${type} for ${assessmentId}: ${message}`
    );
  }

  // ── Step 3: Verify persistence succeeded ────────────────────────────────────
  if (!saved?.id) {
    throw new Error(
      `[PersistenceError] ${type} persistence verification failed — returned record has no id`
    );
  }

  if (saved.type !== type) {
    throw new Error(
      `[PersistenceError] ${type} persistence type mismatch — saved as ${saved.type}`
    );
  }

  // ── Step 4: Verify payload shape after save ────────────────────────────────
  if (!saved.content) {
    throw new Error(
      `[PersistenceError] ${type} persisted but content is empty`
    );
  }

  // ── Step 5: Return verified record ────────────────────────────────────────────
  return {
    id: saved.id,
    assessmentId: saved.assessmentId,
    type: saved.type,
    content: saved.content,
  };
}

/**
 * Specialized narrative persistence with mandatory content verification.
 * Used by narrative generation stage to guarantee delivery.
 */
export async function persistNarrativeArtifact(
  prisma: PrismaClient,
  assessmentId: string,
  narrativesPayload: Record<string, unknown>,
  generationMs?: number
): Promise<void> {
  // ── Validate complete narratives payload ────────────────────────────────────
  if (!narrativesPayload.doctor_narrative && !narrativesPayload.patient_narrative) {
    throw new Error(
      "[NarrativePersistenceError] Missing both doctor_narrative and patient_narrative"
    );
  }

  // ── Verify narrative content exists and is non-empty ────────────────────────
  const docNarrative = narrativesPayload.doctor_narrative;
  const patNarrative = narrativesPayload.patient_narrative;

  // ComposedNarrative shape: { full, short, segments, length, target, locale, generatedAt }
  // Legacy artifact shape (still supported for backward compat): { summary | narrative | body }
  if (docNarrative && typeof docNarrative === "object") {
    const doc = docNarrative as Record<string, unknown>;
    const content =
      doc.full ||
      doc.short ||
      doc.summary ||
      doc.narrative ||
      doc.body ||
      (Array.isArray(doc.segments) && doc.segments.length > 0 ? "segments" : undefined);
    if (!content || (typeof content === "string" && content.trim().length === 0)) {
      throw new Error(
        "[NarrativePersistenceError] doctor_narrative has empty/missing content"
      );
    }
  }

  if (patNarrative && typeof patNarrative === "object") {
    const pat = patNarrative as Record<string, unknown>;
    const content =
      pat.full ||
      pat.short ||
      pat.summary ||
      pat.narrative ||
      pat.body ||
      (Array.isArray(pat.segments) && pat.segments.length > 0 ? "segments" : undefined);
    if (!content || (typeof content === "string" && content.trim().length === 0)) {
      throw new Error(
        "[NarrativePersistenceError] patient_narrative has empty/missing content"
      );
    }
  }

  // ── Persist with full verification ──────────────────────────────────────────
  const saved = await persistArtifact(
    prisma,
    assessmentId,
    "NARRATIVES",
    narrativesPayload,
    generationMs
  );

  // ── Post-save verification: re-check narrative structure ────────────────────
  if (!saved.content || typeof saved.content !== "object") {
    throw new Error(
      "[NarrativePersistenceError] Saved content is not an object"
    );
  }

  const savedContent = saved.content as Record<string, unknown>;
  if (!savedContent.doctor_narrative && !savedContent.patient_narrative) {
    throw new Error(
      "[NarrativePersistenceError] Saved artifact missing narratives"
    );
  }

  // ── Content population validation: Ensure no enum-only/placeholder content ──
  const populationValidation = validateArtifactPopulation("NARRATIVES", savedContent);
  logValidationResult(populationValidation, `Narratives content population [${assessmentId}]`);

  if (!populationValidation.valid) {
    const errors = populationValidation.errors.join("; ");
    throw new Error(
      `[NarrativePersistenceError] Content population validation failed: ${errors}`
    );
  }

  // ✓ Narrative persistence verified and complete with content validation
}
