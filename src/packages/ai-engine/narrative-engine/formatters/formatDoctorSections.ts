import type { ClinicalProfile } from '../../clinical-engine/types';
import type { TherapyNeeds } from '../../therapy-engine/types';
import type { KitRecommendation } from '../../kit-scorer/types';
import type { NarrativeSection, KitNarrative, TherapyExplanation, PrognosisNarrative, TimelineEvent } from '../types';
import type { ClinicalNarrativeContext } from '../mappers/mapClinicalToNarrative';
import {
  DIAGNOSIS_LABELS, ROOT_CAUSE_LABELS, SEVERITY_CLINICAL_LABELS,
  THERAPY_NEED_LABELS, CONDITION_REVERSIBILITY, MEDICAL_DISCLAIMERS,
  FOLLOWUP_PRIORITY_BY_SEVERITY,
} from '../constants';
import { makeSection, joinWithAnd, bulletise } from '../utils';

// ─── Doctor Section Formatters ────────────────────────────────────────────────

export function formatClinicalSummarySection(
  ctx: ClinicalNarrativeContext,
  profile: ClinicalProfile,
  therapyPlan: TherapyNeeds,
  kitRecommendation: KitRecommendation
): NarrativeSection {
  const body = [
    `${ctx.patientContext}`,
    `Primary diagnosis: **${ctx.diagnosisLabel}** (${ctx.severityLabel}).`,
    ctx.rootCausesSummary,
    ctx.signalSummary,
    `Condition reversibility: ${formatReversibility(CONDITION_REVERSIBILITY[profile.primaryDiagnosis])}.`,
    `Protocol initiated: ${kitRecommendation.protocolLabel}. ${therapyPlan.needs.length} therapy needs identified.`,
  ].join(' ');

  return makeSection('clinical-summary', 'Clinical Summary', body, undefined, 'paragraph');
}

export function formatPrimaryDiagnosisSection(
  ctx: ClinicalNarrativeContext,
  profile: ClinicalProfile
): NarrativeSection {
  const body = `The primary diagnosis is **${ctx.diagnosisLabel}** with ${ctx.severityLabel} severity. ${ctx.confidenceExplanation.differentiationNote}`;

  const bullets = [
    `Diagnosis key: ${profile.primaryDiagnosis}`,
    `Confidence score: ${ctx.confidenceExplanation.score}/100 (${ctx.confidenceExplanation.level})`,
    ...ctx.confidenceExplanation.supportingSignals,
    ...ctx.confidenceExplanation.limitingFactors.map(f => `⚠ ${f}`),
  ];

  return makeSection('primary-diagnosis', 'Primary Diagnosis', body, bullets, 'bullets');
}

export function formatDifferentialDiagnosesSection(
  ctx: ClinicalNarrativeContext,
  profile: ClinicalProfile
): NarrativeSection {
  const differentials = profile.secondaryDiagnoses.slice(0, 5);

  if (differentials.length === 0) {
    return makeSection(
      'differential-diagnoses',
      'Differential Diagnoses',
      'No significant differential diagnoses were identified. Signal concordance supports the primary diagnosis.',
      undefined,
      'paragraph'
    );
  }

  const body = 'The following alternative diagnoses were considered during evaluation:';
  const bullets = differentials.map(d =>
    `${DIAGNOSIS_LABELS[d.key]} — score: ${d.score}/100${d.isPrimary ? ' [primary]' : ''}`
  );

  return makeSection('differential-diagnoses', 'Differential Diagnoses', body, bullets, 'bullets');
}

export function formatSeverityAssessmentSection(
  profile: ClinicalProfile,
  ctx: ClinicalNarrativeContext
): NarrativeSection {
  const body = [
    `Severity classified as **${SEVERITY_CLINICAL_LABELS[profile.severity]}**.`,
    profile.flags.isGrade45
      ? 'Advanced follicular miniaturisation present; prognosis for complete regrowth is guarded. Stabilisation is the primary clinical objective.'
      : profile.flags.isGrade123
      ? 'Follicular miniaturisation is at an early-to-moderate stage. Response to targeted therapy is expected to be good.'
      : 'Severity assessment based on clinical presentation and symptom duration.',
    profile.flags.hasActiveShedding
      ? 'Active shedding is present, indicating ongoing follicle cycle disruption.'
      : '',
  ].filter(Boolean).join(' ');

  return makeSection('severity-assessment', 'Severity Assessment', body, undefined, 'paragraph');
}

