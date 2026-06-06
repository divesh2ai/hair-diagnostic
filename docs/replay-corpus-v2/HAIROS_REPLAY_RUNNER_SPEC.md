# HAIROS Replay Runner Spec

**Version:** 1.0.0
**Frozen contract:** `ClinicalReplayRunner@1.0`

The ReplayRunner is the single entry point that takes a
`ClinicalReplayCase` and produces a `ReplayResult` by invoking the
production clinical pipeline. The Runner DOES NOT mock any layer —
it calls the real engines. Mocking is forbidden at runner level.

---

## 1. Interface

```ts
import type { ClinicalReplayCase } from "./HAIROS_REPLAY_CASE_SCHEMA";

export interface ReplayResult {
  caseId: string;
  startedAt: string;          // ISO-8601
  durationMs: number;
  diagnosisResult: DiagnosisResult;
  rootCauseResult: RootCauseResult;
  protocolResult: ProtocolResult;
  monitoringResult: MonitoringResult;
  narrativeResult: NarrativeResult;
  /** Raw signal/pathway intermediates for failure-registry triage. */
  intermediates: {
    extractedSignals: Array<{ signalId: string; confidence: number; primary: boolean }>;
    activatedPathways: Array<{ pathwayId: string; activation: number }>;
    causePosteriors: Array<{ causeId: string; posterior: number }>;
  };
}

export interface ReplayRunner {
  run(c: ClinicalReplayCase): Promise<ReplayResult>;
  runAll(cs: ClinicalReplayCase[]): Promise<ReplayResult[]>;
}
```

---

## 2. Execution sequence

For each case:

1. **Adapt** `questionnaireAnswers` → `ClinicalProfile` via the
   canonical adapter (no bypass).
2. **Extract** signals using the Signal Registry extraction rules.
3. **Activate** pathways using the Pathway Engine.
4. **Rank** causes via the Cause Ranker (Bayesian softmax + compositeRule).
5. **Synthesize** diagnosis using the legacy adapter (parity gate).
6. **Build** protocol via the Recommendation Decision Engine.
7. **Schedule** monitoring via the Monitoring Engine.
8. **Generate** narrative via the Narrative Engine.
9. **Capture** intermediates for triage.

Each step's failure (thrown error) is captured as a structured
`SIGNAL_FAILURE` / `PATHWAY_FAILURE` / … entry — see
[HAIROS_FAILURE_REGISTRY_SPEC.md](./HAIROS_FAILURE_REGISTRY_SPEC.md).

---

## 3. Determinism rules

- Runner MUST seed any randomness (e.g. tiebreakers) with `caseId`.
- Runner MUST NOT read wall-clock time except for `startedAt` and
  `durationMs` (which are excluded from validation hashing).
- Runner MUST refuse to run if any registry has been mutated since
  load (checksum guard).

---

## 4. CLI

```
node scripts/replay-corpus/runReplay.ts [--filter <category|caseId>] \
                                        [--out <reportDir>] \
                                        [--bail-on-critical]
```

Outputs:

- `<reportDir>/replay-results.json` — `ReplayResult[]`
- `<reportDir>/validation.json`     — `CaseValidation[]`
- `<reportDir>/scoreboard.json`     — aggregated scores (see Validation spec)
- `<reportDir>/failure-registry.json`
- Non-zero exit code iff release gates fail (see Release Gate spec) or
  `--bail-on-critical` is set and any `SIGNAL_FAILURE`/`PATHWAY_FAILURE`
  has `severity: "critical"`.

---

## 5. Performance budget

- Single case: ≤ 250 ms p95 on the CI baseline machine.
- Full 200-case sweep: ≤ 60 s wall-clock with single-threaded runner.
- Memory: ≤ 1 GiB RSS.

Budget violations are tracked separately; they do NOT fail the gates
but are reported in `scoreboard.json.performance`.
