import React from 'react';
import { renderToStream } from '@react-pdf/renderer';
import { PatientReportTemplate } from './templates/PatientReportTemplate';
import { uploadReportToSupabase } from './storage';
import { ReportInputPayload } from './types';
import { formatViolations } from '../ai-engine/clinical-facts';
import type { GroundingViolation } from '../ai-engine/clinical-facts';
import { formatReasoningGaps } from '../ai-engine/clinical-context';
import type { ReasoningGap } from '../ai-engine/clinical-context';

/**
 * Thrown when the PDF engine is asked to render a report whose narrative
 * contains symptom claims the patient did not actually report (Rule 10).
 *
 * The violation list is structured so the caller can decide whether to
 * surface them in the doctor dashboard, log to telemetry, or fail loudly.
 * Caller MUST NOT silently swallow this error in production paths — the
 * whole point of the validator is to keep ungrounded prose out of the PDF.
 */
export class EvidenceGroundingError extends Error {
  readonly violations: readonly GroundingViolation[];
  constructor(violations: readonly GroundingViolation[]) {
    super(
      `PDF generation blocked: ${violations.length} evidence-grounding ` +
        `violation${violations.length === 1 ? '' : 's'}. The narrative ` +
        `claims symptoms the patient did not report.\n` +
        formatViolations({ valid: false, violations }),
    );
    this.name = 'EvidenceGroundingError';
    this.violations = violations;
  }
}

/**
 * Thrown when the PDF engine is asked to render a report whose recommendations
 * are not fully explained — e.g. a selected kit not named in the narrative,
 * or a detected condition that drove the protocol but is never discussed.
 * Same shape as EvidenceGroundingError; bypassable only by internal QA flags.
 */
export class ReasoningCompletenessError extends Error {
  readonly gaps: readonly ReasoningGap[];
  constructor(gaps: readonly ReasoningGap[]) {
    super(
      `PDF generation blocked: ${gaps.length} reasoning-completeness gap` +
        `${gaps.length === 1 ? '' : 's'}. The report does not explain ` +
        `every recommendation back to the patient's assessment.\n` +
        formatReasoningGaps({ valid: false, gaps }),
    );
    this.name = 'ReasoningCompletenessError';
    this.gaps = gaps;
  }
}

/**
 * Converts a patient name into a safe, lowercase filename slug.
 * e.g. "Rohini Sharma"  → "rohini-sharma"
 *      "Séraphin O'Neil" → "seraphin-oneil"
 */
function toFilenameSlug(name: string): string {
  return name
    .normalize('NFD')                   // decompose accented characters
    .replace(/[̀-ͯ]/g, '')    // strip accent marks
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')       // non-alphanumeric → hyphen
    .replace(/^-+|-+$/g, '');          // trim leading/trailing hyphens
}

/**
 * Main orchestrator for the PDF Generation Engine.
 * Converts React PDF Components into Buffers, uploads them, and returns URLs.
 */
export async function generateAndStoreReports(payload: ReportInputPayload) {
  // ── Rule 10 gate ──────────────────────────────────────────────────────────
  // Refuse to render if the narrative carries unreported-symptom claims.
  // bypassGroundingViolations exists only for QA / replay / debugging — never
  // production. We still log the violations in that case so they're visible.
  const violations = payload.groundingViolations ?? [];
  if (violations.length > 0) {
    if (payload.bypassGroundingViolations) {
      console.warn(
        `[PDF Engine] bypassGroundingViolations=true — rendering despite ` +
          `${violations.length} violation(s):\n` +
          formatViolations({ valid: false, violations }),
      );
    } else {
      throw new EvidenceGroundingError(violations);
    }
  }

  // ── Reasoning-completeness gate (self-reflection pass) ────────────────────
  const gaps = payload.reasoningGaps ?? [];
  if (gaps.length > 0) {
    if (payload.bypassReasoningGaps) {
      console.warn(
        `[PDF Engine] bypassReasoningGaps=true — rendering despite ` +
          `${gaps.length} gap(s):\n` +
          formatReasoningGaps({ valid: false, gaps }),
      );
    } else {
      throw new ReasoningCompletenessError(gaps);
    }
  }

  console.log(`[PDF Engine] Generating reports for Assessment ${payload.assessmentId}...`);

  // Derive a patient-specific filename, e.g. "rohini-report.pdf"
  const patientSlug = toFilenameSlug(payload.patient.name) || 'patient';
  const patientFilename = `${patientSlug}-report.pdf`;

  try {
    // 1. Render Patient Report to a Stream
    // We must use 'any' casting here because `@react-pdf/renderer` typings for Node environments
    // can be tricky regarding JSX.Element vs ReactElement in monorepos.
    console.log(`[PDF Engine] Rendering PDF for patient: ${payload.patient.name}`);
    console.log(`[PDF Engine] clinicalProfile keys: ${Object.keys(payload.clinicalProfile ?? {}).join(', ') || '(empty)'}`);
    console.log(`[PDF Engine] kitRecommendation present: ${!!payload.kitRecommendation}, adjunctProtocol present: ${!!(payload.kitRecommendation as any)?.adjunctProtocol}`);
    console.log(`[PDF Engine] visualJourney sections: ${Array.isArray((payload.visualJourney as any)?.sections) ? (payload.visualJourney as any).sections.length : '(none)'}`);

    const patientReportStream = await renderToStream(
      React.createElement(PatientReportTemplate, { payload }) as any
    );
    console.log(`[PDF Engine] Render stream created — converting to buffer`);

    // 2. Convert Stream to Buffer
    const patientBuffer = await streamToBuffer(patientReportStream);
    console.log(`[PDF Engine] Buffer size: ${patientBuffer.length} bytes`);

    // 3. Upload to Secure Storage
    const patientPdfUrl = await uploadReportToSupabase(
      patientBuffer,
      payload.assessmentId,
      patientFilename
    );
    console.log(`[PDF Engine] Patient Report stored at: ${patientPdfUrl}`);

    // (Doctor report would be generated here similarly)

    return {
      patientPdfUrl,
      // doctorPdfUrl: '...'
    };
  } catch (error) {
    const msg = error instanceof Error ? `${error.message}\n${error.stack}` : String(error);
    console.error(`[PDF Engine] CRASH — patient: ${payload.patient.name}, assessmentId: ${payload.assessmentId}`);
    console.error(`[PDF Engine] Error detail: ${msg}`);
    throw error;
  }
}

// Utility to convert a NodeJS stream to a Buffer
function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', chunk => chunks.push(Buffer.from(chunk)));
    stream.on('error', err => reject(err));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}
