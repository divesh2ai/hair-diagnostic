# HAiROS — Read-Only Reconciliation Ledger (26 assessments)

**Source:** production `pykoyxbleowxwechotth`, SELECT-only snapshot 2026-11-02. **No rows were modified.**
**PII redaction:** `asmt` = last 6 chars of assessment id; `patient` = first 6 chars of `md5(patientId)`
(stable, non-reversible). No names/phones extracted.

Legend: `ccF/ccS` = consultation-stage OrchestrationLog FAILED/SUCCESS counts · `cons` = Consultation row
exists · `appr` = current-version approval status · `assets` = ReportAsset rows · `rdy` = READY assets ·
`pngQ` = QUEUED ONE_PAGER_PNG · `pdfR` = READY PDF · `noMeta` = READY assets missing sha256/byteSize ·
`kit` = KitOrderIntent exists · `wa` = WhatsappDelivery exists.

| Day | Clinic | asmt | patient | Status | reviewer | cons | appr | ccF | ccS | assets | rdy | pngQ | pdfR | noMeta | kit | wa |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 10-15 | acube-aesthetics | p9tfm7 | ae98a1 | COMPLETED | Y | Y | APPROVED | 1 | 1 | 1 | 0 | 1 | 0 | 0 | Y | N |
| 10-15 | acube-aesthetics | lhahyr | 6a8810 | COMPLETED | Y | Y | APPROVED | 1 | 1 | 2 | 1 | 1 | 1 | 1 | Y | N |
| 10-15 | acube-aesthetics | dox8mo | 21a8a7 | COMPLETED | Y | Y | APPROVED | 1 | 1 | 1 | 0 | 1 | 0 | 0 | Y | **Y** |
| 10-15 | acube-aesthetics | yiaa4y | d76845 | COMPLETED | Y | Y | APPROVED | 1 | 1 | 1 | 0 | 1 | 0 | 0 | Y | N |
| 10-16 | tressze-clinic | 2pxakt | 763793 | COMPLETED | Y | Y | APPROVED | 1 | 1 | 1 | 0 | 1 | 0 | 0 | Y | N |
| 10-16 | tressze-clinic | l4726j | 358595 | COMPLETED | N | Y | PENDING_REVIEW | 1 | 1 | 0 | 0 | 0 | 0 | 0 | N | N |
| 10-16 | tressze-clinic | wc11gf | 01dee6 | COMPLETED | N | N | — | 1 | 1 | 0 | 0 | 0 | 0 | 0 | N | N |
| 10-21 | acube-aesthetics | kunzpr | 165058 | COMPLETED | N | Y | PENDING_REVIEW | 1 | 1 | 0 | 0 | 0 | 0 | 0 | N | N |
| 10-21 | acube-aesthetics | hsa4yh | d17c34 | COMPLETED | Y | Y | APPROVED | 1 | 1 | 2 | 1 | 1 | 1 | 1 | Y | N |
| 10-21 | bala-clinic | 9bdrfs | 3815de | COMPLETED | N | N | — | 1 | 1 | 0 | 0 | 0 | 0 | 0 | N | N |
| 10-22 | tressze-clinic | kuq0kn | 575da0 | COMPLETED | Y | Y | APPROVED | 1 | 1 | 1 | 0 | 1 | 0 | 0 | Y | N |
| 10-23 | acube-aesthetics | xeqiqz | 9c7a61 | COMPLETED | N | N | — | 1 | 1 | 0 | 0 | 0 | 0 | 0 | N | N |
| 10-23 | radiance… | q6ihq5 | 1b18a4 | COMPLETED | Y | Y | APPROVED | 1 | 1 | 2 | 1 | 1 | 1 | 1 | Y | N |
| 10-24 | gh-derma-center | foq7x1 | 25a2e5 | COMPLETED | Y | Y | APPROVED | 1 | 1 | 1 | 0 | 1 | 0 | 0 | Y | N |
| 10-24 | radiance… | 32j4co | d2b581 | COMPLETED | Y | Y | APPROVED | 1 | 1 | 2 | 1 | 1 | 1 | 1 | Y | N |
| 10-28 | radiance… | oekp10 | d23ac0 | COMPLETED | Y | Y | APPROVED | 1 | 1 | 2 | 1 | 1 | 1 | 1 | Y | N |
| 10-29 | acube-aesthetics | 82g9va | d735bb | COMPLETED | N | Y | PENDING_REVIEW | 1 | 1 | 0 | 0 | 0 | 0 | 0 | N | N |
| 10-29 | radiance… | cst8w2 | ef2f5a | COMPLETED | N | Y | APPROVED | 1 | 1 | 1 | 1 | 0 | 1 | 1 | N | N |
| **10-30** | **dr-aggarwals-clinic** | **cvge0v** | c7386f | COMPLETED | N | **N** | — | 1 | 1 | **0** | 0 | 0 | 0 | 0 | N | N |
| **10-30** | **dr-aggarwals-clinic** | **kgcs8c** | 9f4ff7 | COMPLETED | N | **N** | — | 1 | 1 | **0** | 0 | 0 | 0 | 0 | N | N |
| **10-31** | **acube-aesthetics** | **9fsx24** | d0f66c | COMPLETED | N | **N** | — | 1 | 1 | **0** | 0 | 0 | 0 | 0 | N | N |
| **10-31** | **acube-aesthetics** | **45od6m** | 4af93d | COMPLETED | N | **N** | — | 1 | 1 | **0** | 0 | 0 | 0 | 0 | N | N |
| **10-31** | **acube-aesthetics** | **uh9cs1** | adee1d | COMPLETED | N | **N** | — | 1 | 1 | **0** | 0 | 0 | 0 | 0 | N | N |
| 10-31 | radiance… | 9lpf9m | 36a969 | COMPLETED | Y | Y | APPROVED | 1 | 1 | 1 | 0 | 1 | 0 | 0 | Y | N |
| **10-31** | **radiance…** | **e210z8** | ea60cd | COMPLETED | N | **N** | — | 1 | 1 | **0** | 0 | 0 | 0 | 0 | N | N |
| **10-31** | **radiance…** | **2qsdeo** | 6469ae | COMPLETED | N | **N** | — | 1 | 1 | **0** | 0 | 0 | 0 | 0 | N | N |

