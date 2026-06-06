# Product Database Migration Notes

Extracted from: `topical-engine.schema.json → topicalProductDatabase.products`  
Destination: `src/clinical-engine/kits/products.json`  
Loader: `src/clinical-engine/loaders/loadProducts.ts`

---

## What Was Moved

The 14 topical product definitions have been extracted verbatim into `products.json`.  
All field names, values, ordering, and optional fields (`ingredients`, `mechanism`) are preserved exactly.

**Products extracted (14 total):**

| # | Name | Category | Gender |
|---|------|----------|--------|
| 1 | Minoxidil 5% | — | male, female |
| 2 | Minoxidil 2% + Finasteride 0.25% Topical | — | male, female |
| 3 | Minoxidil + Spironolactone Topical | — | female |
| 4 | Ketoconazole Lotion / Shampoo | — | male, female |
| 5 | Ketoconazole + Growth Serum Combo | — | male, female |
| 6 | F-Emugrow MCRD | oil | male, female |
| 7 | Trichogain Serum | — | male, female |
| 8 | CR Serum | — | male, female |
| 9 | F-Trichosure Pro | — | female |
| 10 | Premature Greying Topical Support | — | male, female |
| 11 | F-Trichosilk D&F (Without Treatment) | serum | male, female |
| 12 | F-Trichosilk D&F (With Treatment) | serum | male, female |
| 13 | F-Biwash+ Anti-Dandruff Shampoo | shampoo | male, female |
| 14 | Trichonourish EVA / FHA-Andro+ | — | female |

---

## Logic Still Depending on Embedded Product References

The following subsystems reference products **by name string** embedded in their own logic.  
They are **not yet reading from `products.json`** and must be migrated separately.

### 1. `topical-engine.schema.json` — `recommendationEngine.decisionTree`

Every branch hardcodes product names as recommendation strings, e.g.:

```
"recommended": "F-Emugrow MCRD ± Oral Minoxidil"
"recommended": "F-Biwash+ Anti-Dandruff Shampoo"
"recommended": "F-Trichosure Pro | or F-Emugrow MCRD | or Oral Minoxidil + Spironolactone"
```

These strings are not resolved against the product database — they are passed as display text directly.  
**Risk:** If a product is renamed in `products.json`, decision tree output will drift from the catalog.

### 2. `topical-engine.schema.json` — `autoInjectRules`

```
AUTO_01_FBIWASH  → injects "F-Biwash+ Anti-Dandruff Shampoo" by hardcoded name
AUTO_02_EMUGROW  → injects "F-Emugrow MCRD (Therapeutic Hair Oil)" by hardcoded name
AUTO_03_TRICHOSILK → injects "F-Trichosilk D&F (Without Treatment)" or "(With Treatment)" by hardcoded name
```

**Risk:** Name changes in `products.json` will not propagate to auto-inject output.

### 3. `topical-engine.schema.json` — `topicalProtocolRows`

Protocol rows reference products as treatment description strings:

```
"treatment": "F-Emugrow MCRD + Trichogain (alternate) +/- Oral Minoxidil if doctor approves"
"treatment": "F-Emugrow MCRD with possible Oral Minoxidil and Finasteride topical 2.5%"
```

These are display strings only. They are not resolved against the product database.

### 4. `src/services/productMapper.ts`

This file uses its own hardcoded product catalog (placeholder data):

```ts
if (c.includes('telogen')) return { title: 'Hair Fact TE Gold Kit', id: 'hf-te-gold', ... };
if (c.includes('androgen'))  return { title: 'DHT Shield Kit', id: 'dht-shield', ... };
```

This is a **completely separate stub** that does not read from `products.json`.  
It maps kit-scorer conditions to products, not topical products.  
**Status:** Stub — not production logic. Needs replacement once kit product IDs are defined.

---

## Unresolved Dependencies

### DEP-01: `AUTO_02_EMUGROW_PATTERN` reads `S._conditionScores`

```json
"trigger": "... OR S._conditionScores for AGA_MALE_123/AGA_MALE_45/AGA_FEMALE_123/AGA_FEMALE_45 >= 40"
```

This cross-subsystem dependency reads the clinical engine's global scoring state at runtime.  
`loadProducts.ts` has no visibility into this state.  
**Resolution required:** The caller (`recommendTopicals`) must pass AGA scores as an explicit parameter instead of relying on global state.

