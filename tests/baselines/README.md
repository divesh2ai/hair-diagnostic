# Baseline Snapshots

Structured regression baselines (not PDFs):

- `primaryDiagnosis`, `severity`, `rankedKitIds`, `appliedRules`
- `normalizedProfile` / `orchestration` metadata when generated
- `narratives` hashes

## Generate

```bash
npm run baselines:generate
```

Outputs `{fixtureId}.baseline.json` for every file in `tests/fixtures/patients/`.
