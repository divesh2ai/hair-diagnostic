/**
 * mapTherapyToMechanisms
 *
 * Resolves a list of TherapyNeeds to their mechanistic descriptions.
 * Used by the narrative engine and doctor dashboard for building
 * clinical rationale sections.
 */

import type { TherapyNeed, TherapyMechanism } from '../types';
import { getTherapyKnowledge } from '../retrievers/getTherapyKnowledge';

export interface TherapyMechanismMap {
  readonly therapyNeed: TherapyNeed;
  readonly displayName: string;
  readonly mechanisms: readonly TherapyMechanism[];
  readonly clinicalRationale: string;
}

export function mapTherapyToMechanisms(
  therapyNeed: TherapyNeed
): TherapyMechanismMap | null {
  const result = getTherapyKnowledge(therapyNeed);
  if (!result.found || result.data === null) return null;

  return {
    therapyNeed,
    displayName: result.data.displayName,
    mechanisms: result.data.mechanisms,
    clinicalRationale: result.data.clinicalRationale,
  };
}

/**
 * Maps multiple therapy needs at once. Returns only resolved entries.
 */
export function mapTherapyNeedsToMechanisms(
  needs: readonly TherapyNeed[]
): readonly TherapyMechanismMap[] {
  return needs
    .map(mapTherapyToMechanisms)
    .filter((m): m is TherapyMechanismMap => m !== null);
}
