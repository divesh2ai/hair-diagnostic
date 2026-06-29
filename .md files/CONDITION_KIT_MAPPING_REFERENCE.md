# Dr. FACT — Condition → Kit Mapping & Sequencing Reference (v2)

> Source of truth combining the updated `Mapping condition.xlsx` (clinical rules) and `DrFACT_Protocol_Sequencer Final.xlsx` (phase ordering). Supersedes v1.
>
> Governance decisions captured 2026-06-08 are embedded inline and marked **[2026-06-08]**.

---

## 0. How to read this document

A patient's protocol is built in three deterministic steps:

```
Q1–Q13 answers  +  Gender  +  Age band
        │
        ▼  STEP 1 — Rule firing
   Union of all kits triggered by every answer (Section 1)
        │
        ▼  STEP 2 — Hard rules & filters (Section 3)
   • Veg variants if Q12 = Veg/Vegan/Jain
   • Gender filters (PCOS → Female only, MPHL → Male only)
   • Age modifier (Age >30 raises MPHL/FPHL by +1 score)
   • Governance overrides (Section 4)
        │
        ▼  STEP 3 — Phase sequencing (Section 5)
   Phase 1 (M1–M2) terrain  → Phase 2 (M3–M4) primary
   Phase 3 (M5–M6) systemic → Phase 4 (M7–M8) consolidate
```

---

## 1. Decision Rules (updated)

### Q1 — Duration of hair fall

| Answer | Condition | Kit(s) |
|---|---|---|
| 1–3 months | Telogen Effluvium | HAIR FACT TE GOLD / VEG |
| 3–6 months | Continued TE | HAIR FACT TE GOLD / VEG + PHENOTYPE INFLAMMATION |
| 6–12 months | Chronic TE w/ micro-inflammation + oxidative stress | HAIR FACT TE GOLD / VEG + PHENOTYPE INFLAMMATION + PRO IMMUNE GOLD |
| > 1 year | Chronic Inflammation Phenotype | PRO IMMUNE GOLD + PHENOTYPE INFLAMMATION |

### Q2 — Daily shed count

| Answer | Condition | Kit(s) |
|---|---|---|
| 20–50/day | Immune-related weakening | No standalone kit — depends on other answers |
| 50–100/day | Active shedding | HAIR FACT TE GOLD / VEG |
| > 100/day | Chronic Telogen | HAIR FACT TE GOLD |
| Thinning / progressive | Pattern baldness | MPHL / FPHL |

### Q3 — Hair type at root

| Answer | Condition | Kit(s) |
|---|---|---|
| Full-length with white bulb | Telogen shedding | HAIR FACT TE GOLD / VEG |
| Broken / short hair | Hair-shaft damage | HAIR FACT HBR |
| Bald patches (circular) | Alopecia Areata | HAIR FACT ALOPECIA AREATA + PRO FACT META B + PRO IMMUNE GOLD |
| Gradual thinning / widening | Inflammatory / AGA | MPHL / FPHL |

### Q4 — Suspected cause **(updated)**

| Answer | Condition | Kit(s) |
|---|---|---|
| Stress / Anxiety / Depression | Stress-induced TE | HAIR FACT TE GOLD / VEG |
| **Post-partum (not feeding)** | Hormonal TE | **PRO FACT META B + PRO IMMUNE GOLD** *(updated; supersedes Sequencer entry)* |
| **Post-partum (still feeding)** | Hormonal TE | **LACTIHEALTH + PRO FACT META B + PRO IMMUNE GOLD** |
| Nutritional deficiencies | Nutritional TE | HAIR FACT TE GOLD / VEG + PRO IMMUNE GOLD |
| **Genetics, Female < 30** | AGA | HAIR FACT TE + PRO IMMUNE GOLD |
| **Genetics, Female ≥ 30** | AGA | **PRO FACT META B + PRO IMMUNE GOLD** *(FPHL suppressed — see §4 rule G)* |
| **Genetics, Male** | AGA | PRO IMMUNE GOLD + MPHL |
| Medication | Systemic hair loss | PRO IMMUNE GOLD + PHENOTYPE INFLAMMATION |
| Illness / Surgery | Post-illness shedding | HAIR FACT TE + PRO IMMUNE GOLD + PHENOTYPE INFLAMMATION |
| Hard water | Hair-shaft damage | HAIR FACT HBR |
| Hair pulling (TTM/OCD) | Trichotillomania | HAIR FACT TTM |

