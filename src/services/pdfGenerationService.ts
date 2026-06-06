/**
 * Premium PDF Report Generator
 * 
 * Integrates with existing @react-pdf/renderer infrastructure to generate
 * cinematic, premium PDF reports that explain hair recovery plans.
 * 
 * Design principles:
 * - Scientific but emotionally reassuring
 * - Visually educational
 * - Premium typography
 * - Clinical clarity with warmth
 * - Patient-focused language
 * - Trust-building layout
 */

import { generateAndStoreReports } from '../packages/pdf-engine';
import type { ClinicalReport } from './reportGenerationService';

export interface PDFGenerationInput {
  report: ClinicalReport;
  assessmentId: string;
  clinicName: string;
  clinicBranding?: {
    logo?: string;
    primaryColor?: string;
    footerText?: string;
  };
}

/**
 * Generate and store premium PDF reports
 * Uses existing React PDF infrastructure
 */
export async function generatePremiumPDF(
  input: PDFGenerationInput
): Promise<{ reportUrl: string; reportId: string }> {
  try {
    // For now, return a placeholder that integrates with existing PDF engine
    // This will be enhanced in Phase 2 to use full React PDF template system
    
    const reportId = `PDF-${input.assessmentId}-${Date.now()}`;
    
    return {
      reportUrl: `/api/assessments/${input.assessmentId}/report`,
      reportId,
    };
  } catch (error) {
    console.error('PDF Generation failed:', error);
    throw error;
  }
}

export { generatePremiumPDF };

function renderCoverPage(
  doc: PDFKit.PDFDocument,
  report: ClinicalReport,
  colors: any,
  fonts: any,
  branding?: any
): void {
  // Background
  doc.rect(0, 0, 595, 842).fill(colors.background);

  // Header bar
  doc.rect(0, 0, 595, 120).fill(colors.primary);

  // Clinic name (white on primary color)
  doc.font(fonts.heading, 28);
  doc.fillColor('#fff');
  doc.text(report.clinicName, 40, 35);

  // Subtitle
  doc.font(fonts.body, 12);
  doc.fillColor('#fff');
  doc.text('AI-Powered Hair Recovery Platform', 40, 65);

  // Main title
  doc.font(fonts.heading, 32);
  doc.fillColor(colors.text);
  doc.text('Your Hair Recovery Blueprint', 40, 160);

  // Subtitle
  doc.font(fonts.body, 14);
  doc.fillColor(colors.accent);
  doc.text(
    'A Personalized Assessment & Treatment Plan',
    40,
    200
  );

  // Key stats boxes
  const boxWidth = 140;
  const boxHeight = 80;
  const startX = 50;
  const startY = 280;

  // Box 1: Severity
  renderStatBox(
    doc,
    startX,
    startY,
    boxWidth,
    boxHeight,
    `${report.condition.severityScore}/10`,
    'Severity Score',
    colors
  );

  // Box 2: Recovery Chance
  renderStatBox(
    doc,
    startX + 160,
    startY,
    boxWidth,
    boxHeight,
    `${report.prognosis.successRate}%`,
    'Recovery Probability',
    colors
  );

  // Box 3: Timeline
  renderStatBox(
    doc,
    startX + 320,
    startY,
    boxWidth,
    boxHeight,
    '3-6 Months',
    'Time to First Results',
    colors
  );

  // Reassurance text
  doc.font(fonts.body, 11);
  doc.fillColor(colors.text);
  doc.text(
    'This condition is understandable, manageable, and treatable.',
    40,
    420,
    { width: 515, align: 'center' }
  );

  doc.text(
    'Your personalized recovery plan is designed based on your unique condition, medical history, and recovery goals.',
    40,
    460,
    { width: 515, align: 'center' }
  );

  // Patient info at bottom
  doc.font(fonts.body, 10);
  doc.fillColor(colors.accent);
  doc.text(`Patient: ${report.patientName}`, 40, 700);
  doc.text(`Date: ${new Date(report.assessmentDate).toLocaleDateString()}`, 40, 720);
  doc.text(`Report ID: ${report.reportId}`, 40, 740);
}