export function formatRootCauseAnalysisSection(
  ctx: ClinicalNarrativeContext,
  profile: ClinicalProfile
): NarrativeSection {
  const body = `Root cause analysis identified ${profile.rootCauses.length} contributing factor${profile.rootCauses.length !== 1 ? 's' : ''}:`;
  const bullets = ctx.rootCauseBullets.map((label, i) => {
    const rc = profile.rootCauses[i];
    const reason = Object.entries(profile.flags).some(([k, v]) => v === true) ? '' : '';
    return `${label}${reason}`;
  });

  const footer = profile.rootCauses.length > 1
    ? ' Multiple concurrent root causes indicate mixed aetiology requiring a multi-modal therapeutic approach.'
    : '';

  return makeSection(
    'root-cause-analysis',
    'Root Cause Analysis',
    body + footer,
    bullets,
    'bullets'
  );
}

export function formatSignalInterpretationSection(
  profile: ClinicalProfile,
  ctx: ClinicalNarrativeContext
): NarrativeSection {
  const body = [
    ctx.signalSummary,
    ctx.differentialsSummary,
    profile.scalpStates.length > 0
      ? `Scalp states documented: ${joinWithAnd(profile.scalpStates.map(s => s.replace(/_/g, ' ').toLowerCase()))}.`
      : '',
  ].filter(Boolean).join(' ');

  return makeSection('signal-interpretation', 'Signal Interpretation', body, undefined, 'paragraph');
}

export function formatTherapyLogicSection(
  therapyPlan: TherapyNeeds,
  profile: ClinicalProfile
): NarrativeSection {
  const body = `${therapyPlan.needs.length} therapy needs were identified based on clinical signals:`;

  const bullets = therapyPlan.needs.map(need => {
    const reasons = therapyPlan.needReasons[need] ?? [];
    const reasonText = reasons.length > 0 ? ` — ${reasons[0]}` : '';
    return `${THERAPY_NEED_LABELS[need]}${reasonText}`;
  });

  return makeSection('therapy-logic', 'Therapy Logic', body, bullets, 'bullets');
}

export function formatKitRationaleSection(
  kitRecommendation: KitRecommendation,
  kitNarratives: readonly KitNarrative[]
): NarrativeSection {
  const body = [
    `Protocol selected: **${kitRecommendation.protocolLabel}**.`,
    kitRecommendation.protocolRationale,
    kitRecommendation.selectionJustification,
  ].join(' ');

  const bullets = kitNarratives.map(k =>
    `Phase ${k.phase}: ${k.displayName} — ${k.reasonForSelection.slice(0, 100)}...`
  );

  return makeSection('kit-rationale', 'Kit Selection Rationale', body, bullets, 'bullets');
}

export function formatIngredientMechanismsSection(
  kitNarratives: readonly KitNarrative[]
): NarrativeSection {
  const allIngredients = kitNarratives.flatMap(k => k.ingredientHighlights);
  const body = `Key active ingredients across recommended kits and their mechanism of action:`;

  const bullets = allIngredients.map(i =>
    `**${i.name}** (${i.role}): ${i.mechanism} [${i.evidenceNote}]`
  );

  return makeSection('ingredient-mechanisms', 'Ingredient Mechanisms', body, bullets, 'bullets');
}

export function formatPrognosisSection(
  prognosis: PrognosisNarrative,
  profile: ClinicalProfile
): NarrativeSection {
  const body = [
    prognosis.detailedText,
    prognosis.adherenceImpact,
    prognosis.reversibilityStatement,
    prognosis.geneticFactorNote,
  ].filter(Boolean).join('\n\n');

  return makeSection('prognosis', 'Prognosis', body, undefined, 'paragraph');
}

