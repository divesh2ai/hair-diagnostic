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
    o.label === 'None / Not tested');
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
 * Returns the option IDs that would be auto-deselected when group exclusivity fires.
 * Pure query — does not mutate state. Used by QuestionRenderer to detect when
 * to show the deselect hint without duplicating the group-lookup logic.
 *
 * Returns [] if:
 *   - selectedId belongs to no group, or
 *   - no current selections conflict with selectedId's group.
 */
export function computeGroupExclusivityDeselections(
  currentAnswer: string[],
  selectedId: string,
  groups: string[][]
): string[] {
  const group = groups.find(g => g.includes(selectedId));
  if (!group) return [];
  return currentAnswer.filter(id => group.includes(id) && id !== selectedId);
}

/**
 * Apply multi-select rules WITH pairwise mutual exclusion groups.
 * Groups come from Question.mutualExclusivityGroups.
 *
 * Example groups: [["Dry scalp", "Oily scalp"], ["Dandruff / white flakes", "Dandruff + Itching + White flakes"]]
 *
 * Selecting "Dry scalp" deselects "Oily scalp" (and vice versa), but neither
 * clears Dandruff options (different group).
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

  // 2. Remove any global exclusive options from result
  let result = currentAnswer.filter(id => !exclusiveIds.includes(id));

  // 3. Find which exclusivity group selectedId belongs to (if any)
  const selectedGroup = groups.find(g => g.includes(selectedId));

  if (selectedGroup) {
    // Remove all OTHER members of this group (preserving selectedId if toggling)
    result = result.filter(id => !selectedGroup.includes(id));
  }

  // 4. Toggle the selected option
  const wasAlreadySelected = currentAnswer.includes(selectedId);
  if (wasAlreadySelected && !selectedGroup) {
    // Toggle off (only when not replaced by group logic)
    result = result.filter(id => id !== selectedId);
  } else if (!wasAlreadySelected) {
    result = [...result, selectedId];
  }
  // If selectedGroup exists and was already selected: result already has it removed → re-add
  else if (selectedGroup && wasAlreadySelected) {
    // deselect it (already removed above)
  } else {
    result = [...result, selectedId];
  }

  return result;
}