`radiance…` = `radiance-skin-hair-cosmetic-center`. **Bold rows** = the 7 priority no-asset cases.

## Roll-up

- **26/26** assessments: `ccF=1, ccS=1` → every assessment hit the consultation-stage false denial (§1 of the report).
- **Consultations present: 16** · missing: **10** (`wc11gf, 9bdrfs, xeqiqz, cvge0v, kgcs8c, 9fsx24, 45od6m, uh9cs1, e210z8, 2qsdeo`).
- **No ReportAsset rows: 13** · **No READY asset: 20** · **READY present: 6** (`lhahyr, hsa4yh, q6ihq5, 32j4co, oekp10, cst8w2`).
- **Every READY asset has `noMeta=1`** → all 6 READY PDFs are missing `sha256` + `byteSize` (integrity backfill required, from real bytes).
- **QUEUED ONE_PAGER_PNG: 12** (the `pngQ=1` rows) — zero attempts, no lease (worker never claimed; §3).
- **WhatsApp deliveries: 1** (`dox8mo`, acube) — provider `dev_accepted`, no reportAssetId, no deliveredAt.
- **Approval states:** 13 APPROVED · 3 PENDING_REVIEW (`l4726j, kunzpr, 82g9va`) · 10 none (no consultation).

## Interpretation

A row is **genuinely report-ready only if** it has a persisted consultation, an APPROVED current version,
and a READY report asset with real integrity metadata. **Zero rows meet all three today** (the 6 with a READY
PDF still lack sha256/byteSize). No assessment may be presented as fully report-ready until those artifacts
actually exist.
