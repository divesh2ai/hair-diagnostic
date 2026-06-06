import type { ClinicalProfile } from '../../clinical-engine/types';
import type { TherapyNeeds } from '../../therapy-engine/types';
import type { NarrativeSection, KitNarrative, PrognosisNarrative, TimelineEvent, EducationalInsight } from '../types';
import type { ClinicalNarrativeContext } from '../mappers/mapClinicalToNarrative';
import type { ToneProfile } from '../mappers/mapSeverityToTone';
import {
  CONDITION_REVERSIBILITY, THERAPY_NEED_PATIENT_LABELS,
  RECOVERY_WINDOWS, DIAGNOSIS_LABELS,
} from '../constants';
import { makeSection, joinWithAnd, isFemale, resolveAge } from '../utils';
import type { PatientAnswers } from '../../../types';

// ─── Patient Section Formatters ────────────────────────────────────────────────

export function formatWhatIsHappeningSection(
  ctx: ClinicalNarrativeContext,
  profile: ClinicalProfile,
  patient: PatientAnswers,
  tone: ToneProfile
): NarrativeSection {
  const female = isFemale(patient);
  const age = resolveAge(patient);
  const diagnosisLabel = DIAGNOSIS_LABELS[profile.primaryDiagnosis];
  const reversibility = CONDITION_REVERSIBILITY[profile.primaryDiagnosis];

  const bodies: Record<typeof profile.severity, string> = {
    MILD: `Your hair analysis has confirmed **${diagnosisLabel}** at an early stage. This means the hair loss process is in its beginning phases, and the vast majority of your hair follicles are still active and treatable. Early-stage hair loss like yours has the best response rates to targeted treatment.`,
    MODERATE: `Your hair analysis has confirmed **${diagnosisLabel}** at a moderate stage. Your hair loss has been progressing, but your follicles are still present and responsive to treatment. A structured protocol will work to stabilise further loss and support recovery.`,
    SEVERE: `Your hair analysis has confirmed **${diagnosisLabel}** at a more advanced stage. This means the process has been active for some time. While full reversal is not always possible at this stage, meaningful stabilisation and improvement are achievable with a dedicated, consistent protocol.`,
  };

  const reversibilityNote = reversibility === 'reversible'
    ? ' The good news is that your type of hair loss is fully reversible once the underlying cause is addressed.'
    : reversibility === 'partially-reversible'
    ? ' With the right support, significant improvement is expected, though some long-term management may be needed.'
    : ' Your condition is chronic but manageable with ongoing care — the goal is to protect what you have and improve density over time.';

  return makeSection(
    'what-is-happening',
    'What Is Happening to Your Hair',
    bodies[profile.severity] + reversibilityNote,
    undefined,
    'paragraph'
  );
}

export function formatWhyItIsHappeningSection(
  ctx: ClinicalNarrativeContext,
  profile: ClinicalProfile,
  patient: PatientAnswers
): NarrativeSection {
  const causeExplanations: string[] = [];

  if (profile.rootCauses.includes('DHT')) {
    causeExplanations.push('A hormone called DHT — made from testosterone — is binding to your hair follicles and causing them to slowly shrink.');
  }
  if (profile.rootCauses.includes('STRESS')) {
    causeExplanations.push('Sustained stress has signalled your hair follicles to enter a resting phase earlier than normal, causing accelerated shedding.');
  }
  if (profile.rootCauses.includes('IRON_DEFICIENCY')) {
    causeExplanations.push('Your iron stores are below the level hair follicles need to complete their growth cycle properly.');
  }
  if (profile.rootCauses.includes('HYPOTHYROID')) {
    causeExplanations.push('Low thyroid hormone levels are slowing down your hair growth cycles.');
  }
  if (profile.rootCauses.includes('PCOS')) {
    causeExplanations.push('PCOS is causing elevated androgen levels, which affects sensitive hair follicles in the same way DHT does.');
  }
  if (profile.rootCauses.includes('HORMONAL_SHIFT')) {
    causeExplanations.push('Oestrogen — which normally protects hair follicles — is declining, reducing that protection.');
  }
  if (profile.rootCauses.includes('POST_PARTUM')) {
    causeExplanations.push('After pregnancy, the oestrogen that kept your hair in a long growth phase has dropped, causing many follicles to shed at once.');
  }
  if (profile.rootCauses.includes('GUT_MALABSORPTION')) {
    causeExplanations.push('Your gut is not absorbing nutrients as efficiently as it should, leaving hair follicles short of the fuel they need to grow.');
  }
  if (profile.rootCauses.includes('OXIDATIVE_STRESS')) {
    causeExplanations.push('Oxidative damage from free radicals is weakening follicle cells and shortening their growth cycles.');
  }
  if (profile.rootCauses.includes('GENETICS')) {
    causeExplanations.push('Genetic sensitivity to certain hormones means your follicles are more reactive than average — this is not something you caused.');
  }

  const body = causeExplanations.length > 0
    ? 'Based on your assessment, the following factors are contributing to your hair loss:'
    : 'Your hair loss pattern has been analysed and the likely contributing factors identified.';

  const bullets = causeExplanations.length > 0 ? causeExplanations : undefined;

  return makeSection('why-it-is-happening', 'Why It Is Happening', body, bullets, 'bullets');
}

