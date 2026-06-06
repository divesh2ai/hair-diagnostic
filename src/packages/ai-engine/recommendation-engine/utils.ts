import { 
  BaseRecommendation, 
  ContraindicationWarning, 
  ProcedureRecommendation 
} from './types';
import { SEVERITY_MULTIPLIERS, EXPECTED_RESPONSE_WINDOWS } from './constants';

export const dedupeRecommendations = <T extends { readonly id: string }>(
  recommendations: readonly T[]
): readonly T[] => {
  const seen = new Set<string>();
  return recommendations.filter(rec => {
    if (seen.has(rec.id)) return false;
    seen.add(rec.id);
    return true;
  });
};

export const sortByPriority = <T extends { readonly severityModifier: number }>(
  recommendations: readonly T[]
): readonly T[] => {
  return [...recommendations].sort((a, b) => b.severityModifier - a.severityModifier);
};

export const mergeContraindications = (
  warningsA: readonly ContraindicationWarning[],
  warningsB: readonly ContraindicationWarning[]
): readonly ContraindicationWarning[] => {
  const combined = [...warningsA, ...warningsB];
  const uniqueKeys = new Set<string>();
  
  return combined.filter(warning => {
    const key = `${warning.recommendationId}-${warning.conditionOrMedication}`;
    if (uniqueKeys.has(key)) return false;
    uniqueKeys.add(key);
    return true;
  });
};

export const calculateSeverityModifier = (severityLevel: string): number => {
  const level = severityLevel.toUpperCase();
  return SEVERITY_MULTIPLIERS.get(level) ?? 1.0;
};

export const calculateExpectedResponseWindow = (responderType: string): number => {
  const type = responderType.toUpperCase() as keyof typeof EXPECTED_RESPONSE_WINDOWS;
  return EXPECTED_RESPONSE_WINDOWS[type] ?? EXPECTED_RESPONSE_WINDOWS.AVERAGE_RESPONDER;
};

export const normalizeFrequency = (frequency: string): string => {
  return frequency.trim().toUpperCase().replace(/[\s-]/g, '_');
};

export const buildMechanismSummary = (recommendations: readonly BaseRecommendation[]): string => {
  return recommendations
    .map(rec => rec.mechanism)
    .filter(Boolean)
    .join('; ');
};

export const buildEvidenceSummary = (recommendations: readonly BaseRecommendation[]): string => {
  const highCount = recommendations.filter(r => r.evidenceLevel === 'High').length;
  const mediumCount = recommendations.filter(r => r.evidenceLevel === 'Medium').length;
  const lowCount = recommendations.filter(r => r.evidenceLevel === 'Low').length;
  
  return `Evidence profile: ${highCount} High, ${mediumCount} Medium, ${lowCount} Low.`;
};

export const estimateRegrowthProbability = (
  baseProbability: number, 
  severityModifier: number, 
  adherenceFactor: number
): number => {
  if (severityModifier === 0) return 0;
  const adjusted = (baseProbability / severityModifier) * adherenceFactor;
  return Math.min(Math.max(adjusted, 0), 100);
};

export const filterPregnancyUnsafe = <T extends { readonly contraindications: readonly string[] }>(
  recommendations: readonly T[]
): readonly T[] => {
  return recommendations.filter(rec => {
    const isUnsafe = rec.contraindications.some(c => 
      c.toLowerCase().includes('pregnan') || 
      c.toLowerCase().includes('nursing') ||
      c.toLowerCase().includes('breastfeeding')
    );
    return !isUnsafe;
  });
};

export const resolveProcedureConflicts = (
  procedures: readonly ProcedureRecommendation[],
  compatibilityMap: ReadonlyMap<string, readonly string[]>
): readonly ProcedureRecommendation[] => {
  const resolved: ProcedureRecommendation[] = [];
  
  for (const proc of procedures) {
    const procType = proc.procedureType.toUpperCase();
    const canAdd = resolved.every(existing => {
      const existingType = existing.procedureType.toUpperCase();
      const allowedForExisting = compatibilityMap.get(existingType) ?? [];
      return allowedForExisting.includes('ALL') || allowedForExisting.includes(procType);
    });
    
    if (canAdd) {
      resolved.push(proc);
    }
  }
  
  return resolved;
};