### Q5 — Scalp **(updated)**

| Answer | Condition | Kit(s) |
|---|---|---|
| Dandruff | Seborrheic scalp | M-AGA Gold / F-AGA Gold |
| Dandruff + itching | Seborrheic + inflammation | Seborrheic dermatitis + PHENOTYPE INFLAMMATION |
| Oily scalp | DHT + seborrhoea | Female < 30: PHENOTYPE INFLAMMATION. Female ≥ 30 / Male: FPHL / MPHL |
| Dry scalp | Scalp imbalance | HBR |
| **Flaking** | Inflammatory scalp | **PHENOTYPE INFLAMMATION** *(HBR removed — see §4 rule H)* |
| **Boils / Folliculitis** | Folliculitis | **PHENOTYPE INFLAMMATION** *(HBR removed)* |
| **Redness / Burning** | Scalp inflammation | **PHENOTYPE INFLAMMATION** *(HBR removed)* |

### Q6 — Immunity

| Answer | Condition | Kit(s) |
|---|---|---|
| Frequent cough / cold | Immune dysregulation | PRO IMMUNE GOLD + PHENOTYPE INFLAMMATION |
| Allergies | Immune hypersensitivity | PHENOTYPE INFLAMMATION + PRO IMMUNE GOLD |
| Asthma | Auto-immune inflammation | PHENOTYPE INFLAMMATION + OXIDATIVE STRESS |
| Skin rash | Auto-immune | PHENOTYPE INFLAMMATION + PRO IMMUNE GOLD (+ indicative kits) |
| Alopecia Areata | Auto-immune hair loss | HAIR FACT ALOPECIA AREATA + PRO FACT META B + PHENOTYPE INFLAMMATION |
| Scarring alopecia | Permanent follicle damage | Male: PHENOTYPE INFLAMMATION + MPHL. Female: PHENOTYPE INFLAMMATION + TE Gold |
| Tongue / mouth ulcers | Immune inflammation | PHENOTYPE INFLAMMATION + GI GOLD |

### Q7 — Lifestyle **(updated)**

| Answer | Condition | Kit(s) |
|---|---|---|
| Smoking / Vaping / Alcohol | Oxidative stress | PHENOTYPE INFLAMMATION + OXIDATIVE STRESS |
| **Bodybuilding** | Hormonal / DHT | Male: MPHL. **Female ≥ 30: F-AGA + PRO FACT META B** *(updated: F-AGA replaces FPHL here)* |
| Obesity | Metabolic dysfunction | PRO FACT META B |
| Sedentary lifestyle | Metabolic syndrome | PRO FACT META B |
| Diet issues | Metabolic hair loss | PRO FACT META B |
| Sleep / Night shift | Circadian disruption | HAIR FACT NIGHT SHIFT + TE GOLD |
| Sudden weight loss | Rapid telogen shedding | RAPID WEIGHT LOSS SHIELD + TE GOLD |
| Frequent flying | Circadian + immune stress | HAIR FACT FREQUENT FLYERS + TE GOLD |

### Q8 — Medical

| Answer | Condition | Kit(s) |
|---|---|---|
| Any chronic condition | Metabolic stress | PRO FACT META B + PRO IMMUNE GOLD + PHENOTYPE INFLAMMATION |
| Autoimmune disease | Auto-immune inflammation | PRO FACT META B + PRO IMMUNE GOLD + PHENOTYPE INFLAMMATION |

### Q9 — Hormonal **(updated)**

