import type { NarrativePipelineInput, NarrativePipelineOutput } from './types';
import { validateNarrativeContext } from './validators/validateNarrativeContext';
import { validatePDFPayload } from './validators/validatePDFPayload';
import { validateAvatarScript } from './validators/validateAvatarScript';
import { buildDoctorReport } from './buildDoctorReport';
import { buildPatientReport } from './buildPatientReport';
import { buildPDFPayload } from './buildPDFPayload';
import { build3DAvatarScript } from './build3DAvatarScript';
import { buildDoctorDashboardCard } from './buildDoctorDashboardCard';
import { buildWhatsAppSummary } from './buildWhatsAppSummary';
import { buildMetadata } from './utils';

// ─── Narrative Pipeline ───────────────────────────────────────────────────────

export function narrativePipeline(input: NarrativePipelineInput): NarrativePipelineOutput {
  // Step 1: Validate context
  const validation = validateNarrativeContext(input);
  if (!validation.valid) {
    throw new NarrativePipelineError(
      `Narrative pipeline input validation failed:\n${validation.errors.join('\n')}`,
      'VALIDATION_FAILED',
      validation.errors
    );
  }
  if (validation.warnings.length > 0) {
    // Warnings are non-fatal; emit to console for observability
    validation.warnings.forEach(w => console.warn(`[NarrativePipeline] Warning: ${w}`));
  }

  const length = input.narrativeLength ?? 'medium';

  // Step 2: Build doctor report
  const doctorReport = buildDoctorReport(input);

  // Step 3: Build patient report
  const patientReport = buildPatientReport(input);

  // Step 4: Build PDF payload
  const pdfPayload = buildPDFPayload(input, doctorReport, patientReport);
  const pdfValidation = validatePDFPayload(pdfPayload);
  if (!pdfValidation.valid) {
    throw new NarrativePipelineError(
      `PDF payload validation failed:\n${pdfValidation.errors.join('\n')}`,
      'PDF_VALIDATION_FAILED',
      pdfValidation.errors
    );
  }

  // Step 5: Build dashboard card
  const dashboardCard = buildDoctorDashboardCard(input);

  // Step 6: (Optional) Build avatar script
  let avatarScript: NarrativePipelineOutput['avatarScript'];
  if (input.includeAvatarScript) {
    avatarScript = build3DAvatarScript(input);
    const avatarValidation = validateAvatarScript(avatarScript);
    if (!avatarValidation.valid) {
      throw new NarrativePipelineError(
        `Avatar script validation failed:\n${avatarValidation.errors.join('\n')}`,
        'AVATAR_VALIDATION_FAILED',
        avatarValidation.errors
      );
    }
  }

  // Step 7: (Optional) Build WhatsApp summary
  let whatsappSummary: NarrativePipelineOutput['whatsappSummary'];
  if (input.includeWhatsAppSummary) {
    whatsappSummary = buildWhatsAppSummary(input);
  }

  // Build top-level metadata
  const metadata = {
    ...buildMetadata(input.clinicalProfile, input.kitRecommendation.rankedKits.length, length),
    therapyNeedCount: input.therapyPlan.needs.length,
  };

  return {
    doctorReport,
    patientReport,
    pdfPayload,
    avatarScript,
    dashboardCard,
    whatsappSummary,
    metadata,
  };
}

// ─── Error Type ───────────────────────────────────────────────────────────────

export class NarrativePipelineError extends Error {
  readonly code: string;
  readonly validationErrors: readonly string[];

  constructor(message: string, code: string, validationErrors: readonly string[] = []) {
    super(message);
    this.name = 'NarrativePipelineError';
    this.code = code;
    this.validationErrors = validationErrors;
  }
}