export function formatIsItReversibleSection(
  profile: ClinicalProfile,
  patient: PatientAnswers
): NarrativeSection {
  const reversibility = CONDITION_REVERSIBILITY[profile.primaryDiagnosis];

  const bodies: Record<typeof reversibility, string> = {
    reversible: [
      'The type of hair loss you\'re experiencing is **fully reversible**.',
      'This means your follicles are intact and capable of returning to normal function once the underlying cause is addressed.',
      'With the right support and consistency, most patients with your profile achieve significant, often complete, recovery.',
      'The earlier the intervention, the faster and more complete the response.',
    ].join(' '),
    'partially-reversible': [
      'Your type of hair loss is **largely reversible** with targeted treatment, though individual results vary.',
      'The factors contributing to your hair loss can be addressed — and most patients see meaningful improvement in density, strength, and coverage.',
      'Some aspects may require ongoing management, particularly if there is a genetic or hormonal component, but treatment consistently delivers measurable results.',
    ].join(' '),
    'chronic-manageable': [
      'Your condition is **chronic** — meaning it requires ongoing management rather than a one-time fix.',
      'The goal of your protocol is to preserve the hair you have, slow any further decline, and improve density wherever follicles are still active.',
      'Think of it like managing blood pressure: with the right ongoing support, you can live your fullest life with healthy, well-managed hair.',
      profile.flags.isGrade123
        ? 'At your current stage, the prognosis for visible improvement is still positive — you have time on your side.'
        : 'Stabilisation followed by gradual improvement is the typical journey for patients at your stage.',
    ].join(' '),
  };

  return makeSection('is-it-reversible', 'Is Your Hair Loss Reversible?', bodies[reversibility], undefined, 'paragraph');
}

export function formatHowTherapiesWorkSection(
  therapyPlan: TherapyNeeds,
  patient: PatientAnswers
): NarrativeSection {
  const topNeeds = therapyPlan.needs.slice(0, 4);
  const body = 'Your personalised protocol works on multiple levels simultaneously:';

  const bullets = topNeeds.map(need => {
    const label = THERAPY_NEED_PATIENT_LABELS[need];
    return `**${label.charAt(0).toUpperCase() + label.slice(1)}**: This addresses ${label}.`;
  });

  const footer = `\n\nThis multi-layered approach is more effective than single-target treatments because hair loss is rarely caused by just one factor.`;

  return makeSection('how-therapies-work', 'How Your Therapies Work', body + footer, bullets, 'bullets');
}

export function formatHowKitsHelpSection(
  kitNarratives: readonly KitNarrative[]
): NarrativeSection {
  const body = 'Your recommended kits have been specifically selected to deliver the therapeutic action your hair needs:';

  const bullets = kitNarratives.map(k =>
    `**${k.displayName}** (Phase ${k.phase}): ${k.patientFriendlyPurpose}`
  );

  return makeSection('how-kits-help', 'How Your Recommended Products Help', body, bullets, 'bullets');
}

export function formatWhatToExpectSection(
  prognosis: PrognosisNarrative,
  profile: ClinicalProfile
): NarrativeSection {
  const body = [
    prognosis.shortSummary,
    `\n\n**What most patients experience:**`,
    `• Best case: ${prognosis.recoveryExpectation.bestCase}`,
    `• Typical outcome: ${prognosis.recoveryExpectation.typicalCase}`,
    `• Conservative estimate: ${prognosis.recoveryExpectation.conservativeCase}`,
    `\n${prognosis.recoveryExpectation.variabilityNote}`,
    `\n${prognosis.adherenceImpact}`,
  ].join('\n');

  return makeSection('what-to-expect', 'What Results Can You Expect?', body, undefined, 'paragraph');
}