| Answer | Condition | Kit(s) |
|---|---|---|
| Thyroid (Hypo) | Thyroid-related | PRO FACT META B HYPOTHYROID |
| Thyroid (Hyper) | Thyroid-related | PRO FACT THYROID CARE |
| **PCOS / PCOD / PMOS** | PCOS-related | **F-PCOS-1 (VEG variant if Q12 = veg)** *(confirmed)* |
| **PCOS + Obesity** | PCOS + weight | **PRO FACT META B PCOS + PHENOTYPE INFLAMMATION** *(F-PCOS-1 dropped here)* |
| **Endometriosis** | Hormonal inflammation | **FH WELL 3 + PHENOTYPE INFLAMMATION** *(confirmed)* |
| Pregnancy | No kit — info only | HEALTHY-9 (support) — single kit, no others during pregnancy |
| Post-delivery / Feeding | Post-natal TE | LACTIHEALTH + PRO FACT META B + PRO IMMUNE GOLD |
| **Peri-menopausal** | Peri-menopausal TE | **HAIR FACT PERI MENOPAUSE + FPHL** *(TE GOLD removed)* |
| **Menopausal** | Menopausal transition | **PRO FACT META B MENOPAUSE + F-AGA** *(updated: F-AGA replaces FPHL here)* |
| HRT | Hormonal therapy support | PRO IMMUNE GOLD |

### Q10 — Gut

| Answer | Condition | Kit(s) |
|---|---|---|
| **GERD / Acidity / IBS / Leaky gut** | Gut-hair axis disruption | **PRO FACT GI HEALTH + PRO IMMUNE GOLD** *(consolidated)* |
| Bloating / Constipation | Gut dysbiosis | PRO FACT GI HEALTH + PRO IMMUNE GOLD |

### Q11 — Deficiencies

| Answer | Condition | Kit(s) |
|---|---|---|
| Iron deficiency / Anaemia | Iron deficiency hair loss | IRON UP GOLD + PRO IMMUNE GOLD |
| Vitamin D3 | Nutritional | NA — No kit |
| Vitamin B12 | Nutritional | NA — No kit |

### Q12 — Diet

| Answer | Condition | Effect |
|---|---|---|
| Vegetarian / Vegan / Jain | Veg only | **Globally swap all kits to VEG variants** (filter applied at finalization) |
| Non-vegetarian | Standard | MPHL / FPHL eligible |
| High-protein diet | DHT boost risk | MPHL / FPHL eligible |

### Q13 — Treatments **(updated rule)**

| Answer | Condition | Kit(s) |
|---|---|---|
| Heat / chemical / colour treatment | Hair-shaft compromise | **HBR — only added if Q3 = Broken / short hair** *(no longer "always added")* |

### Age Modifier

| Condition | Effect |
|---|---|
| Age > 30 | Higher AGA risk → +1 score to MPHL / FPHL (when those are candidates) |

---

## 2. Kit Master (29 active kits)

