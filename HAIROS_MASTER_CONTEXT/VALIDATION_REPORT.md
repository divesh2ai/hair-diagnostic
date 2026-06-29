# VALIDATION REPORT — Questionnaire → Driver → Kit → Narrative → Video chain

## Executive Summary
Cross-check of the full clinical chain. 24 findings across five categories. **2026-06-18 update: F-3, F-5, F-9, F-15, F-19 RESOLVED in code.** HBR gating re-routed off the retired Q3 "Broken/short" option onto Hard water as the corroborating signal; META B MENOPAUSE trigger paths stripped (kit kept registered for clinician override); Constipation removed from GI GOLD schema text. Remaining headline exposures: "F-PCOS-1 mid-retirement" (memory locks vs CKM disagreement on pure-PCOS Phase 1 kit) and the **complete absence** of static per-kit video blocks across the entire kit catalog — every kit shows `[MISSING]` for Video Narrative pointer; video is generated dynamically by `build3DAvatarScript.ts` with no per-kit static asset.

---

## 1. Missing Mappings

### F-1 — All kits lack per-kit static video blocks
**Severity:** medium.
**Finding:** Every kit's "Associated Video Blocks" field is `[MISSING]`. There is no per-kit video catalog in the repo; video is dynamically synthesised by `src/packages/ai-engine/narrative-engine/build3DAvatarScript.ts` from `ClinicalProfile`. The avatar engine (`src/packages/ai-engine/avatar-engine/`) does not contain static per-kit video clips either.
**Counterpart:** Compare against `src/packages/ai-engine/report-engine/v3/ingredientMechanisms.ts` which **does** have per-ingredient static text. Per-kit static video blocks would be the symmetric asset.
**Action:** Either confirm dynamic-only is by design (then update kit library docs to reflect), or commission per-kit video script seeds.

### F-2 — PRO FACT GI HEALTH has no dedicated kit-scorer rule file
**Severity:** medium.
**Finding:** CKM §1 Q10 routes Bloating/Constipation → PRO FACT GI HEALTH + PRO IMMUNE, but `src/packages/ai-engine/kit-scorer/rules/` contains no `giHealthInjectionRule.ts`. The only GI rules are `giGoldFinalGuardRule.ts` and `giGoldSupersedesTeGoldRule.ts`.
**Counterpart:** `ironUpInjectionRule.ts`, `lactihealthInjectionRule.ts`, etc., all have dedicated files for their kits.
**Action:** Either GI HEALTH is implicit (routed via `realImmuneSignal` + a different kit code) or it requires its own injection rule. Track down whether `signalGatedInjectionRule.ts` covers it.

### F-3 — PRO FACT META B MENOPAUSE has no questionnaire trigger after 2026-06-15 — **RESOLVED 2026-06-18**
**Severity:** medium-high. **Status: RESOLVED — trigger logic stripped; kit registered but unreachable from questionnaire.**
**Finding:** Memory lock `feedback_questionnaire_changes_2026_06_15.md` removed the bare "Menopause" label from `hormonal` options. The schema shows only "Peri-menopause" and "Post-menopause" — no "Menopause".
**Resolution (2026-06-18):** Bare-Menopause trigger paths stripped:
- `hormonalRules.ts` — MENOPAUSE +98 score branch removed.
- `scoreConditions.ts` — MENOPAUSE dominantKey branch removed.
- `menopauseContinuumInjectionRule.ts` — `hasMenopauseSignal` + meno injection arm deleted.
- `protocolSequencer.ts` — MENOPAUSE protocol entry removed.
- `clinical-engine.schema.json` — MENOPAUSE conditionScore + protocol entry removed; kit row marked `[RETIRED trigger path]`.
- `questionnaire.schema.json` — clinicalMappings "Menopause" entry removed.
- `extraction-rules.json` — RULE-HORM-07 (menopause-state) removed.
Kit kept registered in `info.ts`, `kitBrandNames`, kits/protocols dictionaries — reachable only via clinician override / direct sequencer entry.

### F-4 — Early Greying Q-mapped trigger absent from Sequencer sheet
**Severity:** low.
**Finding:** CKM §8 notes Early Greying has no row in `DrFACT_Protocol_Sequencer Final.xlsx`. Code path exists via `greyGoalRule.ts` + `absoluteLocks.ts` EARLY_GREY_LOCK.
**Action:** Update sequencer sheet OR formally treat code path as canonical.

---

## 2. Broken References

