/**
 * Deterministic pathway activator.
 *
 * Activation model (registry-grounded):
 *
 *   raw = Σ(weight × confidence) over requiredSignals + supportingSignals
 *        − Σ(|weight| × confidence) over inhibitorySignals
 *
 *   activation = clamp01( raw / saturationDenominator )
 *
 *   gate (required-any): activation = 0 if no required signal meets minConfidence.
 *   gate (required-aggregate): activation scaled by Σ confidence of required signals.
 *   gate (modulator-no-gate): no gate, raw / saturation applied directly.
 *
 *   Then amplifiedBy is applied IF the named co-pathway is itself active
 *   (computed in two passes).
 */

import { ActivatedPathway, ExtractedSignal } from "../types";
import { loadRegistries, PathwayEntry } from "./registryLoader";

const SATURATION = 2.5; // empirical denominator so a single strong required-signal + 2 supporting reaches ~0.8

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

function gatePasses(p: PathwayEntry, sigMap: Map<string, number>): boolean {
  if (p.activationRules.gateMode === "modulator-no-gate") return true;
  const required = p.requiredSignals;
  if (required.length === 0) return true;
  if (p.activationRules.gateMode === "required-aggregate") {
    let agg = 0;
    for (const r of required) agg += sigMap.get(r.signalId) ?? 0;
    return agg >= 0.4;
  }
  // required-any (default)
  for (const r of required) {
    const c = sigMap.get(r.signalId) ?? 0;
    const min = r.minConfidence ?? 0.4;
    if (c >= min) return true;
  }
  return false;
}

function rawScore(p: PathwayEntry, sigMap: Map<string, number>): { score: number; contributors: string[] } {
  let s = 0;
  const contributors: string[] = [];
  for (const r of p.requiredSignals) {
    const c = sigMap.get(r.signalId) ?? 0;
    if (c > 0) { s += r.weight * c; contributors.push(r.signalId); }
  }
  for (const r of p.supportingSignals) {
    const c = sigMap.get(r.signalId) ?? 0;
    if (c > 0) { s += r.weight * c; contributors.push(r.signalId); }
  }
  for (const r of (p.inhibitorySignals ?? [])) {
    const c = sigMap.get(r.signalId) ?? 0;
    if (c > 0) s += r.weight * c; // weight is already negative
  }
  return { score: s, contributors };
}

export function activatePathways(signals: ExtractedSignal[]): ActivatedPathway[] {
  const { pathways } = loadRegistries();

  const sigMap = new Map<string, number>();
  for (const s of signals) sigMap.set(s.signalId, s.confidence);

  // Pass 1: raw activations
  const pass1 = new Map<string, { activation: number; contributors: string[] }>();
  for (const p of pathways.values()) {
    if (!gatePasses(p, sigMap)) {
      pass1.set(p.id, { activation: 0, contributors: [] });
      continue;
    }
    const { score, contributors } = rawScore(p, sigMap);
    pass1.set(p.id, { activation: clamp01(score / SATURATION), contributors });
  }

  // Pass 2: amplification (only if amplifier itself is co-active ≥0.3)
  const result: ActivatedPathway[] = [];
  for (const p of pathways.values()) {
    const base = pass1.get(p.id)!;
    let amplified = base.activation;
    for (const amp of (p.activationRules.amplifiedBy ?? [])) {
      const coActivation = pass1.get(amp.pathwayId)?.activation ?? 0;
      const threshold = amp.when === "co-dominant" ? 0.5 : 0.3;
      if (coActivation >= threshold) amplified = clamp01(amplified + amp.magnitude * coActivation);
    }
    result.push({
      pathwayId: p.id,
      activation: Number(amplified.toFixed(4)),
      contributingSignals: base.contributors,
    });
  }

  return result.sort((a, b) => b.activation - a.activation || a.pathwayId.localeCompare(b.pathwayId));
}