export function formatRiskFactorsSection(
  profile: ClinicalProfile,
  ctx: ClinicalNarrativeContext
): NarrativeSection {
  const bullets: string[] = [];

  if (profile.flags.isGrade45) bullets.push('Advanced-grade follicular miniaturisation — limited regrowth potential');
  if (profile.rootCauses.includes('GENETICS')) bullets.push('Genetic predisposition — requires long-term maintenance');
  if (profile.rootCauses.includes('DHT')) bullets.push('Androgenic sensitivity — DHT-blocking therapy is lifelong');
  if (profile.rootCauses.length > 3) bullets.push('Multi-factorial aetiology — increased protocol complexity');
  if (profile.severity === 'SEVERE') bullets.push('Severe presentation at assessment — guarded prognosis for full regrowth');

  const body = bullets.length > 0
    ? 'The following risk factors are relevant to prognosis and management:'
    : 'No high-risk prognostic factors identified beyond the primary diagnosis.';

  return makeSection('risk-factors', 'Risk Factors', body, bullets.length > 0 ? bullets : undefined, 'bullets');
}

export function formatContraindicationsSection(
  profile: ClinicalProfile,
  patient: import('../../../types').PatientAnswers
): NarrativeSection {
  const contraindications: string[] = [];

  if (patient.is_pregnant) {
    contraindications.push('Pregnancy: minoxidil, finasteride, dutasteride, and retinoids are contraindicated');
  }
  if (patient.planning_pregnancy) {
    contraindications.push('Planning pregnancy: finasteride and dutasteride must be discontinued 6 months before conception attempts');
  }
  if (patient.hasHypertension) {
    contraindications.push('Hypertension: minoxidil dose monitoring required; oral minoxidil requires BP monitoring');
  }
  if (profile.primaryDiagnosis === 'ALOPECIA_AREATA') {
    contraindications.push('AA: certain immunosuppressants require dermatologist-level prescribing and monitoring');
  }
  if (profile.flags.hasGLP1Early || profile.flags.hasGLP1Late) {
    contraindications.push('GLP-1 use: weight-loss-associated TE considerations apply; adjust supplement stack');
  }

  const body = contraindications.length > 0
    ? 'The following contraindications were flagged algorithmically and require clinical verification:'
    : 'No contraindications were algorithmically identified. Clinical review should confirm this assessment.';

  return makeSection(
    'contraindications',
    'Contraindications',
    body,
    contraindications.length > 0 ? contraindications : undefined,
    'bullets'
  );
}

export function formatFollowUpSection(
  profile: ClinicalProfile
): NarrativeSection {
  const priority = FOLLOWUP_PRIORITY_BY_SEVERITY[profile.severity];
  const window = profile.severity === 'SEVERE' ? '6 weeks' : profile.severity === 'MODERATE' ? '3 months' : '6 months';

  const bullets = [
    `Recommended follow-up: ${window} (priority: ${priority})`,
    'Photographic documentation at initiation and each follow-up',
    'Trichoscopic assessment at 3-month review',
    'Ferritin, thyroid, and hormonal panel at 6-month review if not yet done',
    profile.severity === 'SEVERE' ? 'Consider specialist trichologist or dermatology referral' : '',
  ].filter(Boolean) as string[];

  return makeSection('follow-up', 'Follow-Up Recommendations', 'Structured follow-up is recommended to monitor treatment response:', bullets, 'bullets');
}

export function formatRecoveryTimelineSection(
  timeline: readonly TimelineEvent[]
): NarrativeSection {
  const body = 'Expected recovery trajectory based on clinical profile, diagnosis, and therapy stack:';
  const bullets = timeline.map(e =>
    `**${e.weekRange}** — ${e.milestone}: ${e.expectation} ${e.isConditional ? '[conditional]' : ''}`
  );

  return makeSection('recovery-timeline', 'Expected Recovery Timeline', body, bullets, 'timeline');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatReversibility(r: 'reversible' | 'partially-reversible' | 'chronic-manageable'): string {
  const map = {
    reversible: 'Reversible — full recovery expected with trigger resolution',
    'partially-reversible': 'Partially reversible — significant improvement expected; ongoing management may be required',
    'chronic-manageable': 'Chronic manageable condition — requires long-term maintenance therapy',
  };
  return map[r];
}