### F-5 — `giGoldFinalGuardRule.ts` strips kits emitted by upstream schema triggers — **RESOLVED 2026-06-18**
**Severity:** low (defense works, but logic was duplicated). **Status: RESOLVED — schema text tightened.**
**Finding:** Schema had the Constipation option emit `realGutSignal=true → PRO FACT GI GOLD injection` in its triggers and scoringSignals text. The runtime guard `giGoldFinalGuardRule.ts` already stripped GI GOLD in that case.
**Resolution (2026-06-18):** `questionnaire.schema.json` updated:
- Constipation option's `triggers` array cleared (no longer lists GI GOLD injection).
- `GI_GOLD_INJECTION` scoringSignal rule text changed from `IBS/GERD/Acid/Crohn/Constipation` to `IBS/GERD/Acid/Crohn`.
Schema doc now matches the locked governance and the runtime guard.

### F-6 — "peri" substring matcher risks false positives
**Severity:** medium.
**Finding:** Schema scoringSignal `PERI_MENOPAUSE_SCORE` lists matches `Peri-menopause / Peri menopause / Perimenopause / peri / Peri-Menopause`. The bare `'peri'` substring could collide with words like "Pericardial", "Periodontal", "Pericoronitis" if such phrases were ever entered in `medical_detail` or `extra` free-text. Memory feedback `feedback_questionnaire_changes_2026_06_15.md` explicitly references the "'peri' substring collision fix".
**Counterpart:** `signals.ts` whole-token / dropdown-value matchers are safer.
**Action:** Verify runtime matcher (clinical-engine/signals.ts) is anchored to whole-token equality against the option value, not substring-match against free-text. Memory says this was fixed; verify the schema text is just stale documentation.

### F-7 — F-PCOS-1 mid-retirement
**Severity:** medium.
**Finding:** Memory feedback `feedback_kit_injection_rules.md` retires F-PCOS-1. CKM §1 Q9 still lists "PCOS / PCOD / PMOS → F-PCOS-1 (VEG variant if Q12 = veg) (confirmed)". CKM kit master row 11 still lists F-PCOS-1 as Active. Schema clinicalMappings (questionnaire.schema.json line 2117) maps "PCOS only (no obesity)" → "F-PCOS -1 ONLY".
**Counterpart:** Memory lock is later (after CKM v2 2026-06-08).
**Action:** Either restore F-PCOS-1 as the pure-PCOS Phase 1 kit (and update memory), or rewrite CKM Q9 + schema clinicalMapping to use PRO FACT META B PCOS for pure PCOS too.

### F-8 — "Scarring alopecia" still listed in CKM §1 Q6
**Severity:** low.
**Finding:** CKM §1 Q6 row shows "Scarring alopecia → Male: PHENOTYPE + MPHL; Female: PHENOTYPE + TE Gold". But memory lock `feedback_questionnaire_changes_2026_06_15.md` removed Scarring alopecia from `immunity` options. Schema verified — Scarring alopecia is absent from current `immunity` options. CKM doc is stale.
**Action:** Drop Scarring alopecia row from CKM §1 Q6.

---

## 3. Unused Kits / Signals / Questions

### F-9 — META B MENOPAUSE orphaned (see F-3) — **RESOLVED 2026-06-18**
**Severity:** medium-high. **Status: RESOLVED — see F-3.** Kit kept registered for clinician override; questionnaire-driven trigger paths stripped.

### F-10 — `extra` (free text) has zero structured signals
**Severity:** none — by design (LLM narrative input only). Documented.

### F-11 — `medical_detail` has zero structured signals
**Severity:** none — by design (LLM context). Documented.

### F-12 — HRT option has zero structured signals
**Severity:** none — clinical context for LLM narrative. Documented.

### F-13 — "Not sure" and "None of the above" options across many questions have no triggers
**Severity:** none — by design as null choices. Documented.

### F-14 — `THYROID_HYPER_SCORE` exists but no PCOS+Hyper combination rule
**Severity:** low.
**Finding:** `thyroidInjectionRule.ts` handles PCOS+Hypo (unification → plain META B) explicitly. PCOS+Hyper does not appear — Hyper triggers THYROID CARE; PCOS+Hyper would yield two kits (THYROID CARE + F-PCOS-1 or META B PCOS) with no integration rule.
**Action:** Verify clinical desire — likely THYROID CARE wins.

---

## 4. Logic Conflicts

