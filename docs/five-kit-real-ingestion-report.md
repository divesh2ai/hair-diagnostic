# Five-kit real ingestion report

Generated: 2026-08-03T05:40:38.026Z

## Safety outcome

- Production publication: **NO**
- Imported lifecycle: **DRAFT / AWAITING_REVIEW**
- Extractor: `five-kit-ooxml/1.0.0`
- Source fingerprints: `MRP sheet fluence khushal's copy.xlsx` = `7d60d0cf984b7ada0ed7c96b76ee9e32372e51f49808cd795dc94c8b9c7227f9`; `All Kits  Info.docx` = `ced944ac2532207a8e9b2c32387862bce727d49b8c318650170f12f65f4860be`

## Files and workbook scope

- Files processed: 2
- Primary sheets processed: Individual products MRP; New MRP of kits; Complete formulation
- Non-authoritative sheets inspected for conflicts: Copy of New MRP of kits; Copy of Complete formulation; New kits in working; DO NOT CONSIDER 1; New kits track (temp)

## Results

| Metric | Count |
|---|---:|
| kits | 8 |
| products | 27 |
| aliases | 161 |
| prices | 72 |
| components | 64 |
| formulationRows | 265 |
| chunks | 42 |
| claims | 49 |
| claimsBlocked | 49 |
| conflicts | 14 |
| missingValues | 449 |
| formulaErrors | 0 |
| exactMatches | 64 |
| ambiguousMatches | 1 |
| unmatchedProducts | 0 |

## Governance reconciliation

- Raw missing values: 449
- Route nulls reclassified as not required for publication: 382
- Publication-blocking quantity gaps: 67
- Consolidated conflict groups: 11 from 14 conflict impacts
- Claims awaiting authorized HairOS replacement: 49
- Price records intentionally parked: 400
- Meta B canonical status: RESOLVED

All extracted facts, chunks and claims remain blocked from patient retrieval until explicit governed review and publication.