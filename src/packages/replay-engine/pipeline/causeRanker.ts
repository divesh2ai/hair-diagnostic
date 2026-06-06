/**
 * Bayesian cause ranker per Cause Registry §designNotes:
 *
 *   logScore(cause) = log(prior)
 *                   + Σ pathway LLR × activation     (only if activation ≥ minActivation)
 *                   + Σ signal LLR × confidence
 *
 *   posterior = softmax over logScores
 *
 *   dissent = posterior(top1) − posterior(top2)
 *
 *   compositeRule: multifactorial-hair-loss promotes to lead when
 *   ≥ N pathways exceed activation floor AND single-cause dissent < gap.
 */

import { ActivatedPathway, CausePosterior, ExtractedSignal } from "../types";
import { loadRegistries } from "./registryLoader";

const MULTI_ID = "multifactorial-hair-loss";

function softmax(xs: number[]): number[] {
  const max = Math.max(...xs);
  const exps = xs.map((x) => Math.exp(x - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

export function rankCauses(
  signals: ExtractedSignal[],
  pathways: ActivatedPathway[]
): { posteriors: CausePosterior[]; dissent: number; compositeRuleSatisfied: boolean } {
  const { causesOrdered } = loadRegistries();

  const sigConf = new Map<string, number>();
  for (const s of signals) sigConf.set(s.signalId, s.confidence);

  const pwAct = new Map<string, number>();
  for (const p of pathways) pwAct.set(p.pathwayId, p.activation);

  const logScores = causesOrdered.map((cause) => {
    let s = Math.log(Math.max(cause.priorProbability, 1e-6));
    for (const cp of cause.contributingPathways) {
      const act = pwAct.get(cp.pathwayId) ?? 0;
      if (act >= cp.minActivation) s += cp.logLikelihoodRatio * act;
      // else: no contribution — note negative LLRs (exclusionary/competing)
      //       still need to fire when the gating pathway is active enough.
      else if (cp.logLikelihoodRatio < 0 && act >= 0.5) s += cp.logLikelihoodRatio * act;
    }
    for (const cs of cause.contributingSignals) {
      const conf = sigConf.get(cs.signalId) ?? 0;
      if (conf > 0) s += cs.logLikelihoodRatio * conf;
    }
    return s;
  });

  const postArr = softmax(logScores);
  let posteriors: CausePosterior[] = causesOrdered.map((c, i) => ({
    causeId: c.id,
    logScore: Number(logScores[i]!.toFixed(4)),
    posterior: Number(postArr[i]!.toFixed(4)),
  }));

  posteriors = posteriors.sort((a, b) => b.posterior - a.posterior);

  // Composite-rule promotion
  const multi = causesOrdered.find((c) => c.id === MULTI_ID);
  let compositeRuleSatisfied = false;
  if (multi?.compositeRule) {
    const activeCount = pathways.filter((p) => p.activation >= multi.compositeRule!.minimumPathwayActivation).length;
    const top1 = posteriors[0]!;
    const top2 = posteriors[1] ?? { posterior: 0 };
    const gap = top1.posterior - top2.posterior;
    if (activeCount >= multi.compositeRule.minimumActivePathways &&
        gap < multi.compositeRule.minimumDissentBetweenTopTwoCauses) {
      compositeRuleSatisfied = true;
      const idx = posteriors.findIndex((p) => p.causeId === MULTI_ID);
      if (idx > 0) {
        const [m] = posteriors.splice(idx, 1);
        posteriors.unshift(m!);
      }
    }
  }

  const top1 = posteriors[0]!.posterior;
  const top2 = posteriors[1]?.posterior ?? 0;
  const dissent = Number((top1 - top2).toFixed(4));

  return { posteriors, dissent, compositeRuleSatisfied };
}