| # | Kit Name | Product Line | Gender | Veg Variant | Primary Use |
|---|---|---|---|---|---|
| 1 | HAIR FACT TE GOLD | Hair Fact | Both | Yes → VEG | TE — non-veg |
| 2 | HAIR FACT TE GOLD VEG | Hair Fact | Both | — | TE — veg/vegan |
| 3 | MPHL | Hair Fact | Male | No | Male AGA G1–G5 |
| 4 | FPHL | Hair Fact | Female | No | Female AGA G1–G5 |
| 5 | PHENOTYPE INFLAMMATION | Hair Fact | Both | No | Scalp & systemic inflammation — universal terrain |
| 6 | PRO IMMUNE GOLD | Hair Fact | Both | No | Immune modulation — standard |
| 7 | PRO IMMUNE GOLD PLUS | Hair Fact | Both | No | Advanced immune (Grade 4-5 / severe) |
| 8 | PRO IMMUNE VEG | Hair Fact | Both | — | Immune — veg |
| 9 | HAIR FACT ALOPECIA AREATA | Hair Fact | Both | No | Autoimmune AA |
| 10 | HAIR FACT HBR | Hair Fact | Both | No | Hair shaft breakage |
| 11 | F-PCOS-1 | Hair Fact | Female | Yes → VEG | PCOS / PCOD / PMOS hormonal |
| 12 | F-PCOS VEG-1 | Hair Fact | Female | — | PCOS — veg |
| 13 | HAIR FACT PERI MENOPAUSE | Hair Fact | Female | Yes → VEG | Peri-menopausal |
| 14 | HAIR FACT PERI MENOPAUSE VEG | Hair Fact | Female | — | Peri-menopausal — veg |
| 15 | HAIR FACT NIGHT SHIFT | Hair Fact | Both | No | Circadian disruption |
| 16 | HAIR FACT FREQUENT FLYERS | Hair Fact | Both | No | Frequent flying / cabin radiation |
| 17 | HAIR FACT TTM (OCD) | Hair Fact | Both | No | Trichotillomania |
| 18 | HEALTHY-9 | Hair Fact | Female | No | Pregnancy support **only** |
| 19 | PRO FACT META B | Pro Fact | Both | No | Metabolic dysfunction / chronic condition |
| 20 | PRO FACT META B PCOS | Pro Fact | Female | No | PCOS + obesity (metabolic PCOS) |
| 21 | PRO FACT META B HYPOTHYROID | Pro Fact | Female | No | Hypothyroid hair loss |
| 22 | PRO FACT THYROID CARE | Pro Fact | Female | No | Hyperthyroid hair loss |
| 23 | PRO FACT META B POSTMENOPAUSE | Pro Fact | Female | No | Post-menopausal transition |
| 24 | RAPID WEIGHT LOSS SHIELD | Hair Fact | Both | No | Sudden weight-loss shedding |
| 25 | IRON UP GOLD | Hair Fact | Both | No | Iron deficiency / anaemia |
| 26 | LACTIHEALTH | Hair Fact | Female | No | Post-pregnancy / breastfeeding |
| 27 | FH WELL 3 | Hair Fact | Female | No | Endometriosis / hormonal inflammation |
| 28 | OXIDATIVE STRESS | Hair Fact | Both | No | ROS damage / smoking / pollution |
| 29 | PRO FACT GI GOLD | Pro Fact | Both | Yes → VEG | Gut dysbiosis / GI issues |
| 30 | EARLY GREYING CARE / VEG / GOLD | Hair Fact | Both | Yes | Early greying < 30 |

---

## 3. Hard Rules (always applied at finalization)

| # | Rule | Effect |
|---|---|---|
| HR-1 | Q12 = Veg/Vegan/Jain | Swap every selected kit to its VEG variant if one exists |
| HR-2 | Pregnancy (Q9) | HEALTHY-9 is the **only** kit. All other rules suppressed |
| HR-3 | Gender = Male | Drop FPHL, F-PCOS-1, FH WELL 3, HEALTHY-9, LACTIHEALTH, peri/post-menopause kits |
| HR-4 | Gender = Female | Drop MPHL |
| HR-5 | Age > 30 with MPHL/FPHL in candidate set | +1 severity score on MPHL/FPHL |
| HR-6 | Deduplicate | Same kit triggered by multiple rules → keep once |

---

## 4. Governance Overrides **[2026-06-08]**

These are the conflict resolutions captured today. They override the Sequencer sheet where they disagree.

| ID | Rule | Resolution |
|---|---|---|
| **G-1** | Post-partum (not feeding) — Mapping vs Sequencer | **Mapping wins.** Final kit set = PRO FACT META B + PRO IMMUNE GOLD. Sequencer's "TE GOLD + PRO IMMUNE GOLD" entry is stale and should be updated. |
| **G-2** | PCOS + Obesity | **Two-kit protocol.** META B PCOS + PHENOTYPE INFLAMMATION. **F-PCOS-1 is NOT added** in this case (it stays only in pure PCOS / no obesity). |
| **G-3** | HBR + Heat treatment | HBR is **conditional**, not "always added". Trigger HBR only if **Q3 = Broken / short hair** is also selected. Q13 alone no longer forces HBR. |
| **G-4** | Genetics + Female ≥ 30 | **META B-led only.** FPHL is suppressed for this profile **even if Q2 (Thinning) or Q3 (Gradual thinning) also fires it.** Routing flows entirely through metabolic correction. |

These four overrides are governance-level: any rule firing against them must be filtered at STEP 2 of the pipeline.

---

## 5. Phase Sequencing — the 4-phase engine

After deduplication and governance, sort the surviving kits into phases.

### Phase intent

