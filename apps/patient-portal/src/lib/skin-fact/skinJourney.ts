export type SkinConcern = 'ACNE' | 'PIGMENTATION' | 'ANTI_AGEING';
export const SKIN_CONCERN_ORDER: readonly SkinConcern[] = ['ACNE', 'PIGMENTATION', 'ANTI_AGEING'];

export interface SkinCommonAnswers {
  name: string;
  age: string;
  gender: string;
  skinType: string;
  sensitiveSkin: string;
}

export interface SkinCommonProfile {
  productType: 'SKIN_FACT';
  intakeType: 'COMMON';
  version: '2.0.0';
  clinicSlug: string;
  sessionId: string;
  answers: SkinCommonAnswers;
  completedAt?: string;
}

export interface SkinFactIntake {
  productType: 'SKIN_FACT';
  version: '1.0.0';
  clinicSlug: string;
  patientSessionId: string;
  intakeId: string;
  selectedConcerns: SkinConcern[];
  currentConcernIndex: number;
  completedConcerns: SkinConcern[];
  assessmentIds: Partial<Record<SkinConcern, string>>;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'SUBMITTED';
  startedAt?: string;
  submittedAt?: string;
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export const emptySkinCommonAnswers = (): SkinCommonAnswers => ({
  name: '',
  age: '',
  gender: '',
  skinType: '',
  sensitiveSkin: '',
});

export function sanitizeSkinCommonAnswers(value: unknown): SkinCommonAnswers {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    name: String(source.name ?? ''),
    age: String(source.age ?? ''),
    gender: String(source.gender ?? ''),
    skinType: String(source.skinType ?? ''),
    sensitiveSkin: String(source.sensitiveSkin ?? ''),
  };
}

export const skinCommonStorageKey = (clinicSlug: string) =>
  `drfact:skin-fact:common:${clinicSlug}`;
export const legacySkinCommonStorageKey = (clinicSlug: string) =>
  `drfact:skin-fact:common-intake:v1:${clinicSlug}`;
export const skinIntakeStorageKey = (clinicSlug: string, patientSessionId: string) =>
  `drfact:skin-fact:intake:${clinicSlug}:${patientSessionId}`;
export const legacyConcernSelectionKey = (clinicSlug: string) =>
  `drfact:skin-fact:concerns:v1:${clinicSlug}`;
export const skinConcernDraftKey = (
  concern: SkinConcern,
  clinicSlug: string,
  intakeId: string,
) => `drfact:skin-fact:${concern.toLowerCase().replace('_', '-')}:${clinicSlug}:${intakeId}`;

export function normalizeSkinConcerns(values: unknown): SkinConcern[] {
  if (!Array.isArray(values)) return [];
  const unique = new Set<SkinConcern>();
  for (const concern of SKIN_CONCERN_ORDER) {
    if (values.includes(concern)) unique.add(concern);
  }
  return [...unique];
}

export function migrateSelectedConcerns(value: unknown): SkinConcern[] {
  if (!value || typeof value !== 'object') return [];
  const source = value as Record<string, unknown>;
  const selected = normalizeSkinConcerns(source.selectedConcerns);
  if (selected.length) return selected;
  return normalizeSkinConcerns([
    source.primaryConcern,
    source.additionalConcern,
    ...(Array.isArray(source.additionalConcerns) ? source.additionalConcerns : []),
  ]);
}

export function isValidSkinCommonProfile(
  value: unknown,
  clinicSlug: string,
): value is SkinCommonProfile {
  if (!value || typeof value !== 'object') return false;
  const profile = value as Partial<SkinCommonProfile>;
  const answers = profile.answers as Partial<SkinCommonAnswers> | undefined;
  return profile.productType === 'SKIN_FACT'
    && profile.intakeType === 'COMMON'
    && profile.version === '2.0.0'
    && profile.clinicSlug === clinicSlug
    && typeof profile.sessionId === 'string'
    && !!answers
    && typeof answers.name === 'string'
    && typeof answers.age === 'string'
    && typeof answers.gender === 'string'
    && typeof answers.skinType === 'string'
    && typeof answers.sensitiveSkin === 'string';
}

export function loadSkinCommonProfile(
  storage: StorageLike,
  clinicSlug: string,
): SkinCommonProfile | null {
  try {
    const current = JSON.parse(storage.getItem(skinCommonStorageKey(clinicSlug)) ?? 'null');
    if (isValidSkinCommonProfile(current, clinicSlug)) return { ...current, answers: sanitizeSkinCommonAnswers(current.answers) };
    const legacy = JSON.parse(storage.getItem(legacySkinCommonStorageKey(clinicSlug)) ?? 'null');
    if (!legacy || typeof legacy !== 'object') return null;
    const source = legacy as Record<string, any>;
    if (source.productType !== 'SKIN_FACT' || source.clinicSlug !== clinicSlug || !source.answers) return null;
    const migrated: SkinCommonProfile = {
      productType: 'SKIN_FACT',
      intakeType: 'COMMON',
      version: '2.0.0',
      clinicSlug,
      sessionId: typeof source.sessionId === 'string' ? source.sessionId : crypto.randomUUID(),
      completedAt: typeof source.completedAt === 'string' ? source.completedAt : undefined,
      answers: sanitizeSkinCommonAnswers(source.answers),
    };
    storage.setItem(skinCommonStorageKey(clinicSlug), JSON.stringify(migrated));
    return migrated;
  } catch {
    return null;
  }
}