### F-15 — Constipation triggers GI GOLD in schema but is stripped by guard — **RESOLVED 2026-06-18**
**Severity:** medium. **Status: RESOLVED — see F-5.** Schema text tightened so Constipation no longer routes to GI GOLD.

### F-16 — F-PCOS-1 conflict between memory lock and CKM
**Severity:** medium. See F-7.

### F-17 — TE GOLD suppression sources overlap
**Severity:** low (defense works).
**Finding:** TE GOLD can be suppressed by:
1. `TE_GOLD_SUPPRESSION_V39` (Q2 thinning/no visible fall).
2. `REGROW_GOAL_FLAG` (regrow-only goal).
3. `periMenopauseSupersedesTeGoldRule.ts`.
4. `giGoldSupersedesTeGoldRule.ts`.
Multiple suppressors are safe but rule ordering matters when paths overlap.
**Action:** Confirm `kitPrioritizer.ts` enforces deterministic suppression order. Document the order in `04_RECOMMENDATION_ENGINE.md` §6 entry for TE GOLD.

### F-18 — Genetics + Female ≥ 30 (G-4) interaction with FPHL_AGE_GATE
**Severity:** low.
**Finding:** `FPHL_AGE_GATE` (age signal) says "Female 30+ → FPHL appropriate". `G-4` (governance) says "Genetics + Female ≥ 30 → FPHL suppressed entirely". The two coexist; G-4 must win when Genetics is present.
**Action:** Verify `agaRules.ts` checks G-4 before FPHL_AGE_GATE allows FPHL — currently expected via short-circuit on `hasGeneticCause`.

### F-19 — Q3 hairtype "Broken/short" dependency — **RESOLVED 2026-06-18**
**Severity:** was P0. **Status: RESOLVED — HBR re-routed to Hard water (cause field) as the sole corroborating shaft-damage signal.**
**Finding:** HBR gating depended on Q3 "Broken/short" — but the option had been retired. With the option absent, `confirmedBreakage` could never be true, leaving HBR effectively ungated and G-3 unenforceable from the questionnaire.
**Resolution (2026-06-18):** Dead Q3 dependency stripped from all live code paths:
- `lifestyleRules.ts` — `HAIR_BREAKAGE +52` now requires only `cause includes 'Hard water'`.
- `signalGatedInjectionRule.ts` — `confirmedBreakage` removed from standalone-HBR trigger; `triggerSignal = hardWater || heatChemical`.
- `pcosStackRule.ts` — `PCOS_HBR` path now `needsHBR = hardWater`.
- `checkTherapyEligibility.ts` — `deriveConfirmedBreakage` removed; SR_005 simplified: HBR eligible when Hard water present; blocked when heat/chemical reported without Hard water.
- `therapy_blocks.json` — SR_005 trigger + variables cleaned.
- Schema docs (`questionnaire.schema.json`, `clinical-engine.schema.json`) — all "Broken/short" references rewritten to reference Hard water as the corroborating signal.
G-3 governance still applies, now expressed as: heat/chemical alone is insufficient; Hard water in cause is the required corroboration.

---

## 5. Duplicate Logic

### F-20 — THYROID_HYPO score fires from two fields
**Severity:** low (intentional).
**Finding:** `THYROID_HYPO_SCORE +100` fires from BOTH `thyroid` field AND `hormonal` field "Thyroid". Documented cross-field dependency.
**Counterpart:** runtime `S.step` removes "Thyroid disorder" option from `hormonal` at runtime (schema lines 3156–3167) — so this cross-field is largely deactivated, but the signal definition still references hormonal.
**Action:** Tighten signal definition to `thyroid` field only since hormonal "Thyroid disorder" is no longer presented.

### F-21 — PCOS scoring path duplicated
**Severity:** low.
**Finding:** PCOS routing logic appears in `pcosStackRule.ts`, `pcosMetaBVariantRule.ts`, and `thyroidInjectionRule.ts` (THYROID_PCOS_UNIFICATION). Three rule files coordinate PCOS state.
**Canonical:** `pcosStackRule.ts` for primary stack assembly; `pcosMetaBVariantRule.ts` for G-2 variant swap; `thyroidInjectionRule.ts` for PCOS+Hypo collapse.
**Action:** Document the ordering contract in code comments; ensure rules run in canonical order.

### F-22 — Veg swap logic appears in HR-1 + per-option triggers
**Severity:** low.
**Finding:** HR-1 (`resolveKit.ts`) globally swaps to VEG variants. Per-option `triggers` (e.g., schema Vegetarian/Vegan) also says "→ isVeg=true → resolveKit() swaps all eligible kits to VEG variants". Same logic expressed twice.
**Canonical:** `resolveKit.ts`.
**Action:** No fix needed; redundancy is benign documentation.