| Phase | Months | Intent |
|---|---|---|
| **Phase 1** | M1–M2 | **Repair cellular ENVIRONMENT first.** Inflamed / deficient cells cannot respond to targeted treatment. |
| **Phase 2** | M3–M4 | **Target the PRIMARY hair condition.** Terrain is now ready — the targeted kit absorbs and works. |
| **Phase 3** | M5–M6 | **Address hormonal / metabolic layer.** Systemic correction sustains Phase 2 results. |
| **Phase 4** | M7–M8 | **Consolidate — prevent relapse.** Immune modulation prevents regression in severe cases. |

### Kit → Phase assignment table

Apply in this order; first match wins per kit. When a kit has no explicit row, it falls into the "default placement" rule at the end.

| Kit | Phase | Note |
|---|---|---|
| PRO FACT META B / META B PCOS / META B HYPOTHYROID / META B POSTMENOPAUSE | Phase 1 | Metabolic terrain is the root cause when present |
| PRO FACT THYROID CARE | Phase 1 | Hyperthyroid case — only 2 phases |
| HAIR FACT ALOPECIA AREATA | Phase 1 | Autoimmune-specific kit precedes everything |
| HAIR FACT PERI MENOPAUSE | Phase 1 | Hormonal fluctuation corrected first |
| FH WELL 3 | Phase 1 | Endometriotic inflammation source |
| F-PCOS-1 | Phase 1 (pure PCOS) | In PCOS+Obesity case it does not appear (G-2) |
| IRON UP GOLD | Phase 1 | Iron repletion is non-negotiable first |
| LACTIHEALTH | Phase 1 | Lactation nutrition deployed immediately |
| RAPID WEIGHT LOSS SHIELD | Phase 1 | Shedding shield deployed immediately |
| HEALTHY-9 | Phase 1 (only kit) | Pregnancy — no other kits allowed |
| HAIR FACT NIGHT SHIFT | Phase 1 | Circadian reset is the primary driver |
| HAIR FACT FREQUENT FLYERS | Phase 1 | Travel-stress correction precedes |
| HAIR FACT TTM | Phase 1 | TTM neurological support first |
| HAIR FACT HBR | Phase 1 | Shaft repair / keratin first |
| PHENOTYPE INFLAMMATION | Phase 1 **or** Phase 2 | **Multi-factorial cases: ALWAYS Phase 1.** Otherwise Phase 2 when paired with a stronger Phase-1 root-cause kit. |
| HAIR FACT TE GOLD / VEG | Phase 2 | Primary TE kit (Phase 1 only if no stronger root-cause kit is present) |
| MPHL | Phase 2 (G1–G3) / Phase 2 (G4–G5 after PRO IMMUNE GOLD) | See AGA grade branching below |
| FPHL | Phase 2 (G1–G3) / Phase 2 (G4–G5 after PRO IMMUNE GOLD) | See AGA grade branching below |
| **PRO FACT GI GOLD / GI HEALTH** | **Phase 1** | **Gut-hair axis is upstream — when any gut symptom (Q10) is present, GI GOLD is the first kit. Gut inflammation must be cleared before any other kit can be effective.** |
| PRO IMMUNE GOLD | Phase 3 | Systemic immune layer |
| OXIDATIVE STRESS | Phase 3 | After inflammation, before final consolidation |
| PRO IMMUNE GOLD PLUS | Phase 4 | Consolidation for severe / Grade 4–5 cases |

### AGA grade branching

| Grade | Sequence |
|---|---|
| Male AGA G1–G3 | Phase 1: HAIR FACT TE GOLD → Phase 2: MPHL → Phase 3: PRO IMMUNE GOLD |
| Male AGA G4–G5 | Phase 1: PRO IMMUNE GOLD → Phase 2: MPHL → Phase 3: PHENOTYPE INFLAMMATION |
| Female AGA G1–G3 | Phase 1: HAIR FACT TE GOLD → Phase 2: FPHL → Phase 3: PRO IMMUNE GOLD |
| Female AGA G4–G5 | Phase 1: PRO IMMUNE GOLD → Phase 2: FPHL → Phase 3: PHENOTYPE INFLAMMATION |

### Default placement (if a kit is not in any row above)