export function isValidSkinFactIntake(
  value: unknown,
  clinicSlug: string,
  patientSessionId: string,
): value is SkinFactIntake {
  if (!value || typeof value !== 'object') return false;
  const intake = value as Partial<SkinFactIntake>;
  const selected = normalizeSkinConcerns(intake.selectedConcerns);
  const completed = normalizeSkinConcerns(intake.completedConcerns);
  return intake.productType === 'SKIN_FACT'
    && intake.version === '1.0.0'
    && intake.clinicSlug === clinicSlug
    && intake.patientSessionId === patientSessionId
    && typeof intake.intakeId === 'string'
    && selected.length >= 1
    && selected.length <= 3
    && selected.length === (intake.selectedConcerns?.length ?? 0)
    && completed.every((concern) => selected.includes(concern))
    && Number.isInteger(intake.currentConcernIndex)
    && Number(intake.currentConcernIndex) >= 0
    && Number(intake.currentConcernIndex) < selected.length;
}

export function loadSkinFactIntake(
  storage: StorageLike,
  clinicSlug: string,
  patientSessionId: string,
): SkinFactIntake | null {
  try {
    const current = JSON.parse(
      storage.getItem(skinIntakeStorageKey(clinicSlug, patientSessionId)) ?? 'null',
    );
    if (isValidSkinFactIntake(current, clinicSlug, patientSessionId)) return current;
    const legacy = JSON.parse(storage.getItem(legacyConcernSelectionKey(clinicSlug)) ?? 'null');
    const selectedConcerns = migrateSelectedConcerns(legacy);
    if (!selectedConcerns.length) return null;
    const migrated = createSkinFactIntake(clinicSlug, patientSessionId, selectedConcerns);
    storage.setItem(skinIntakeStorageKey(clinicSlug, patientSessionId), JSON.stringify(migrated));
    return migrated;
  } catch {
    return null;
  }
}

export function createSkinFactIntake(
  clinicSlug: string,
  patientSessionId: string,
  selectedConcerns: SkinConcern[],
  existing?: SkinFactIntake | null,
): SkinFactIntake {
  const selected = normalizeSkinConcerns(selectedConcerns);
  if (!selected.length) throw new Error('Select at least one concern to continue.');
  const completed = normalizeSkinConcerns(existing?.completedConcerns)
    .filter((concern) => selected.includes(concern));
  const nextIndex = Math.max(0, selected.findIndex((concern) => !completed.includes(concern)));
  return {
    productType: 'SKIN_FACT',
    version: '1.0.0',
    clinicSlug,
    patientSessionId,
    intakeId: existing?.intakeId ?? crypto.randomUUID(),
    selectedConcerns: selected,
    currentConcernIndex: nextIndex === -1 ? selected.length - 1 : nextIndex,
    completedConcerns: completed,
    assessmentIds: existing?.assessmentIds ?? {},
    status: existing?.status ?? 'NOT_STARTED',
    startedAt: existing?.startedAt,
    submittedAt: existing?.submittedAt,
  };
}

export function concernRoute(clinicSlug: string, concern: SkinConcern) {
  if (concern === 'ACNE') return `/q/${clinicSlug}/skin/acne`;
  if (concern === 'PIGMENTATION') return `/q/${clinicSlug}/skin/pigmentation`;
  return `/q/${clinicSlug}/skin/anti-ageing`;
}

export function activeConcern(intake: SkinFactIntake): SkinConcern {
  return intake.selectedConcerns[intake.currentConcernIndex] ?? intake.selectedConcerns[0];
}

export function markConcernComplete(
  intake: SkinFactIntake,
  concern: SkinConcern,
  assessmentId: string,
): SkinFactIntake {
  const completedConcerns = normalizeSkinConcerns([...intake.completedConcerns, concern]);
  const nextIndex = intake.selectedConcerns.findIndex((item) => !completedConcerns.includes(item));
  const done = nextIndex === -1;
  return {
    ...intake,
    completedConcerns,
    assessmentIds: { ...intake.assessmentIds, [concern]: assessmentId },
    currentConcernIndex: done ? intake.selectedConcerns.length - 1 : nextIndex,
    status: done ? 'SUBMITTED' : 'IN_PROGRESS',
    submittedAt: done ? new Date().toISOString() : undefined,
  };
}

export function nextIncompleteConcern(intake: SkinFactIntake): SkinConcern | null {
  return intake.selectedConcerns.find((concern) => !intake.completedConcerns.includes(concern)) ?? null;
}
