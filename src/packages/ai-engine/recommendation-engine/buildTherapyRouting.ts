import type { RecommendationContext } from './types';

export type ClinicalProfile = RecommendationContext & {
  readonly isAdvancedGrade?: boolean;
  readonly isSevereGrade?: boolean;
  readonly isChronic?: boolean;
  readonly hasHighDhtBurden?: boolean;
  readonly isAggressiveProgression?: boolean;
  readonly isLowExpectedResponse?: boolean;
};

export type TherapyNeed = 
  | 'SHEDDING_ARREST' 
  | 'INFLAMMATION_CONTROL' 
  | 'METABOLIC_SUPPORT' 
  | 'DHT_SUPPRESSION' 
  | 'FOLLICLE_STIMULATION';

export type HairFactProtocol = 
  | 'HAIR_FACT_TE' 
  | 'PHENOTYPE_INFLAMMATION' 
  | 'PROFACT_META_B' 
  | 'MPHL' 
  | 'FPHL';

export interface TherapyRoutingResult {
  readonly primaryProtocols: readonly HairFactProtocol[];
  readonly secondaryProtocols: readonly HairFactProtocol[];
  readonly rationale: readonly string[];
  readonly triggeredNeeds: readonly TherapyNeed[];
  readonly routingTrace: readonly string[];
}

export const buildTherapyRouting = (
  needs: readonly TherapyNeed[],
  profile: ClinicalProfile
): TherapyRoutingResult => {
  const primaryProtocols: HairFactProtocol[] = [];
  const secondaryProtocols: HairFactProtocol[] = [];
  const rationale: string[] = [];
  const routingTrace: string[] = [];

  const addProtocol = (need: TherapyNeed, protocol: HairFactProtocol, isPrimary: boolean) => {
    if (isPrimary && !primaryProtocols.includes(protocol)) primaryProtocols.push(protocol);
    if (!isPrimary && !secondaryProtocols.includes(protocol)) secondaryProtocols.push(protocol);
    rationale.push(`Selected ${protocol} for ${need}`);
    routingTrace.push(`${need} -> ${protocol}`);
  };

  for (const need of needs) {
    switch (need) {
      case 'SHEDDING_ARREST':
        addProtocol(need, 'HAIR_FACT_TE', true);
        break;
      case 'INFLAMMATION_CONTROL':
        addProtocol(need, 'PHENOTYPE_INFLAMMATION', true);
        break;
      case 'METABOLIC_SUPPORT':
        addProtocol(need, 'PROFACT_META_B', false);
        break;
      case 'DHT_SUPPRESSION':
        addProtocol(need, 'MPHL', true);
        break;
      case 'FOLLICLE_STIMULATION':
        addProtocol(need, 'FPHL', true);
        break;
      default:
        const exhaustiveCheck: never = need;
        return exhaustiveCheck;
    }
  }

  return {
    primaryProtocols,
    secondaryProtocols,
    rationale,
    triggeredNeeds: needs,
    routingTrace
  };
};
