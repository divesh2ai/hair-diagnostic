# Kit price reconciliation — 2026-09-08

Source: `KIT ALTERNATE PRICE.xlsx` (uploaded by the clinic, sheet `Sheet1`), authorised by the clinic as the governed source for canonical kit name, permitted budget alternative, and approved selling price for the budget-substitution feature.

## Correction — 2026-09-09

The workbook was re-read directly (openpyxl, both cached-value and formula passes; file `modified` timestamp 2026-09-07 11:20, `lastModifiedBy` "Amit Bhusari" — no formulas, plain authored values) and two rows differ from the table below as originally written:

- **Row 10 (PRO FACT GI GOLD):** the canonical price cell reads **₹3,455**, not ₹3,407 as this document originally recorded. `APPROVED_KIT_PRICES_MINOR.GI_GOLD` has been corrected to `rupeesToMinor(3455)`.
- **Row 24 (HAIR FACT TTM (OCD) → PRO FACT STRESS BUST 3):** the alternative's price cell reads **₹1,457**, not empty as this document originally recorded. This is the 12th approved pair, previously withheld — it is now live: `STRESS_BUST_3` was added as a `CANONICAL_KIT_IDS` entry, a minimal clinical registry entry, an alias for the kit-scorer's raw spelling `"HAIR FACT TTM (OCD)"` → `TTM_SUPPORT`, both prices (`TTM_SUPPORT` ₹2,858 canonical / `STRESS_BUST_3` ₹1,457 alternative), and the pair itself in `APPROVED_SUBSTITUTIONS`.

No other row changed. The table and "Outcome" section below are left as originally written for the historical record of the 2026-09-08 pass; treat rows 10 and 24 there as superseded by this correction.

Governance rule applied per row:

- Row's alternative kit **missing from the sellable registry** → `CREATE` (new `CANONICAL_KIT_IDS` entry + minimal, non-fabricated clinical-registry entry; see `src/packages/registries/kits/info.ts`).
- Row's canonical or alternative kit **exists but has no approved price** (`APPROVED_KIT_PRICES_MINOR` was 0/30 before this reconciliation) → `ADD APPROVED PRICE`.
- An **existing approved price that conflicts** with the sheet → `STOP AND REPORT`. Not triggered by any row: no kit in this feature had an approved price before this reconciliation, so there was nothing to conflict with.
- **No loose matching.** `PRO IMMUNE 1` was not treated as `PRO_IMMUNE_GOLD`/"Pro Immune 5"; `GI HEALTH 1` was not treated as `GI_GOLD`. Both are new, distinct registry entries.

## Reconciliation table

