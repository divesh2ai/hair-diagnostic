import { QuestionnaireSubmission, QuestionnaireProfile } from './types';

function extractString(val: unknown, fallback: string = ''): string {
  if (typeof val === 'string') return val;
  return fallback;
}

function extractNumber(val: unknown, fallback: number = 0): number {
  if (typeof val === 'number' && !isNaN(val)) return val;
  if (typeof val === 'string') {
    const parsed = parseFloat(val);
    if (!isNaN(parsed)) return parsed;
  }
  return fallback;
}

function extractBoolean(val: unknown, fallback: boolean = false): boolean {
  if (typeof val === 'boolean') return val;
  if (val === 'true') return true;
  if (val === 'false') return false;
  return fallback;
}

function extractStringArray(val: unknown): ReadonlyArray<string> {
  if (Array.isArray(val)) {
    return val.filter((item): item is string => typeof item === 'string');
  }
  return [];
}

function extractRecord(val: unknown): Readonly<Record<string, string>> {
  if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(val)) {
      if (typeof value === 'string') {
        result[key] = value;
      }
    }
    return result;
  }
  return {};
}

function extractBiologicalSex(val: unknown): 'MALE' | 'FEMALE' | 'UNKNOWN' {
  const str = extractString(val).toUpperCase();
  if (str === 'MALE' || str === 'FEMALE') return str as 'MALE' | 'FEMALE';
  return 'UNKNOWN';
}

function extractScalpCondition(val: unknown): 'NORMAL' | 'OILY' | 'DRY' | 'INFLAMED' | 'UNKNOWN' {
  const str = extractString(val).toUpperCase();
  if (['NORMAL', 'OILY', 'DRY', 'INFLAMED'].includes(str)) {
    return str as 'NORMAL' | 'OILY' | 'DRY' | 'INFLAMED';
  }
  return 'UNKNOWN';
}

function extractStressLevel(val: unknown): 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN' {
  const str = extractString(val).toUpperCase();
  if (['LOW', 'MEDIUM', 'HIGH'].includes(str)) {
    return str as 'LOW' | 'MEDIUM' | 'HIGH';
  }
  return 'UNKNOWN';
}

function extractDietQuality(val: unknown): 'POOR' | 'FAIR' | 'GOOD' | 'UNKNOWN' {
  const str = extractString(val).toUpperCase();
  if (['POOR', 'FAIR', 'GOOD'].includes(str)) {
    return str as 'POOR' | 'FAIR' | 'GOOD';
  }
  return 'UNKNOWN';
}

export async function executeQuestionnaire(
  submission: QuestionnaireSubmission
): Promise<QuestionnaireProfile> {
  return Object.freeze({
    demographics: Object.freeze({
      age: extractNumber(submission['age']),
      biologicalSex: extractBiologicalSex(submission['biologicalSex']),
    }),
    symptoms: Object.freeze({
      primaryConcerns: Object.freeze(extractStringArray(submission['primaryConcerns'])),
      onsetDurationMonths: extractNumber(submission['onsetDurationMonths']),
      scalpCondition: extractScalpCondition(submission['scalpCondition']),
    }),
    patternIndicators: Object.freeze({
      ludwigScale: extractString(submission['ludwigScale'], 'UNKNOWN'),
      norwoodScale: extractString(submission['norwoodScale'], 'UNKNOWN'),
      thinningAreas: Object.freeze(extractStringArray(submission['thinningAreas'])),
    }),
    lifestyleRiskFactors: Object.freeze({
      stressLevel: extractStressLevel(submission['stressLevel']),
      dietQuality: extractDietQuality(submission['dietQuality']),
      smokingStatus: extractBoolean(submission['smokingStatus']),
    }),
    medicalHistoryFlags: Object.freeze({
      familyHistoryOfHairLoss: extractBoolean(submission['familyHistoryOfHairLoss']),
      knownDeficiencies: Object.freeze(extractStringArray(submission['knownDeficiencies'])),
      currentMedications: Object.freeze(extractStringArray(submission['currentMedications'])),
    }),
    labMarkerSummary: Object.freeze(extractRecord(submission['labMarkerSummary'])),
  });
}