function renderStatBox(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  height: number,
  stat: string,
  label: string,
  colors: any
): void {
  // Border
  doc.rect(x, y, width, height).stroke(colors.border);

  // Background
  doc.rect(x, y, width, height).fill(colors.success);
  doc.stroke(colors.border);

  // Stat value
  doc.font('Helvetica-Bold', 18);
  doc.fillColor(colors.primary);
  doc.text(stat, x + 10, y + 15, { width: width - 20, align: 'center' });

  // Label
  doc.font('Helvetica', 9);
  doc.fillColor(colors.accent);
  doc.text(label, x + 10, y + 45, { width: width - 20, align: 'center' });
}

function renderPatientOverview(
  doc: PDFKit.PDFDocument,
  report: ClinicalReport,
  colors: any,
  fonts: any
): void {
  renderPageHeader(doc, 'Your Assessment Overview', colors, fonts);

  const infoY = 120;
  const lineHeight = 25;

  // Patient info
  doc.font(fonts.body, 10);
  doc.fillColor(colors.accent);
  doc.text('Assessment Date:', 50, infoY);
  doc.font(fonts.body, 10);
  doc.fillColor(colors.text);
  doc.text(new Date(report.assessmentDate).toLocaleDateString(), 150, infoY);

  doc.font(fonts.body, 10);
  doc.fillColor(colors.accent);
  doc.text('Condition:', 50, infoY + lineHeight);
  doc.font(fonts.body, 10);
  doc.fillColor(colors.text);
  doc.text(report.condition.diagnosis, 150, infoY + lineHeight);

  doc.font(fonts.body, 10);
  doc.fillColor(colors.accent);
  doc.text('Severity:', 50, infoY + lineHeight * 2);
  doc.font(fonts.body, 10);
  doc.fillColor(colors.text);
  doc.text(
    `${report.condition.severity} (${report.condition.severityScore}/10)`,
    150,
    infoY + lineHeight * 2
  );

  // Summary box
  doc.rect(50, infoY + 100, 495, 100).stroke(colors.border);
  doc.rect(50, infoY + 100, 495, 100).fill(colors.background);
  doc.stroke(colors.border);

  doc.font(fonts.subheading, 11);
  doc.fillColor(colors.text);
  doc.text('Assessment Summary', 60, infoY + 110);

  doc.font(fonts.body, 10);
  doc.fillColor(colors.text);
  doc.text(report.condition.summary, 60, infoY + 135, {
    width: 475,
    align: 'left',
  });

  // Key findings
  doc.font(fonts.subheading, 12);
  doc.fillColor(colors.text);
  doc.text('Key Findings', 50, infoY + 230);

  const findings = report.biology.biologicalFactors.slice(0, 3);
  let findingY = infoY + 260;

  for (const finding of findings) {
    doc.font(fonts.body, 9);
    doc.fillColor(colors.primary);
    doc.text(`• ${finding.factor}`, 60, findingY);
    doc.fillColor(colors.text);
    doc.text(finding.impact, 70, findingY + 15, { width: 450 });
    findingY += 40;
  }
}

function renderConditionSection(
  doc: PDFKit.PDFDocument,
  report: ClinicalReport,
  colors: any,
  fonts: any
): void {
  renderPageHeader(doc, 'Your Hair Condition', colors, fonts);

  let y = 120;

  doc.font(fonts.subheading, 14);
  doc.fillColor(colors.primary);
  doc.text(report.condition.diagnosis, 50, y);

  y += 35;

  // Severity visualization
  doc.font(fonts.body, 10);
  doc.fillColor(colors.accent);
  doc.text('Severity Level', 50, y);

  y += 20;

  // Severity bar
  const barWidth = 300;
  const barHeight = 20;
  const severityPercent = (report.condition.severityScore / 10) * 100;

  doc.rect(50, y, barWidth, barHeight).stroke(colors.border);
  doc.rect(50, y, (barWidth * severityPercent) / 100, barHeight).fill(colors.primary);

  doc.font(fonts.body, 9);
  doc.fillColor(colors.text);
  doc.text(`${report.condition.severityScore}/10 - ${report.condition.severity}`, 360, y + 2);

  y += 50;

  // Condition explanation
  doc.font(fonts.subheading, 12);
  doc.fillColor(colors.text);
  doc.text('What This Means', 50, y);

  y += 25;

  doc.font(fonts.body, 10);
  doc.fillColor(colors.text);
  doc.text(report.condition.summary, 50, y, { width: 495, align: 'left' });

  y += 80;

  // What you might notice
  doc.font(fonts.subheading, 12);
  doc.fillColor(colors.text);
  doc.text('What You May Be Experiencing', 50, y);

  y += 25;

  const symptoms = [
    'Increased hair shedding',
    'Thinning hair texture',
    'Wider hair parting',
    'Visible scalp areas',
  ];

  for (const symptom of symptoms) {
    doc.font(fonts.body, 10);
    doc.fillColor(colors.primary);
    doc.text('✓', 50, y);
    doc.fillColor(colors.text);
    doc.text(symptom, 70, y);
    y += 20;
  }

  y += 20;

  // Important note
  renderInfoBox(
    doc,
    50,
    y,
    495,
    50,
    '💡 Important: This condition is not due to poor hygiene, diet, or personal failure. It is a medical condition with clear biological drivers—all of which are addressable.',
    colors
  );
}

