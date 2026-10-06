import { Question, QuestionOption } from '@/types/questionnaire';
import { getVisibleOptions } from './visibilityEngine';

export { getVisibleOptions };

export function getVisibleOptionIds(
  question: Question,
  answers: Record<string, any>
): string[] {
  return getVisibleOptions(question, answers).map(o => o.id);
}

export function filterAnswerToVisible(
  question: Question,
  answer: any,
  answers: Record<string, any>
): any {
  const visibleIds = getVisibleOptionIds(question, answers);
  if (!visibleIds.length) return answer;

  if (Array.isArray(answer)) {
    return answer.filter(id => visibleIds.includes(id));
  }
  if (typeof answer === 'string' && !visibleIds.includes(answer)) {
    return undefined;
  }
  return answer;
}

/** Options that clear all others when selected (none / unsure). */
export function getExclusiveOptions(question: Question): QuestionOption[] {
  if (!question.options) return [];
  return question.options.filter(o => o.id === 'none' || o.id === 'unsure' ||
    o.label === 'None of the above' || o.label === 'No gut issues' ||
    o.label === 'Normal scalp' || o.label === 'Not Applicable' ||
    o.label === 'No heat or chemical treatments' ||
    o.label === 'None / Not tested' ||
    o.label === 'Not sure');
}

/**
 * Apply multi-select selection rules including:
 *   1. Exclusive options (none/unsure) — selecting one clears all others
 *   2. Regular toggle with de-duplication
 *
 * Does NOT handle pairwise group exclusivity — use applyGroupExclusivity for that.
 */
export function applyMultiSelectRules(
  currentAnswer: string[],
  selectedId: string,
  exclusiveIds: string[]
): string[] {
  if (exclusiveIds.includes(selectedId)) {
    return [selectedId];
  }
  const filtered = currentAnswer.filter(id => !exclusiveIds.includes(id));
  const already = filtered.includes(selectedId);
  return already ? filtered.filter(id => id !== selectedId) : [...filtered, selectedId];
}

/**
 * Collects every group-mate of `selectedId` across ALL groups it belongs to.
 * An option may appear in several 2-element groups (partially-connected
 * clusters), so we union the other members of every matching group rather than
 * only the first match.
 */
function collectGroupMates(selectedId: string, groups: string[][]): Set<string> {
  const mates = new Set<string>();
  for (const group of groups) {
    if (group.includes(selectedId)) {
      for (const id of group) {
        if (id !== selectedId) mates.add(id);
      }
    }
  }
  return mates;
}

/**
 * Returns the option IDs that would be auto-deselected when group exclusivity fires.
 * Pure query — does not mutate state. Used by QuestionRenderer to detect when
 * to show the deselect hint without duplicating the group-lookup logic.
 *
 * Unions across every group `selectedId` belongs to, so partially-connected
 * clusters report every conflicting selection. Toggling an already-selected
 * option OFF deselects nothing else, so returns [].
 */
export function computeGroupExclusivityDeselections(
  currentAnswer: string[],
  selectedId: string,
  groups: string[][]
): string[] {
  if (currentAnswer.includes(selectedId)) return []; // toggling off clears nothing else
  const mates = collectGroupMates(selectedId, groups);
  if (mates.size === 0) return [];
  return currentAnswer.filter(id => mates.has(id));
}

/**
 * Apply multi-select rules WITH pairwise mutual exclusion groups.
 * Groups come from Question.mutualExclusivityGroups — one 2-element group per
 * schema rule pair. An option may belong to several groups.
 *
 * Example groups: [["Dry scalp", "Oily scalp"], ["Dandruff / white flakes", "Dandruff + Itching + White flakes"]]
 *
 * Selecting "Dry scalp" deselects "Oily scalp" (and vice versa), but neither
 * clears Dandruff options (different group). Selecting an option that sits in
 * multiple groups (e.g. "Currently pregnant" in both {pregnant,peri} and
 * {pregnant,miscarriage}) deselects the mates from every one of those groups
 * — so the latest conflicting selection always wins. Toggling an already-
 * selected option OFF removes only that option and leaves everything else.
 */
export function applyGroupExclusivity(
  currentAnswer: string[],
  selectedId: string,
  groups: string[][],
  exclusiveIds: string[]
): string[] {
  // 1. Handle global exclusive options (none/unsure/none-of-above)
  if (exclusiveIds.includes(selectedId)) {
    return [selectedId];
  }

  // 2. Remove any global exclusive options from the working set
  const result = currentAnswer.filter(id => !exclusiveIds.includes(id));

  // 3. Toggle OFF: an already-selected option removes only itself. Its mates are
  //    left untouched (they were cleared when it was first selected).
  if (result.includes(selectedId)) {
    return result.filter(id => id !== selectedId);
  }

  // 4. Toggle ON: clear every group-mate across all groups containing selectedId,
  //    then add it — the newly selected option wins over its conflicts.
  const mates = collectGroupMates(selectedId, groups);
  return [...result.filter(id => !mates.has(id)), selectedId];
}
