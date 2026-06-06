import type { ClinicalProfile, TherapyRoutingResult, HairFactProtocol } from './buildTherapyRouting';
import type { TopicalSupportResult } from './buildTopicalSupport';
import type { ScalpSupportResult } from './buildScalpSupport';
import type { SerumSupportResult } from './buildSerumSupport';
import type { ProcedureSupportResult } from './buildProcedureSupport';

export interface InternalProtocolResult {
  readonly primaryProtocol: HairFactProtocol | null;
  readonly supportProtocols: readonly HairFactProtocol[];
  readonly supportTopicals: TopicalSupportResult | null;
  readonly serumSupport: SerumSupportResult | null;
  readonly scalpSupport: ScalpSupportResult | null;
  readonly procedures: ProcedureSupportResult | null;
}

export const buildInternalProtocol = (
  routing: TherapyRoutingResult,
  profile: ClinicalProfile,
  topicals: TopicalSupportResult | null,
  scalp: ScalpSupportResult | null,
  serum: SerumSupportResult | null,
  procedures: ProcedureSupportResult | null
): InternalProtocolResult => {
  return {
    primaryProtocol: routing.primaryProtocols.length > 0 ? routing.primaryProtocols[0] : null,
    supportProtocols: [...routing.secondaryProtocols, ...routing.primaryProtocols.slice(1)],
    supportTopicals: topicals,
    serumSupport: serum,
    scalpSupport: scalp,
    procedures: procedures
  };
};