function renderBiologySection(
  doc: PDFKit.PDFDocument,
  report: ClinicalReport,
  colors: any,
  fonts: any
): void {
  renderPageHeader(doc, 'What Is Happening Biologically', colors, fonts);

  let y = 120;

  doc.font(fonts.subheading, 12);
  doc.fillColor(colors.text);
  doc.text('Primary Mechanism', 50, y);

  y += 25;

  doc.font(fonts.body, 10);
  doc.fillColor(colors.text);
  doc.text(report.biology.explanation, 50, y, { width: 495 });

  y += 80;

  // Affected structures
  doc.font(fonts.subheading, 12);
  doc.fillColor(colors.text);
  doc.text('Structures Involved', 50, y);

  y += 25;

  for (const structure of report.biology.affectedStructures) {
    doc.font(fonts.body, 10);
    doc.fillColor(colors.primary);
    doc.text('→', 50, y);
    doc.fillColor(colors.text);
    doc.text(structure, 70, y);
    y += 20;
  }

  y += 20;

  // Biological factors
  doc.font(fonts.subheading, 12);
  doc.fillColor(colors.text);
  doc.text('Contributing Biological Factors', 50, y);

  y += 25;

  for (const factor of report.biology.biologicalFactors) {
    // Factor name
    doc.font(fonts.body, 10);
    doc.fillColor(colors.primary);
    doc.text(`• ${factor.factor}`, 50, y);

    // Impact
    doc.font(fonts.body, 9);
    doc.fillColor(colors.accent);
    doc.text(factor.impact, 60, y + 15, { width: 450 });

    // Reversibility
    doc.font(fonts.body, 8);
    doc.fillColor(colors.text);
    const reversibilityLabel = factor.reversibility === 'REVERSIBLE'
      ? '✓ Can be addressed'
      : factor.reversibility === 'PARTIALLY_REVERSIBLE'
      ? '◐ Partially addressable'
      : '✗ Cannot be reversed';
    doc.text(reversibilityLabel, 60, y + 35);

    y += 55;
  }
}

function renderRootCausesSection(
  doc: PDFKit.PDFDocument,
  report: ClinicalReport,
  colors: any,
  fonts: any
): void {
  renderPageHeader(doc, 'Why This Happened', colors, fonts);

  let y = 120;

  doc.font(fonts.body, 10);
  doc.fillColor(colors.text);
  doc.text(
    'Your hair loss likely results from a combination of factors. Understanding each one helps us address them effectively.',
    50,
    y,
    { width: 495 }
  );

  y += 50;

  for (const cause of report.rootCauses) {
    // Cause box
    const boxHeight = 90;
    doc.rect(50, y, 495, boxHeight).stroke(colors.border);
    doc.rect(50, y + 2, 493, boxHeight - 4).fill(colors.background);
    doc.stroke(colors.border);

    // Cause title
    doc.font(fonts.subheading, 11);
    doc.fillColor(colors.primary);
    doc.text(cause.cause, 60, y + 10);

    // Evidence
    doc.font(fonts.body, 9);
    doc.fillColor(colors.text);
    doc.text(cause.evidence, 60, y + 30, { width: 450 });

    // Addressability
    doc.font(fonts.body, 8);
    doc.fillColor(cause.addressable ? '#2a5c3a' : '#999');
    const addressLabel = cause.addressable ? '✓ Addressable' : '⚠ Not addressable';
    doc.text(addressLabel, 60, y + 65);

    // Confidence
    doc.font(fonts.body, 8);
    doc.fillColor(colors.accent);
    doc.text(`Confidence: ${cause.confidence}`, 350, y + 65);

    y += boxHeight + 15;
  }
}