1. If it is a **root-cause / metabolic / hormonal** kit → Phase 1.
2. If it is a **primary condition** kit (TE / MPHL / FPHL / AA) → Phase 2.
3. If it is a **systemic / immune** kit → Phase 3.
4. If it is **PRO IMMUNE GOLD PLUS or a consolidation kit** → Phase 4.

### Root-cause precedence (Phase 1 priority order)

When multiple kits are eligible for Phase 1, exactly one takes the slot. The rest shift to Phase 2+. Apply this precedence top-down — first match wins:

1. **Pregnancy (HEALTHY-9)** — exclusive; no other kit ships during pregnancy.
2. **Gut-axis kit (GI GOLD)** — if Q10 fires any gut symptom, GI GOLD is Phase 1. The gut-hair axis is upstream of metabolic, hormonal, and inflammatory layers.
3. **Iron repletion (IRON UP GOLD)** — if Q11 = iron deficiency, iron correction is non-negotiable Phase 1 (cells cannot grow hair without oxygen delivery).
4. **Acute lactation / weight-loss shield** — LACTIHEALTH or RAPID WEIGHT LOSS SHIELD when those root causes are active.
5. **Condition-specific root-cause kit** — HAIR FACT ALOPECIA AREATA, HAIR FACT TTM, HAIR FACT NIGHT SHIFT, HAIR FACT FREQUENT FLYERS, FH WELL 3.
6. **Hormonal kit** — F-PCOS-1 / PRO FACT META B PCOS / META B HYPOTHYROID / THYROID CARE / PERI MENOPAUSE / META B POSTMENOPAUSE.
7. **Metabolic kit** — PRO FACT META B (for Q7 obesity/sedentary/diet, Q8 chronic, Q4 genetics-F≥30, Q4 post-partum).
8. **Shaft-repair (HBR)** — when Q3 = broken/short hair.
9. **PHENOTYPE INFLAMMATION** — terrain clearer (Phase 1 only if nothing above qualifies; otherwise Phase 2).
10. **HAIR FACT TE GOLD** — Phase 1 only if no stronger root cause fires; otherwise Phase 2.

Everything else cascades into Phase 2+ per the kit→phase table above.

### Universal rule (multi-factorial)

If the patient triggers 3+ root causes across Q4/Q7/Q8/Q9, **PHENOTYPE INFLAMMATION is forced to Phase 1** regardless of the kit table above — *unless* a higher-precedence root cause (GI, Iron, Pregnancy) is also active. The Sequencer doc states: *"Inflammation is the universal terrain — ALWAYS Phase 1 for multi-factorial cases."*

---

## 6. Worked examples

### Example 0 — Female, 35, GERD + AGA G2 thinning + family history

Triggered: Q10 GERD → GI GOLD + PRO IMMUNE GOLD · Q3 gradual thinning → FPHL · Q4 genetics F≥30 → META B + PRO IMMUNE GOLD (G-4 suppresses FPHL from Q4 path but Q3 still fires it).

Per G-4, Genetics + F ≥ 30 suppresses FPHL **entirely** (not just from Q4). Dedup: {GI GOLD, PRO IMMUNE GOLD, META B}.

Sequence (per root-cause precedence: gut > metabolic > immune):
- **Phase 1:** PRO FACT GI GOLD (gut-axis upstream — clear gut inflammation first)
- **Phase 2:** PRO FACT META B (metabolic correction)
- **Phase 3:** PRO IMMUNE GOLD (systemic immune layer)



### Example A — Sanjay (male, age 34, AGA G2, oily scalp, sedentary)

Triggered rules: Q3 = gradual thinning → MPHL · Q4 = genetics (male) → PRO IMMUNE GOLD + MPHL · Q5 = oily scalp (male) → MPHL · Q7 = sedentary → PRO FACT META B · Age > 30 → +1 MPHL severity.

Dedup: {MPHL, PRO IMMUNE GOLD, PRO FACT META B}.

Sequence (Male AGA G1–G3 branch + META B-led):
- **Phase 1:** PRO FACT META B (metabolic root)
- **Phase 2:** MPHL
- **Phase 3:** PRO IMMUNE GOLD