### DEP-02: `AUTO_03_TRICHOSILK` reads `patientInput.treatment` / `patientInput.treatments`

These fields are not part of the questionnaire STEPS schema.  
They are injected externally by an undocumented intake pathway.  
If missing, the auto-inject always selects the "Without Treatment" variant, silently.  
**Resolution required:** Document the field injection contract or add a structured `heatChemicalTreatment` flag to `PatientAnswers`.

### DEP-03: Hypertension detection (TC_04)

The hypertension early-return in `recommendTopicals()` reads free text only.  
No structured checkbox in the questionnaire triggers this contraindication gate.  
**Resolution required:** Add `hasHypertension: boolean` to `PatientAnswers` and wire it to Q4 medical history.

---

## Missing Products

The following product names appear in recommendation logic but have **no entry in `products.json`**:

| Missing Product | Where Referenced | Risk |
|---|---|---|
| `F-Emugrow MCR` (without D) | `FEMALE_PSORIASIS`, `FEMALE_DANDRUFF_ITCHING`, `FEMALE_DRY_OR_INFLAMED` branches (females < 30) | Downstream PDF/report generation cannot resolve ingredients or mechanism for this variant. |
| `Trichonourish EVA` | `FEMALE_PCOS_UNDER_30`, `FEMALE_PCOS_OVER_30` facial hair add-on | Listed separately from `Trichonourish EVA / FHA-Andro+` combined entry — unclear if same product. |
| `FHA-Andro+` | Same PCOS branches | Same ambiguity as above. |
| `Oral Minoxidil` (1.25 mg, 2.5 mg variants) | Multiple caution arrays | Oral formulation — not a topical. May belong in a separate oral products catalog. |
| `Finasteride topical` (0.25%, 2.5% standalone) | Multiple protocol rows | Referenced as standalone prescriptions, not as a combined product. |
| `Spironolactone` (oral) | Multiple PCOS/menopause branches | Oral systemic — not a topical. |
| `Bicalutamide` (oral) | PCOS branches | Oral systemic — not a topical. |

**Immediate action needed:** Decide whether `F-Emugrow MCR` is a distinct SKU from `F-Emugrow MCRD` and add it to `products.json` if so. All other missing entries are either oral medications or ambiguous naming.

---

## Invalid Mappings

### MAP-01: `F-Emugrow MCRD` can appear twice in output

`AUTO_02_EMUGROW_PATTERN` injects `F-Emugrow MCRD` unconditionally for AGA patterns.  
Several decision branches also recommend it directly (e.g., `MALE_18_TO_55_PSORIASIS`, `MALE_OVER_55`, `FEMALE_PSORIASIS`).  
The output cap (`slice(0, 6)`) prevents overflow but **deduplication is not enforced**.  
Result: the same product may appear twice in `recommended[]`.

### MAP-02: `Trichonourish EVA / FHA-Andro+` is a dual-name entry

The database combines two distinct products into one entry using a `/` separator.  
The recommendation logic references them as alternatives (`Trichonourish EVA | or FHA-Andro+`).  
This creates an ambiguous match — `getProductByName('Trichonourish EVA')` returns `undefined`; only the combined string matches.  
**Resolution required:** Split into two separate product entries if they are distinct SKUs.

### MAP-03: `topical-engine.schema.json` `summary.productsWithNoDBEntry` confirms the gap

```json
"productsWithNoDBEntry": [
  "F-Emugrow MCR (variant of MCRD for females under 30)",
  "Trichonourish EVA",
  "FHA-Andro+",
  "Oral Minoxidil (various doses)"
]
```

This is the schema author's own acknowledgement. These four were known missing at extraction time.

---

## Safe to Migrate Now

The following consuming code can be safely updated to use `loadProducts` / `getProducts()` without any logic changes:

- Any future UI layer that renders the product catalog
- Report generation code that looks up `ingredients` or `mechanism` by product name
- Tag-based product filtering (use `getProductsByTags()`)
- Scalp-based pre-filtering (use `getProductsByScalp()`)

Do **not** yet migrate `recommendTopicals()` auto-inject rules until DEP-01 and DEP-02 above are resolved.