| # | Canonical kit | Registry ID | Existing/New | Sheet price (canonical) | Prior configured price (unreconciled placeholder, `KIT_PRICE_INR`) | Alternative kit | Alt. registry ID | Alt. Existing/New | Sheet price (alt.) | Action |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | PHENOTYPE INFLAMATION | `PHENOTYPE_INFLAMMATION` | Existing | ₹3,410 | ₹5,500 | PRO IMMUNE 1 | `PRO_IMMUNE_1` | **New** | ₹2,045 | CREATE alt. + ADD APPROVED PRICE both |
| 2 | MPHL PRO | `MPHL` | Existing | ₹3,637 | ₹6,500 | M4+ | `M4_PLUS` | **New** | ₹1,655 | CREATE alt. + ADD APPROVED PRICE both |
| 3 | FPHL PRO | `FPHL` | Existing | ₹3,583 | ₹6,500 | F4+ | `F4_PLUS` | **New** | ₹1,639 | CREATE alt. + ADD APPROVED PRICE both |
| 4 | PRO FACT META B | `META_B` | Existing | ₹3,018 | ₹5,800 | — (sheet repeats canonical name/price = no alternative) | — | — | — | UNCHANGED, no alt. (matches protected list) |
| 5 | PRO FACT META B PCOS | `PCOS` | Existing | ₹2,291 | ₹6,400 | — (none) | — | — | — | UNCHANGED — protected, no alt. |
| 6 | PRO FACT META B HYPOTHYROID | `META_B_HYPOTHYROID` | Existing | ₹2,316 | ₹6,200 | HYPOTHYROID 2 | `HYPOTHYROID_2` | **New** | ₹1,701 | CREATE alt. + ADD APPROVED PRICE both |
| 7 | PRO FACT THYROID CARE | `PRO_FACT_THYROID_CARE` | Existing | ₹1,518 | ₹5,800 | UNCHANGED (sheet-stated) | — | — | — | UNCHANGED — protected, no alt. |
| 8 | HAIR FACT TE GOLD | `TE_GOLD` | Existing | ₹2,996 | ₹5,900 | Dr. FACT SHED CONTROL | `SHED_CONTROL` | **New** | ₹1,552 | CREATE alt. + ADD APPROVED PRICE both |
| 9 | IRON UP GOLD | `IRON_UP_GOLD` | Existing | ₹2,527 | ₹5,200 | IRON UP 1 | `IRON_UP_1` | **New** | ₹2,284 | CREATE alt. + ADD APPROVED PRICE both |
| 10 | PRO FACT GI GOLD | `GI_GOLD` | Existing | ₹3,407 | ₹5,500 | GI HEALTH 1 | `GI_HEALTH_1` | **New** | ₹1,967 | CREATE alt. + ADD APPROVED PRICE both |
| 11 | PRO IMMUNE GOLD | `PRO_IMMUNE_GOLD` | Existing | ₹2,518 | ₹5,000 | PRO IMMUNE 1 | `PRO_IMMUNE_1` | Existing (from row 1) | ₹2,045 | ADD APPROVED PRICE (canonical); alt. price confirmed consistent with row 1 |
| 12 | HAIR FACT PERI MENOPAUSE | `PERI_MENOPAUSE` | Existing | ₹4,196 | ₹6,400 | UNCHANGED | — | — | — | UNCHANGED — protected, no alt. |
| 13 | PRO FACT META B POSTMENOPAUSE | `POST_MENOPAUSE` | Existing | ₹2,142 | ₹6,400 | UNCHANGED | — | — | — | UNCHANGED — protected, no alt. |
| 14 | HAIR FACT HBR | `HBR` | Existing | ₹2,854 | ₹4,500 | UNCHANGED | — | — | — | UNCHANGED — protected, no alt. |
| 15 | EARLY GREYING CARE GOLD | `EARLY_GREYING_CARE_GOLD` | Existing | ₹3,459 | ₹4,900 | UNCHANGED | — | — | — | UNCHANGED — protected, no alt. |
| 17 | FH WELL 3 | `FH_WELL_3` | Existing | ₹3,394 | ₹6,900 | UNCHANGED | — | — | — | UNCHANGED — protected, no alt. |
| 18 | HEALTHY-9 | `HEALTHY_9` | Existing | ₹1,292 | ₹4,800 | UNCHANGED | — | — | — | UNCHANGED — protected, no alt. |
| 19 | HAIR FACT ALOPECIA AREATA | `ALOPECIA_AREATA` | Existing | ₹3,054 | ₹6,800 | UNCHANGED | — | — | — | UNCHANGED — protected, no alt. |
| 20 | LACTIHEALTH | `LACTIHEALTH` | Existing | ₹1,956 | ₹5,000 | UNCHANGED | — | — | — | UNCHANGED — protected, no alt. |
| 21 | RAPID WEIGHT LOSS SHIELD | `RWL_SHIELD` | Existing | ₹4,402 | ₹5,400 | Dr. FACT SHED CONTROL | `SHED_CONTROL` | Existing (from row 8) | ₹1,552 | ADD APPROVED PRICE (canonical); alt. price confirmed consistent |
| 22 | HAIR FACT NIGHT SHIFT | `NIGHT_SHIFT` | Existing | ₹2,518 | ₹5,200 | Dr. FACT SHED CONTROL | `SHED_CONTROL` | Existing (from row 8) | ₹1,552 | ADD APPROVED PRICE (canonical); alt. price confirmed consistent |
| 23 | HAIR FACT FREQUENT FLYERS | `FREQUENT_FLYERS` | Existing | ₹3,429 | ₹5,200 | Dr. FACT SHED CONTROL | `SHED_CONTROL` | Existing (from row 8) | ₹1,552 | ADD APPROVED PRICE (canonical); alt. price confirmed consistent |
| 24 | HAIR FACT TTM (OCD) | `TTM_SUPPORT` | Existing | ₹2,858 | ₹5,300 | PRO FACT STRESS BUST 3 | `STRESS_BUST_3` | **BLOCKED** | *(missing from sheet — cell empty)* | **NOT IMPLEMENTED.** Alternative kit's approved price is absent from the sheet. Per the no-fallback-price rule, no price was invented and no registry entry, mapping, or approved price was created for this pair. `HAIR FACT TTM (OCD)` continues to show no substitution action until a price is supplied. |

## A second, related decision: commercial-identity aliases

Pricing alone was not enough to make the 11 approved pairs' canonical side actually resolvable. `lib/commerce/kitIdentity.ts` decides what a raw `kitId` string commercially *means* — deliberately separate from, and stricter than, the clinical registry — and resolves an identifier only if it is an exact canonical key or an explicitly approved alias.