---

## 6. Priority Conflicts

### F-23 — PCOS+Hypothyroid priority resolution
**Severity:** none (resolved by lock).
**Finding:** `PCOS_THYROID_PRIORITY` signal text: "PCOS + Hypothyroidism → PCOS priority raised to 101 (beats THYROID_HYPO at 100)". Memory lock 2026-06-17 (`thyroidInjectionRule.ts` THYROID_PCOS_UNIFICATION) supersedes — both META B PCOS + META B HYPOTHYROID stripped, only plain META B remains.
**Counterpart:** Score-based priority is moot under the unification rule.
**Action:** Mark `PCOS_THYROID_PRIORITY` as obsolete in the signal registry.

### F-24 — Sequencer xlsx vs Mapping xlsx disagree on Post-partum
**Severity:** none (resolved by G-1).
**Finding:** CKM §8 notes Sequencer's "TE GOLD + PRO IMMUNE GOLD" entry for Post-partum (not feeding) is stale; G-1 makes Mapping win (META B + PRO IMMUNE GOLD).
**Action:** Update Sequencer xlsx to match G-1.

---

## 7. Cross-Chain Coverage Matrix

For each questionnaire question → ensure a downstream kit or narrative consumes it:

| Question | Downstream Kit | Downstream Narrative | Downstream Video | Status |
|---|---|---|---|---|
| name | — | LLM greeting | avatar voiceover | ✅ |
| age | gates FPHL/AGA/Early-Grey | report severity | avatar variant | ✅ |
| goal | EARLY_GREY/REGROW/full | report header | avatar branch | ✅ |
| sex | MPHL/FPHL gate; HR-3/HR-4 | report sections | avatar variant | ✅ |
| duration | TE GOLD positioning | TE timeline | — | ✅ |
| count | TE GOLD positioning + TE_GOLD_SUPPRESSION_V39 | shedding phrasing | — | ✅ |
| hairtype | AGA/AA routing (HBR re-routed to `cause`) | pattern phrasing | — | ✅ (F-19 resolved) |
| scalp | PHENOTYPE / HBR / AGA | scalp section | — | ✅ |
| cause | TE/AGA/TTM/RWLS/HBR | root cause section | avatar root-cause module | ✅ |
| immunity | AA/PHENOTYPE/PRO IMMUNE | immune section | — | ✅ |
| lifestyle | OXIDATIVE/META B/NIGHT/FLYERS | lifestyle section | — | ✅ |
| thyroid | THYROID CARE / META B HYPO | thyroid section | — | ✅ |
| medical | PRO IMMUNE + PHENOTYPE | chronic section | — | ✅ |
| medical_detail | — | LLM context only | — | ✅ |
| hormonal | full hormonal stack | hormonal section | avatar hormonal branch | ✅ (F-3 resolved — META B MENOPAUSE trigger stripped) |
| gut | GI GOLD / GI HEALTH | gut-hair axis | — | ✅ (F-5 resolved — schema text tightened) |
| deficiency | IRON UP + PRO IMMUNE | iron section | — | ✅ |
| diet | HR-1 VEG / META B / RWLS | dietary section | — | ✅ |
| treatment | HBR (G-3 gated by Hard water corroboration) | styling section | — | ✅ (F-19 resolved — G-3 now gated on Hard water) |
| grade | MPHL/FPHL PLUS / G45 lock | severity prognosis | avatar pattern reveal | ✅ |
| extra | — | LLM context only | — | ✅ |

## 8. Recommended Triage

| Priority | Finding | Action |
|---|---|---|
| ✅ Resolved 2026-06-18 | F-3, F-5, F-9, F-15, F-19 | HBR re-routed to Hard water; META B MENOPAUSE trigger stripped (kit kept registered); Constipation removed from GI GOLD schema text |
| P1 | F-7 | Reconcile F-PCOS-1 retirement (memory lock vs CKM + schema clinicalMappings) |
| P2 | F-6 | Confirm "peri" matcher is whole-token in runtime |
| P2 | F-2 | Add `giHealthInjectionRule.ts` OR document its absence |
| P3 | F-1 | Decide on static per-kit video blocks vs dynamic-only |
| P3 | F-8, F-23, F-24 | Doc cleanup — drop stale Scarring alopecia row, obsolete signals, update Sequencer xlsx |
