/**
 * Orchestration instrumentation.
 *
 * Per-stage timing, query count, and external-call count. Emitted to console
 * as a single structured line per stage and persisted on each OrchestrationLog
 * row's `metadata` field so production performance can be audited from SQL.
 *
 * Designed to be cheap: integer counters, monotonic clock, no async work.
 * Wrap Prisma calls with `ctx.tick("db")` and external HTTP with
 * `ctx.tick("external")` to attribute cost to the right bucket.
 */

import type { Prisma } from "@prisma/client";

export interface StageMetrics {
  stage: string;
  startedAt: number;
  endedAt: number | null;
  durationMs: number | null;
  dbCalls: number;
  externalCalls: number;
  cpuCalls: number;
  notes: Record<string, unknown>;
}

export interface PhaseMetrics {
  phase: "A" | "B";
  startedAt: number;
  endedAt: number | null;
  durationMs: number | null;
  stages: StageMetrics[];
}

export class StageTimer {
  private metrics: StageMetrics;
  constructor(stage: string) {
    this.metrics = {
      stage,
      startedAt: Date.now(),
      endedAt: null,
      durationMs: null,
      dbCalls: 0,
      externalCalls: 0,
      cpuCalls: 0,
      notes: {},
    };
  }
  tick(bucket: "db" | "external" | "cpu", n = 1): void {
    if (bucket === "db") this.metrics.dbCalls += n;
    else if (bucket === "external") this.metrics.externalCalls += n;
    else this.metrics.cpuCalls += n;
  }
  note(key: string, value: unknown): void {
    this.metrics.notes[key] = value;
  }
  finish(): StageMetrics {
    this.metrics.endedAt = Date.now();
    this.metrics.durationMs = this.metrics.endedAt - this.metrics.startedAt;
    return this.metrics;
  }
  asMetadata(): Prisma.InputJsonValue {
    return {
      dbCalls: this.metrics.dbCalls,
      externalCalls: this.metrics.externalCalls,
      cpuCalls: this.metrics.cpuCalls,
      ...this.metrics.notes,
    } as Prisma.InputJsonValue;
  }
}

export class PhaseRecorder {
  readonly metrics: PhaseMetrics;
  constructor(phase: "A" | "B") {
    this.metrics = {
      phase,
      startedAt: Date.now(),
      endedAt: null,
      durationMs: null,
      stages: [],
    };
  }
  record(stage: StageMetrics): void {
    this.metrics.stages.push(stage);
  }
  finish(): PhaseMetrics {
    this.metrics.endedAt = Date.now();
    this.metrics.durationMs = this.metrics.endedAt - this.metrics.startedAt;
    return this.metrics;
  }
}

/**
 * Single-line structured log per stage. Format chosen so a `grep '[ORCH-STAGE]'`
 * over Vercel logs yields a parseable stream — every entry has the same keys.
 */
export function logStage(assessmentId: string, m: StageMetrics): void {
  console.log(
    `[ORCH-STAGE] ${m.stage} ${m.durationMs}ms` +
      ` db=${m.dbCalls} ext=${m.externalCalls} cpu=${m.cpuCalls}` +
      ` assessment=${assessmentId}`,
  );
}

export function logPhase(assessmentId: string, m: PhaseMetrics): void {
  console.log(
    `[ORCH-PHASE] phase=${m.phase} ${m.durationMs}ms` +
      ` stages=${m.stages.length}` +
      ` assessment=${assessmentId}`,
  );
}
