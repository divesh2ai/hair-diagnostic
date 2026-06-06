/**
 * Default ClinicalPipeline implementation backed by the production
 * registries. Deterministic, side-effect-free, no AI.
 */

import {
  ActivatedPathway,
  CausePosterior,
  ClinicalPipeline,
  ClinicalReplayCase,
  DiagnosisResult,
  ExtractedSignal,
  MonitoringResult,
  NarrativeResult,
  ProtocolResult,
} from "../types";
import { buildDiagnosis } from "./diagnosisSynth";
import { rankCauses } from "./causeRanker";
import { activatePathways as activate } from "./pathwayActivator";
import { extractSignals as extract } from "./signalExtractor";
import { buildProtocol as buildP } from "./protocolBuilder";
import { scheduleMonitoring as schedule } from "./monitoringPlanner";
import { composeNarrative as compose } from "./narrativeComposer";

export class RegistryDrivenPipeline implements ClinicalPipeline {
  extractSignals(c: ClinicalReplayCase): ExtractedSignal[] {
    return extract(c);
  }
  activatePathways(signals: ExtractedSignal[]): ActivatedPathway[] {
    return activate(signals);
  }
  rankCauses(
    signals: ExtractedSignal[],
    pathways: ActivatedPathway[]
  ): { posteriors: CausePosterior[]; dissent: number; compositeRuleSatisfied: boolean } {
    return rankCauses(signals, pathways);
  }
  buildDiagnosis(
    c: ClinicalReplayCase,
    posteriors: CausePosterior[],
    pathways: ActivatedPathway[]
  ): DiagnosisResult {
    return buildDiagnosis(c, posteriors, pathways, this.extractSignals(c));
  }
  buildProtocol(
    c: ClinicalReplayCase,
    diag: DiagnosisResult,
    pathways: ActivatedPathway[]
  ): ProtocolResult {
    return buildP(c, diag, pathways);
  }
  scheduleMonitoring(
    c: ClinicalReplayCase,
    diag: DiagnosisResult,
    protocol: ProtocolResult
  ): MonitoringResult {
    return schedule(c, diag, protocol);
  }
  composeNarrative(
    c: ClinicalReplayCase,
    diag: DiagnosisResult,
    protocol: ProtocolResult
  ): NarrativeResult {
    return compose(c, diag, protocol);
  }
}
