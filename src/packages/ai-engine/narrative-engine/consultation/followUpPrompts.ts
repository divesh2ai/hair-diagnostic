import type { ClinicalProfile } from '../../clinical-engine/types';
import type { KitRecommendation } from '../../kit-scorer/types';
import type { ConsultationChapterId, FollowUpPrompt } from './types';

// ─── Follow-up prompts ────────────────────────────────────────────────────────
//
// Each chapter ends with 2–3 anticipated patient questions. These are surfaced
// in the UI as tappable chips. The avatar runtime decides what to do with the
// id when a chip is tapped:
//   • prerendered runtime → opens a written answer panel
//   • realtime runtime    → streams the doctor's spoken answer
//
// Keep prompts short, first-person, and chapter-scoped. The id is stable
// across renders so analytics can track which questions actually get asked.
// ─────────────────────────────────────────────────────────────────────────────

function p(
  chapterId: ConsultationChapterId,
  id: string,
  question: string,
  hint?: string,
): FollowUpPrompt {
  return { id: `${chapterId}:${id}`, chapterId, question, hint };
}

export function buildChapter1FollowUps(
  profile: ClinicalProfile,
  diagnosisLabel: string,
): readonly FollowUpPrompt[] {
  const prompts: FollowUpPrompt[] = [
    p('what-is-happening', 'is-this-permanent', 'Is this permanent?', 'Reversibility at your stage'),
    p('what-is-happening', 'how-bad-is-mine', `How bad is my ${diagnosisLabel.toLowerCase()}?`, 'Your severity in context'),
  ];
  if (profile.flags.hasActiveShedding) {
    prompts.push(
      p('what-is-happening', 'why-shedding-now', 'Why am I shedding so much right now?'),
    );
  }
  return prompts;
}

export function buildChapter2FollowUps(
  profile: ClinicalProfile,
): readonly FollowUpPrompt[] {
  const prompts: FollowUpPrompt[] = [
    p('why-is-this-happening', 'main-cause', 'Which cause matters most for me?'),
    p('why-is-this-happening', 'could-it-be-stress', 'Could stress alone explain this?'),
  ];
  if (profile.rootCauses.length > 1) {
    prompts.push(
      p('why-is-this-happening', 'multiple-causes', 'Why do I have more than one cause?', 'How they interact'),
    );
  }
  return prompts;
}

export function buildChapter3FollowUps(
  _profile: ClinicalProfile,
): readonly FollowUpPrompt[] {
  return [
    p('inside-your-body', 'cycle-explained', 'Can you show me the hair growth cycle?', 'Follicle animation'),
    p('inside-your-body', 'why-thinning', 'Why is my hair getting thinner before it falls out?'),
    p('inside-your-body', 'what-tests', 'Are there blood tests I should get?', 'When labs add value'),
  ];
}

export function buildChapter4FollowUps(
  recoveryWindow: string,
): readonly FollowUpPrompt[] {
  return [
    p('can-i-recover', 'how-much-back', 'Realistically, how much hair will come back?'),
    p('can-i-recover', 'when-see-change', `What changes should I see before ${recoveryWindow}?`),
    p('can-i-recover', 'what-if-i-stop', 'What happens if I stop the protocol later?'),
  ];
}

export function buildChapter5FollowUps(
  kitRecommendation: KitRecommendation,
): readonly FollowUpPrompt[] {
  const primary = kitRecommendation.rankedKits[0];
  const prompts: FollowUpPrompt[] = [
    p('what-to-do-next', 'daily-routine', 'What does a typical day on the protocol look like?'),
    p('what-to-do-next', 'side-effects', 'Are there side effects I should watch for?'),
  ];
  if (primary) {
    prompts.push(
      p('what-to-do-next', 'kit-questions', `Tell me more about the ${primary.kitId} kit.`, 'Ingredients & how it works'),
    );
  }
  return prompts;
}