Checked directly against `src/packages/ai-engine/kit-scorer` (the engine every current and historical consultation's `kitPhases[].kitId` actually comes from — `resolveKit.ts`, `buildKitSequence.ts`, `protocolSequencer.ts`, `dispensingCatalogue.ts`) and confirmed empirically against a live staging consultation (`GET /api/consultation/…` on a real Vikram Rao case returned `kitId: "HAIR FACT TE GOLD"` and `kitId: "PRO IMMUNE GOLD"` — the clinical spelling, not the canonical key), the engine emits the long clinical spelling for every compound kit name. Only `MPHL` and `FPHL` are emitted bare. Without an alias, 9 of the 11 approved pairs' canonical side would stay `UNRESOLVED` for commercial purposes in essentially every real consultation, and the "Budget alternative" action would never appear.

Eight new entries were added to `APPROVED_KIT_ALIASES` alongside the one pre-existing entry (`PHENOTYPE INFLAMATION`):

| Raw `KitId` (verbatim from the kit-scorer) | Canonical id |
|---|---|
| `HAIR FACT TE GOLD` | `TE_GOLD` |
| `IRON UP GOLD` | `IRON_UP_GOLD` |
| `PRO FACT GI GOLD` | `GI_GOLD` |
| `PRO IMMUNE GOLD` | `PRO_IMMUNE_GOLD` |
| `RAPID WEIGHT LOSS SHIELD` | `RWL_SHIELD` |
| `HAIR FACT NIGHT SHIFT` | `NIGHT_SHIFT` |
| `HAIR FACT FREQUENT FLYERS` | `FREQUENT_FLYERS` |
| `PRO FACT META B HYPOTHYROID` | `META_B_HYPOTHYROID` |

Each was checked against `src/packages/registries/kits/info.ts`'s `KIT_ID_TO_ENTRY` — the table that has rendered these exact spellings under these exact canonical kits throughout the clinical report all along — and none carries the ambiguity the withheld `PRO FACT META B PCOS` case exists to guard against (ambiguity between a normalised match and the correct product variant): each spelling names exactly one product, with veg/plus variants kept as visibly distinct `KitId` strings.

**Consequence, disclosed rather than shipped silently:** this is a second, broader gate than budget substitution alone — it makes these 8 raw identifiers commercially resolvable everywhere, including `/api/cart` and `/api/kits`, not just inside the substitution flow. Combined with the price reconciliation above, any *existing* `KitOrderIntent` already sitting in the database whose `kitIds` happen to contain one of these exact raw strings will, the next time its cart is opened, resolve to a real chargeable price for the first time. This was not previously possible (the identifier was unresolved, the price was unapproved, or both). If any pre-existing order was expected to remain non-chargeable, or was implicitly priced or communicated to a patient under different terms, that should be reviewed before this ships — it is a genuine behavioural change to real, already-existing data, not just new code.

## Outcome

- **11 of 12** approved substitution pairs are live: `PHENOTYPE_INFLAMMATION`, `MPHL`, `FPHL`, `META_B_HYPOTHYROID`, `TE_GOLD`, `IRON_UP_GOLD`, `GI_GOLD`, `PRO_IMMUNE_GOLD`, `RWL_SHIELD`, `NIGHT_SHIFT`, `FREQUENT_FLYERS` (the last three all pairing to the single `SHED_CONTROL` identity, as instructed — one product, three canonical kits, all at the same ₹1,552 sheet price).
- **1 of 12 blocked**: `HAIR FACT TTM (OCD)` → `PRO FACT STRESS BUST 3`. The sheet's price cell for this row is empty. No `STRESS_BUST_3` registry entry, no `CANONICAL_KIT_IDS` entry, and no approved price were created. The mapping table (`lib/commerce/budgetSubstitution.ts`) does not include this pair, so the doctor UI shows no "Budget alternative" action for `HAIR FACT TTM (OCD)` — it behaves exactly like an unmapped, ineligible kit until a price is supplied.
- **Prior configured prices** (`KIT_PRICE_INR`, the pre-existing unreconciled placeholder table used only for revenue-estimate tiles) disagreed with the sheet on every reconciled kit, sometimes substantially (e.g. `RWL_SHIELD` ₹5,400 → ₹4,402; `MPHL` ₹6,500 → ₹3,637). This is expected — that table's own header calls itself "NOT the source of truth for actual invoicing." No conflict-stop was triggered because a *placeholder* price is not an *approved* price; only an existing **approved** price could have conflicted, and none existed before this reconciliation. `KIT_PRICE_INR` itself was left untouched (it still serves the unrelated revenue-estimate tiles) — the new authority for these 18 kit ids is `APPROVED_KIT_PRICES_MINOR`.
- No other kit's approved price was touched. The 12 protected kits named in the governing task (`PRO FACT META B`, `PRO FACT META B PCOS`, `PRO FACT THYROID CARE`, `HAIR FACT PERI MENOPAUSE`, `PRO FACT META B POSTMENOPAUSE`, `HAIR FACT HBR`, `EARLY GREYING CARE GOLD`, `FH WELL 3`, `HEALTHY-9`, `HAIR FACT ALOPECIA AREATA`, `LACTIHEALTH`) remain exactly as before: no alternative, no new approved price, `PRICE_APPROVED` status unchanged.
