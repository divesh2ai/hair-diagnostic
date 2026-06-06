import type { AvatarDialogueSegment, AvatarEmotion } from '../types';
import type { Severity } from '../../../types';
import { stripMarkdown, joinWithAnd } from '../utils';

// ─── Avatar Speech Formatter ──────────────────────────────────────────────────

export function formatAvatarSpeech(
  text: string,
  emotion: AvatarEmotion,
  emphasisWords?: readonly string[],
  pauseAfterMs?: number
): AvatarDialogueSegment {
  return {
    text: naturaliseText(stripMarkdown(text)),
    emotion,
    emphasis: emphasisWords,
    pauseAfterMs,
  };
}

// ─── Speech Naturalisation ────────────────────────────────────────────────────

function naturaliseText(text: string): string {
  return text
    .replace(/\. ([A-Z])/g, '. $1')
    .replace(/\n{2,}/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .trim();
}

// ─── Severity-Adjusted Intro Templates ───────────────────────────────────────

export function getAvatarIntroText(
  patientName: string,
  diagnosisLabel: string,
  severity: Severity
): string {
  const greetings: Record<Severity, string> = {
    MILD: `Hi ${patientName}. I've reviewed your hair analysis, and I have some great news for you. Your results show early-stage changes — which means you're in exactly the right place at exactly the right time. Let me walk you through what we've found and what we're going to do about it.`,
    MODERATE: `Hi ${patientName}. I've gone through your hair analysis results carefully. You're dealing with ${diagnosisLabel} at a moderate stage, and I want to give you a clear, honest picture of what's happening — and more importantly, what your personalised plan looks like. Let's go through it together.`,
    SEVERE: `Hi ${patientName}. Thank you for being here — this takes courage, and I want you to know you're in good hands. Your hair analysis has revealed an advanced pattern that requires a serious, structured response. I'm going to explain everything clearly — what's happening, why, and the comprehensive plan we've put together for you.`,
  };
  return greetings[severity];
}

export function getAvatarOutroText(
  patientName: string,
  recoveryWindow: string,
  severity: Severity
): string {
  const outros: Record<Severity, string> = {
    MILD: `${patientName}, your results genuinely give us reasons to be optimistic. Starting this protocol now, at this stage, means you have a real opportunity to protect and restore your hair. Consistency is your most powerful tool. Your care team is here at every step. You've got this.`,
    MODERATE: `${patientName}, the path forward is clear and the protocol is built specifically for you. It won't happen overnight — most patients see meaningful change around ${recoveryWindow} — but every day you follow your protocol, progress is happening at the cellular level, even before you can see it. Stay the course. We're with you.`,
    SEVERE: `${patientName}, I know this journey has already taken something from you. I want you to know that what we do from here matters enormously. Your protocol is comprehensive, clinically grounded, and personalised to every signal in your profile. Many patients who felt hopeless at your stage have achieved results that surprised them. Follow the plan. Come back for your reviews. Progress is possible — and you deserve it.`,
  };
  return outros[severity];
}

// ─── Scene Speech Templates ───────────────────────────────────────────────────

export function getUnderstandingProblemSpeech(
  diagnosisLabel: string,
  severity: Severity,
  patientName: string
): string {
  const map: Record<Severity, string> = {
    MILD: `So ${patientName}, what we're looking at is ${diagnosisLabel}. This is early stage — your follicles are still there, they're still responsive, and the biological process causing this is very much treatable at this point.`,
    MODERATE: `${patientName}, what you're experiencing is ${diagnosisLabel}. It's at a moderate stage, which means the process has been going on for some time — but we caught it at a point where we can make a real difference. Your follicles are still present and capable of responding.`,
    SEVERE: `${patientName}, your diagnosis is ${diagnosisLabel}. I won't sugar-coat it — this is an advanced presentation. But I want to be clear: advanced does not mean hopeless. It means we need a serious, sustained approach, and that's exactly what your protocol delivers.`,
  };
  return map[severity];
}

export function getWhyFolliclesWeakenedSpeech(
  rootCauseLabels: readonly string[]
): string {
  const causes = joinWithAnd(rootCauseLabels.slice(0, 3));
  return `Let me explain why this is happening. Your assessment identified ${causes} as the primary drivers of your hair loss. These factors are working at the follicle level — affecting the cells that produce your hair and disrupting the normal growth cycle. Understanding this is the first step to treating it effectively.`;
}

export function getWhatTriggeredSheddingSpeech(
  triggerLabels: readonly string[],
  hasActiveShedding: boolean
): string {
  if (!hasActiveShedding && triggerLabels.length === 0) {
    return 'The triggering phase of your hair loss may have occurred months ago — hair follicles are slow to respond, and shedding often starts 2 to 3 months after the original trigger. This is normal, and it means the underlying cause may already be resolving.';
  }
  const triggers = joinWithAnd(triggerLabels.slice(0, 2));
  return `The main triggers identified in your case are ${triggers}. These have been disrupting your hair growth cycles${hasActiveShedding ? ', and active shedding is currently ongoing' : '. Shedding may have occurred or may still be at a sub-visible stage'}. Your protocol targets these triggers directly.`;
}

export function getHowTherapiesWorkSpeech(
  therapyLabels: readonly string[]
): string {
  const topThree = therapyLabels.slice(0, 3);
  return `Your treatment plan works on ${topThree.length} levels simultaneously. First, ${topThree[0] ?? 'addressing the primary driver'}. Second, ${topThree[1] ?? 'supporting follicle function'}. ${topThree[2] ? `And third, ${topThree[2]}.` : ''} Each element of your protocol targets a different biological step in the hair loss process — which is why this multi-layered approach consistently outperforms single treatments.`;
}

export function getHowKitsHelpSpeech(
  kitName: string,
  purpose: string,
  timeline: string
): string {
  return `Your primary recommended kit is the ${kitName}. ${purpose} Based on clinical data for patients with your profile, most people begin to see a change around ${timeline}. But remember — the biology is changing before you can see it. Every application is doing something.`;
}

export function getRecoveryExpectationsSpeech(
  typicalOutcome: string,
  recoveryWindow: string,
  severity: Severity
): string {
  const map: Record<Severity, string> = {
    MILD: `Here's what you can realistically expect. ${typicalOutcome} Most patients at your stage see meaningful improvement within ${recoveryWindow}. The key is starting now and staying consistent — every day matters.`,
    MODERATE: `Let me set honest expectations. ${typicalOutcome} Recovery at your stage typically takes ${recoveryWindow}. This isn't a quick fix — but it is a real one. Patients who complete the full protocol consistently report results they're genuinely proud of.`,
    SEVERE: `I want to give you realistic expectations. ${typicalOutcome} At your stage, the first win is stabilisation — stopping the progression. Then, over ${recoveryWindow}, improvement becomes possible. It takes longer, it takes commitment, but it's achievable.`,
  };
  return map[severity];
}

export function getComplianceSpeech(patientName: string): string {
  return `${patientName}, I want to talk about one of the most important factors in your outcome — consistency. Hair growth biology is slow and cumulative. Missing days doesn't just pause progress — it sets it back. Treat your protocol like a prescription. Set a reminder. Make it part of your daily routine. The patients who get the best results aren't the ones with the best products — they're the ones who use them every single day.`;
}