### Example B — Female, 32, PCOS + obesity, dandruff + itching, vegetarian

Triggered: Q9 PCOS+Obesity → META B PCOS + PHENOTYPE INFLAMMATION (G-2) · Q5 dandruff+itching → PHENOTYPE INFLAMMATION (dedup) · Q12 veg → swap to veg variants.

Dedup: {META B PCOS, PHENOTYPE INFLAMMATION}. F-PCOS-1 **not added** per G-2.

Sequence:
- **Phase 1:** PRO FACT META B PCOS
- **Phase 2:** PHENOTYPE INFLAMMATION

### Example C — Female, 28, post-partum still feeding, mild flaking, vegetarian

Triggered: Q4 post-partum still feeding → LACTIHEALTH + META B + PRO IMMUNE GOLD · Q5 flaking → PHENOTYPE INFLAMMATION · Q12 veg → veg variants.

Dedup: {LACTIHEALTH, META B, PRO IMMUNE GOLD, PHENOTYPE INFLAMMATION}.

Sequence:
- **Phase 1:** LACTIHEALTH (lactation nutrition deployed immediately)
- **Phase 2:** PRO FACT META B (hormonal/metabolic post-partum correction)
- **Phase 3:** PHENOTYPE INFLAMMATION + PRO IMMUNE GOLD (terrain + immune)

### Example D — Male, 41, heat-treated hair, broken hair tips, no other findings

Triggered: Q3 broken/short → HBR · Q13 heat treatment → HBR (per G-3, requires Q3 = broken/short → satisfied).

Dedup: {HBR}.

Sequence:
- **Phase 1:** HAIR FACT HBR (shaft repair)

> Contrast: if the same patient had **heat treatment but full-length hair w/ white bulb** (Q3 ≠ broken), HBR is **not** added under G-3.

---

## 7. Implementation contract (for Composer / Sequencer module)

```
selectKitsAndSequence(answers, gender, age) {
  candidates = []
  for each (q, a) in answers:
    candidates += RULES[q][a]               // §1 tables

  candidates = applyHardRules(candidates, gender, age, answers)   // §3
  candidates = applyGovernance(candidates, answers)               // §4 (G-1..G-4)
  candidates = dedupe(candidates)

  return assignPhases(candidates, answers)                        // §5 table + branching
}
```

Each rule fired carries its source `(question, answer)` tuple so the report can cite back to the patient's own input — required for the V3 patient report ("evidence we used" lines in §2 of the report).

---

## 8. Open items (not yet locked)

- **F-AGA vs FPHL naming**: the updated mapping uses **F-AGA** for Menopausal and Bodybuilding (Female ≥30) rules, while older rules use **FPHL**. Q5 Dandruff also references "M-AGA Gold / F-AGA Gold". Need to confirm whether F-AGA is a distinct kit, an alias for FPHL, or a global rename of FPHL → F-AGA. Same question applies to MPHL → M-AGA.
- **Q10 (Gut) row layout**: GERD/Acidity/IBS/Leaky gut was merged into one row, but Bloating/Constipation remains a separate row with identical kit set. Decide whether to fully collapse Q10 into a single "any gut symptom" row.
- **Kit Master Reference vs Mapping**: a few legacy names co-exist (e.g., F-PCOS-1 vs PRO FACT META B PCOS) — confirm rollout status per kit before code references the legacy names. Status flags on kits #30–32 in the original `All Kits Master` are still blank.
- **Sequencer sheet update**: rows for "Post-delivery / Not Breastfeeding" and "PCOS + Obesity" need to be rewritten to match G-1 and G-2. Peri-menopausal sequencer row also needs to drop TE GOLD (Phase 3 in current sheet) to match the updated mapping.
- **Early Greying** does not yet have a Q-mapped trigger in the current sheet; it is presently reachable only via the Sequencer entry. Decide whether to add a Q-rule or keep it doctor-initiated.

Source files:
- `Mapping condition.xlsx` (clinical rules, updated 2026-06-08)
- `DrFACT_Protocol_Sequencer Final.xlsx` (phase sequencing engine)
- `DrFACT_Condition_Mapping_Latest Final.xlsx` (v1, retained for diff/audit)
