# Five-Kit Controlled RAG Audit

Generated: 2026-08-05

Scope: Dr. FACT doctor chatbot, five pilot kit families only: TE Gold, GI Gold, Pro Immune Gold, Inflammation Phenotype, and Meta-B. No new product families were added.

## Knowledge Sources

- Kits & Product.xlsx / Sheet2.composition: kit-product composition.
- MRP sheet fluence khushal's copy.xlsx / Complete formulation: product-level ingredients and strengths.
- Clinical Chunks sheet: controlled kit overview/objective/mechanism text.
- Canonical Meta B identity decision: base kit, aliases, variants, and non-inheritance rules.
- Controlled lifestyle-factor knowledge update: smoking, alcohol, stress, sleep, restrictive diet, rapid weight loss.
- Controlled supporting-topic knowledge update: telogen effluvium, gut health, iron deficiency, thyroid, insulin resistance.

## Pilot Families

| Family | Kit ID | Product Components | Ingredient Rows | Retrieval Availability | Discrepancies |
|---|---|---:|---:|---|---|
| TE GOLD | KIT_TE_GOLD | 9 | 99 | composition, ingredients, mechanism | none currently detected |
| GI GOLD | KIT_GI_HEALTH_GOLD | 9 | 101 | composition, ingredients, mechanism, gut topic | none currently detected |
| PRO IMMUNE GOLD | KIT_PRO_IMMUNE_GOLD | 9 | 86 | composition, ingredients, mechanism | F-SOLSHINE has no exact Complete formulation row |
| Inflammation Phenotype | KIT_INFLAMMATION_PHENOTYPE | 8 | 101 | composition, ingredients, mechanism | product-count and prose-count levels differ; not silently reconciled |
| PRO FACT META B | KIT_PRO_FACT_META_B | 8 | 88 | overview, composition, ingredients, variants | generic Meta-B must not resolve to IR 5 |

## Meta-B Variants

- KIT_PRO_FACT_META_B_PCOS: registered structured variant.
- KIT_PRO_FACT_META_B_THYROID: registered structured variant.
- KIT_PRO_FACT_META_B_MENOPAUSE: registered structured variant.
- KIT_PRO_FACT_META_B_IR5: identity-only variant record; active structured composition is absent, so composition, price, eligibility and ingredient inheritance are blocked.

## Retrieval Controls Added

- Recognised kit mechanism and overview questions use `entityId`, `taxonomyDomain`, `contentType`, `audience`, topic and knowledge-system filters.
- Lifestyle-factor questions use only `LIFESTYLE_FACTOR` + `LIFESTYLE_IMPACT` records.
- Condition questions use only `CONDITION` + `CONDITION_EXPLANATION` records.
- Exact ingredient names and strengths use structured formulation records.
- Exact kit contents use structured kit-product records.
- Prices remain hidden when no current approved MRP exists.

## Remaining Discrepancies

- PRO IMMUNE GOLD: `F-SOLSHINE` is a kit product but has no exact row in `Complete formulation`; it is not merged with `F-SOLSHINE TABLETS`.
- Inflammation Phenotype: source prose names a different level/count than the kit-product source; exact ingredient answers use the formulation workbook and preserve the distinction.
- Meta-B IR 5: variant identity is available for explanation, but exact composition is absent and blocked.

## Readiness

READY_FOR_CONTROLLED_FIVE_KIT_LOCAL_TESTING.