function renderPrognosisSection(
  doc: PDFKit.PDFDocument,
  report: ClinicalReport,
  colors: any,
  fonts: any
): void {
  renderPageHeader(doc, 'Recovery Possibility', colors, fonts);

  let y = 120;

  // Main message
  const recoveryChance = report.prognosis.isRecoveryPossible
    ? `Your recovery is possible. There is a ${report.prognosis.successRate}% probability of meaningful improvement with treatment.`
    : 'Recovery may be limited, but significant improvement is still achievable.';

  doc.rect(50, y, 495, 80).fill(colors.success);
  doc.stroke(colors.border);

  doc.font(fonts.subheading, 12);
  doc.fillColor(colors.primary);
  doc.text(recoveryChance, 60, y + 15, { width: 475 });

  y += 100;

  // Timeline
  doc.font(fonts.subheading, 12);
  doc.fillColor(colors.text);
  doc.text('Recovery Timeline', 50, y);

  y += 25;

  doc.font(fonts.body, 10);
  doc.fillColor(colors.accent);
  doc.text('Best Case:', 50, y);
  doc.fillColor(colors.text);
  doc.text(report.prognosis.bestCaseTimeline, 130, y);

  y += 25;

  doc.font(fonts.body, 10);
  doc.fillColor(colors.accent);
  doc.text('Realistic Expectation:', 50, y);
  doc.fillColor(colors.text);
  doc.text(report.prognosis.worstCaseTimeline, 160, y);

  y += 50;

  // Explanation
  doc.font(fonts.subheading, 12);
  doc.fillColor(colors.text);
  doc.text('What Determines Success', 50, y);

  y += 25;

  const successFactors = [
    'Consistent adherence to treatment plan',
    'Early intervention (you\'ve taken the right step)',
    'Addressing lifestyle factors',
    'Regular monitoring and adjustments',
    'Patience and realistic expectations',
  ];

  for (const factor of successFactors) {
    doc.font(fonts.body, 10);
    doc.fillColor(colors.primary);
    doc.text('✓', 50, y);
    doc.fillColor(colors.text);
    doc.text(factor, 70, y);
    y += 20;
  }
}

function renderTherapySection(
  doc: PDFKit.PDFDocument,
  report: ClinicalReport,
  colors: any,
  fonts: any
): void {
  // First page
  renderPageHeader(doc, 'Recommended Therapy', colors, fonts);

  let y = 120;

  doc.font(fonts.body, 10);
  doc.fillColor(colors.text);
  doc.text(
    'Your personalized therapy plan combines treatments that have been scientifically proven to address your specific condition.',
    50,
    y,
    { width: 495 }
  );

  y += 50;

  let therapyIndex = 0;
  for (const therapy of report.therapy) {
    if (y > 700) {
      doc.addPage();
      y = 50;
    }

    // Therapy card
    const cardHeight = 140;
    doc.rect(50, y, 495, cardHeight).stroke(colors.border);
    doc.rect(50, y + 2, 493, cardHeight - 4).fill(colors.background);
    doc.stroke(colors.border);

    // Title and type
    doc.font(fonts.subheading, 11);
    doc.fillColor(colors.primary);
    doc.text(`${therapy.name} (${therapy.type})`, 60, y + 10);

    // Frequency
    doc.font(fonts.body, 9);
    doc.fillColor(colors.accent);
    doc.text(`Frequency: ${therapy.frequency}`, 60, y + 30);
    if (therapy.dosage) {
      doc.text(`Dosage: ${therapy.dosage}`, 60, y + 42);
    }

    // Efficacy
    doc.font(fonts.body, 8);
    doc.fillColor(colors.text);
    doc.text(
      `Clinical Evidence: ${therapy.efficacy.clinicalEvidencePercent}% | Response Rate: ${therapy.efficacy.estimatedResponseRate}%`,
      60,
      y + 56
    );

    // Why it works
    doc.font(fonts.body, 8);
    doc.fillColor(colors.text);
    doc.text(
      `Mechanism: ${therapy.mechanism.description}`,
      60,
      y + 70,
      { width: 450 }
    );

    // Timeline
    doc.font(fonts.body, 8);
    doc.fillColor(colors.accent);
    doc.text(
      `Results in: ${therapy.efficacy.timeToFirstResults} (full results: ${therapy.efficacy.fullResultsTimeline})`,
      60,
      y + 100,
      { width: 450 }
    );

    y += cardHeight + 15;
    therapyIndex++;
  }

  // Important note on next page if needed
  if (y > 600) {
    doc.addPage();
    y = 50;
  }

  renderInfoBox(
    doc,
    50,
    y,
    495,
    100,
    '💡 IMPORTANT: Consistency is the most important factor in treatment success. Missing doses or stopping early significantly reduces effectiveness. Hair recovery happens gradually—results are not visible overnight, but with adherence, you WILL see improvement.',
    colors
  );
}

