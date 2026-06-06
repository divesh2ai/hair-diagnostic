import type { PatientAnswers } from '../../types';
import type { ClinicalFlags } from './types';

// Case-insensitive substring match across an array.
export function has(arr: readonly string[], v: string): boolean {
  const lower = v.toLowerCase();
  return arr.some((x) => x != null && x.toLowerCase().includes(lower));
}

// Typed signal accessor factory.
// Returned helpers are used by every rule module — import `signals` and call once per function.
export function signals(ans: PatientAnswers) {
  const thyroidArr = Array.isArray(ans.thyroid)
    ? ans.thyroid
    : ans.thyroid
    ? [ans.thyroid]
    : [];

  return {
    cause:      (v: string) => has(ans.cause      ?? [], v),
    scalp:      (v: string) => has(ans.scalp      ?? [], v),
    immunity:   (v: string) => has(ans.immunity   ?? [], v),
    lifestyle:  (v: string) => has(ans.lifestyle  ?? [], v),
    hormonal:   (v: string) => has(ans.hormonal   ?? [], v),
    thyroid:    (v: string) => has(thyroidArr, v),
    deficiency: (v: string) => has(ans.deficiency ?? [], v),
    hairtype:   (v: string) => has(ans.hairtype   ?? [], v),
    diet:       (v: string) => has(ans.diet       ?? [], v),
    gut:        (v: string) => has(ans.gut        ?? [], v),
    treatment:  (v: string) => has(ans.treatment  ?? [], v),
  };
}

export type SignalHelper = ReturnType<typeof signals>;

// Extracts all boolean/scalar flags from PatientAnswers into a ClinicalFlags object.
// Called once at the top of evaluateClinicalProfile; all rule modules consume flags.
export function extractFlags(ans: PatientAnswers): ClinicalFlags {
  const s = signals(ans);
  const rawGoal = Array.isArray(ans.goal)
    ? ans.goal.join(' ')
    : (ans.goal ?? '');
  const grade    = ans.grade    ?? '';
  const count    = ans.count    ?? '';
  const duration = ans.duration ?? '';

  const isGrade45  = grade.includes('Grade 4') || grade.includes('Grade 5');
  const isGrade123 = grade.includes('Grade 1') || grade.includes('Grade 2') || grade.includes('Grade 3');

  const isRegrowGoal  = /stopped|no active|regrow only/i.test(rawGoal);
  const hasHairGoal   = /reduce hair fall|improve growth/i.test(rawGoal);
  const hasGreyGoal   = /early greying|greying/i.test(rawGoal);
  const hasGLP1Early  = (ans.cause ?? []).some((c) => c.includes('within 6 months'));
  const hasGLP1Late   = (ans.cause ?? []).some((c) => c.includes('after 6 months'));
  const hasNoVisibleFall = /thinning|no visible fall/i.test(count);

  const isPregnant =
    s.hormonal('pregnant') || s.hormonal('Pregnancy') || s.cause('Currently pregnant');

  const isVeg = (ans.diet ?? []).some(
    (d) => d.includes('Vegetarian') || d.includes('Vegan') || d.includes('Jain')
  );

  // Active shedding = not a regrow-only goal, not thinning-only, plus at least one shedding signal.
  const hasActiveShedding =
    !isRegrowGoal &&
    !hasNoVisibleFall &&
    (count.includes('50') ||
      count.includes('100') ||
      count.includes('Noticeable') ||
      /1[–-]3|3[–-]6/.test(duration) ||
      s.cause('Stress') || s.cause('Anxiety') || s.cause('Depression') ||
      s.cause('Nutritional') || s.cause('Medication') ||
      s.cause('Illness') || s.cause('Surgery'));

  return {
    isRegrowGoal,
    hasGreyGoal,
    hasHairGoal,
    isVeg,
    isMale: ans.sex === 'Male',
    isPregnant,
    isGrade45,
    isGrade123,
    hasActiveShedding,
    hasNoVisibleFall,
    hasGLP1Early,
    hasGLP1Late,
    age: parseInt(String(ans.age), 10) || 25,
    goal: rawGoal,
    grade,
    count,
    duration,
  };
}