export function formatRealisticTimelineSection(
  timeline: readonly TimelineEvent[]
): NarrativeSection {
  const body = 'Here is what to expect at each stage of your journey:';
  const bullets = timeline.map(e =>
    `**${e.weekRange}** — ${e.milestone}: ${e.expectation}`
  );

  return makeSection('realistic-timeline', 'Your Recovery Timeline', body, bullets, 'timeline');
}

export function formatPreventionAdviceSection(
  profile: ClinicalProfile,
  patient: PatientAnswers
): NarrativeSection {
  const advice: string[] = [];

  if (profile.rootCauses.includes('DHT') || profile.rootCauses.includes('GENETICS')) {
    advice.push('Continue your DHT-suppressing protocol long-term — stopping treatment will gradually reverse progress.');
  }
  if (profile.rootCauses.includes('STRESS')) {
    advice.push('Managing stress levels through sleep, exercise, and mindfulness directly protects your hair growth cycles.');
  }
  if (profile.rootCauses.includes('IRON_DEFICIENCY')) {
    advice.push('Monitor ferritin levels annually and maintain supplementation if dietary sources are insufficient.');
  }
  if (profile.rootCauses.includes('POOR_NUTRITION')) {
    advice.push('A protein-rich diet (at least 1.2g/kg body weight), with adequate B vitamins and zinc, supports sustained hair health.');
  }
  if (profile.scalpStates.some(s => s.includes('INFLAM') || s.includes('OILY'))) {
    advice.push('Regular scalp cleansing with your recommended products prevents microbiome imbalance that worsens hair loss.');
  }
  if (profile.rootCauses.includes('OXIDATIVE_STRESS')) {
    advice.push('Protect hair from UV exposure. Antioxidant-rich foods (berries, leafy greens, nuts) support follicle defence systems.');
  }

  advice.push('Avoid crash diets or rapid weight loss — caloric restriction below 1,000 kcal/day reliably triggers hair shedding.');
  advice.push('Attend your follow-up appointments — early identification of protocol adjustments prevents setbacks.');

  const body = 'The best way to protect your progress is to continue your protocol and support your hair health holistically:';

  return makeSection('prevention-advice', 'How to Protect Your Progress', body, advice, 'bullets');
}

export function formatReassuranceSection(
  profile: ClinicalProfile,
  patient: PatientAnswers,
  tone: ToneProfile
): NarrativeSection {
  const female = isFemale(patient);
  const age = resolveAge(patient);
  const name = patient.name ?? 'you';

  const messages: string[] = [];

  if (tone.primaryTone === 'empathetic') {
    messages.push(
      `Hair loss can feel deeply personal, and we want you to know that what you\'re experiencing is valid and understood. ${profile.severity === 'SEVERE' ? 'Many patients at your stage have achieved results that genuinely changed how they felt about themselves.' : ''}`
    );
  }

  messages.push(
    'Your protocol is built on the same evidence base used by leading trichology clinics, personalised to your specific biology.'
  );

  if (profile.flags.isGrade123) {
    messages.push(
      'You\'re coming in at a stage where treatment is highly effective. The earlier you act, the better your outcome — and you\'ve done exactly the right thing.'
    );
  }

  messages.push(
    'Hair growth is slow — every hair spends months in its growth cycle. Consistency is the single most important factor in your results. Trusting the process is part of the treatment.'
  );

  const body = messages.join('\n\n');

  return makeSection('reassurance', 'A Note From Your Care Team', body, undefined, 'paragraph');
}

export function formatEducationalInsightsSection(
  insights: readonly EducationalInsight[]
): NarrativeSection {
  if (insights.length === 0) {
    return makeSection('educational-insights', 'Understanding Your Hair Loss', '', undefined, 'paragraph');
  }

  const body = 'Understanding the science behind your hair loss helps you stay committed to your protocol:';

  const bullets = insights.map(i =>
    `**${i.topic}**: ${i.patientFriendlyExplanation} — ${i.relevantBecause}`
  );

  return makeSection('educational-insights', 'The Science Behind Your Hair Loss', body, bullets, 'bullets');
}