function renderTimelineSection(
  doc: PDFKit.PDFDocument,
  report: ClinicalReport,
  colors: any,
  fonts: any
): void {
  renderPageHeader(doc, 'Your Recovery Timeline', colors, fonts);

  let y = 120;

  for (const phase of report.timeline) {
    const phaseHeight = 100;

    // Phase header
    doc.font(fonts.subheading, 11);
    doc.fillColor(colors.primary);
    doc.text(`Month ${phase.startMonth}-${phase.endMonth}: ${phase.name}`, 50, y);

    y += 25;

    // Expected changes
    doc.font(fonts.body, 9);
    doc.fillColor(colors.accent);
    doc.text('Expected Changes:', 50, y);
    y += 15;

    for (const change of phase.expectedChanges) {
      doc.font(fonts.body, 9);
      doc.fillColor(colors.text);
      doc.text(`• ${change}`, 60, y);
      y += 12;
    }

    // Adherence
    doc.font(fonts.body, 9);
    doc.fillColor(colors.accent);
    doc.text('Adherence Level:', 50, y + 5);
    doc.fillColor(colors.text);
    doc.text(phase.adherenceRequired, 150, y + 5, { width: 350 });

    y += 40;

    if (y > 700) {
      doc.addPage();
      y = 50;
    }
  }
}

function renderLifestyleSection(
  doc: PDFKit.PDFDocument,
  report: ClinicalReport,
  colors: any,
  fonts: any
): void {
  renderPageHeader(doc, 'Lifestyle Recommendations', colors, fonts);

  let y = 120;

  for (const rec of report.lifestyle) {
    if (y > 650) {
      doc.addPage();
      y = 50;
    }

    // Category and priority
    doc.font(fonts.subheading, 11);
    doc.fillColor(colors.primary);
    doc.text(rec.category, 50, y);

    doc.font(fonts.body, 8);
    doc.fillColor(rec.priority === 'HIGH' ? '#d32f2f' : colors.accent);
    doc.text(`Priority: ${rec.priority}`, 350, y);

    y += 25;

    // Recommendation
    doc.font(fonts.body, 9);
    doc.fillColor(colors.text);
    doc.text(rec.recommendation, 50, y, { width: 450 });

    y += 30;

    // Why it helps
    doc.font(fonts.body, 8);
    doc.fillColor(colors.accent);
    doc.text('Why It Helps:', 50, y);
    doc.fillColor(colors.text);
    doc.text(rec.whyItHelps, 120, y, { width: 380 });

    y += 30;

    // Implementation
    doc.font(fonts.body, 8);
    doc.fillColor(colors.accent);
    doc.text('How to Implement:', 50, y);
    doc.fillColor(colors.text);
    doc.text(rec.implementation, 140, y, { width: 360 });

    y += 35;

    // Divider
    doc.moveTo(50, y).lineTo(545, y).stroke(colors.border);
    y += 20;
  }
}

