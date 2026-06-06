import type { ReportValidationResult, ReportSection } from "../types";

const REQUIRED_SECTIONS = [
  { sectionId: "cover", label: "Cover", minLength: 1 },
  { sectionId: "clinical_summary", label: "Clinical Summary", minLength: 50 },
  { sectionId: "recommendations", label: "Recommendations", minLength: 30 },
  { sectionId: "timeline", label: "Recovery Timeline", minLength: 20 },
];

export function validatePdfStructure(payload: Record<string, unknown>): ReportValidationResult {
  const sections: ReportSection[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const req of REQUIRED_SECTIONS) {
    const content = String(payload[req.sectionId] ?? payload[req.label] ?? "");
    const present = content.length > 0;
    const actualLength = content.length;
    const ok = present && actualLength >= (req.minLength ?? 0);

    sections.push({
      sectionId: req.sectionId,
      label: req.label,
      present,
      minLength: req.minLength,
      actualLength,
    });

    if (!ok) {
      errors.push(`PDF section "${req.label}" missing or too short (${actualLength}/${req.minLength})`);
    }
  }

  if (!payload.patient && !payload.patientName) {
    warnings.push("Patient identity block not found in PDF payload");
  }

  return {
    passed: errors.length === 0,
    sections,
    errors,
    warnings,
  };
}