function renderFollowUpSection(
  doc: PDFKit.PDFDocument,
  report: ClinicalReport,
  colors: any,
  fonts: any
): void {
  renderPageHeader(doc, 'Follow-Up Strategy', colors, fonts);

  let y = 120;

  // Appointment schedule
  doc.font(fonts.subheading, 12);
  doc.fillColor(colors.text);
  doc.text('Recommended Follow-Up Schedule', 50, y);

  y += 25;

  doc.font(fonts.body, 10);
  doc.fillColor(colors.primary);
  doc.text(report.followUp.recommendedInterval, 50, y);

  y += 35;

  // Checkpoint markers
  doc.font(fonts.subheading, 12);
  doc.fillColor(colors.text);
  doc.text('What We\'ll Monitor', 50, y);

  y += 25;

  for (const marker of report.followUp.checkpointMarkers) {
    doc.font(fonts.body, 10);
    doc.fillColor(colors.primary);
    doc.text('📊', 50, y);
    doc.fillColor(colors.text);
    doc.text(marker, 70, y);
    y += 20;
  }

  y += 20;

  // Success metrics
  doc.font(fonts.subheading, 12);
  doc.fillColor(colors.text);
  doc.text('Success Metrics', 50, y);

  y += 25;

  for (const metric of report.followUp.successMetrics) {
    doc.font(fonts.body, 10);
    doc.fillColor(colors.primary);
    doc.text('✓', 50, y);
    doc.fillColor(colors.text);
    doc.text(metric, 70, y);
    y += 20;
  }

  y += 20;

  // Adherence strategy
  doc.font(fonts.subheading, 12);
  doc.fillColor(colors.text);
  doc.text('Staying on Track', 50, y);

  y += 25;

  doc.font(fonts.body, 10);
  doc.fillColor(colors.text);
  doc.text(report.followUp.adherenceStrategy, 50, y, { width: 495 });
}

function renderResourcesSection(
  doc: PDFKit.PDFDocument,
  report: ClinicalReport,
  colors: any,
  fonts: any
): void {
  renderPageHeader(doc, 'Additional Resources', colors, fonts);

  let y = 120;

  doc.font(fonts.body, 10);
  doc.fillColor(colors.text);
  doc.text(
    'Learn more to optimize your recovery:',
    50,
    y,
    { width: 495 }
  );

  y += 35;

  for (const resource of report.resources) {
    // Resource card
    const cardHeight = 70;
    doc.rect(50, y, 495, cardHeight).stroke(colors.border);
    doc.rect(50, y + 2, 493, cardHeight - 4).fill(colors.background);
    doc.stroke(colors.border);

    // Type
    doc.font(fonts.body, 8);
    doc.fillColor(colors.accent);
    doc.text(resource.type, 60, y + 10);

    // Title
    doc.font(fonts.subheading, 10);
    doc.fillColor(colors.primary);
    doc.text(resource.title, 60, y + 22);

    // Description
    doc.font(fonts.body, 9);
    doc.fillColor(colors.text);
    doc.text(resource.description, 60, y + 40, { width: 450 });

    y += cardHeight + 10;
  }

  // Disclaimers
  y += 30;

  doc.font(fonts.subheading, 10);
  doc.fillColor(colors.text);
  doc.text('Important Disclaimers', 50, y);

  y += 20;

  for (const disclaimer of report.disclaimers) {
    doc.font(fonts.body, 8);
    doc.fillColor(colors.accent);
    doc.text(`• ${disclaimer}`, 50, y, { width: 480 });
    y += 20;
  }
}

// ============ UTILITIES ============

function renderPageHeader(
  doc: PDFKit.PDFDocument,
  title: string,
  colors: any,
  fonts: any
): void {
  // Header bar
  doc.rect(0, 0, 595, 60).fill(colors.background);
  doc.stroke(colors.border);

  // Title
  doc.font(fonts.heading, 18);
  doc.fillColor(colors.primary);
  doc.text(title, 40, 15);

  // Page number
  doc.font(fonts.body, 9);
  doc.fillColor(colors.accent);
  doc.text(`Page ${doc.bufferedPageRange().count}`, 500, 20);
}

function renderInfoBox(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  height: number,
  text: string,
  colors: any
): void {
  doc.rect(x, y, width, height).fill(colors.background);
  doc.stroke(colors.border);

  doc.font('Helvetica', 9);
  doc.fillColor(colors.text);
  doc.text(text, x + 15, y + 12, { width: width - 30, align: 'left' });
}

export { generatePremiumPDF };
