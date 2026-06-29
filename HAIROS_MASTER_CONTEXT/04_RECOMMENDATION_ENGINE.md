# 04 — Recommendation Engine (Authoritative)

## Executive Summary
HairOS produces a deterministic, auditable 4-phase oral-kit protocol per patient. Pipeline: `deriveSignals` → `scoreConditions` (DiagnosisKey scores) → `cause-registry` (10 root causes, Bayesian softmax) → `evaluateClinicalProfile` (ClinicalProfile) → `scoreKits` + 16 kit-scorer rules → hard rules HR-1..HR-6 → governance overrides G-1..G-4 → dedupe → `kitPrioritizer` → `protocolSequencer` (DiagnosisKey → phase order) → `buildProtocol` (4 phases) → `buildTopicals` → `resolveKit` (VEG / gender swap). Every recommendation carries upstream cause chain, ranking position, and exclusion rationale for non-selected candidates (RDE constitution §7). Canonical mapping is `CONDITION_KIT_MAPPING_REFERENCE.md` (v2 2026-06-08). Memory-locked rules: GI GOLD = GERD/IBS/Acid reflux/Crohn only at Phase 1; PCOS+Hypo → plain META B; HBR conditional on Q3 broken/short; menopause continuum non-negotiable; HEAVY bleeding → IRON UP Phase 1.

## 1. Canonical Reasoning Chain (RDE §7)
```
Root Cause → Clinical Objective → Capability → Intervention Class
           → Recommendation Candidate → Kit Eligibility → Recommendation
```
No layer may be skipped or inverted. Causes are inputs to the RDE; the RDE does not adjudicate cause selection. RDE asserts **Kit Eligibility classes** — final kit-id resolution belongs to Kit Knowledge layer (`resolveKit.ts`).

## 2. Pipeline (code-anchored)
```
patient answers
  │
  ▼ signalExtractor (frontend)            apps/patient-portal/src/runtime/signalExtractor.ts
  │
  ▼ deriveSignals                          src/packages/ai-engine/clinical-engine/deriveSignals.ts
  │  signals (canonical)                   src/packages/ai-engine/clinical-engine/signals.ts
  │
  ▼ scoreConditions                        src/packages/ai-engine/clinical-engine/scoreConditions.ts
  │  ranked DiagnosisKey scores            src/packages/ai-engine/clinical-engine/types.ts
  │
  ▼ cause-registry (10 causes, softmax)    src/packages/ai-engine/cause-registry/{catalog,engine}.ts
  │
  ▼ evaluateClinicalProfile                src/packages/ai-engine/clinical-engine/evaluateClinicalProfile.ts
  │  ClinicalProfile { primary, secondary, severity, drivers, gradeBand, ... }
  │
  ▼ scoreKits + 16 rules                   src/packages/ai-engine/kit-scorer/scoreKits.ts + rules/
  │
  ▼ applyHardRules (HR-1..HR-6)            kit-scorer/rules/* + ranking/kitCapCalculator.ts
  ▼ applyGovernance (G-1..G-4)             encoded in rules/
  ▼ dedupe + kitPrioritizer                kit-scorer/ranking/kitPrioritizer.ts
  ▼ protocolSequencer                      kit-scorer/protocolSequencer.ts
  ▼ buildProtocol (4 phases)               clinical-engine/buildProtocol.ts
  ▼ buildTopicals                          clinical-engine/buildTopicals.ts
  ▼ resolveKit (VEG / gender)              kit-scorer/resolveKit.ts
```

## 3. Priority Hierarchy — Phase-1 Precedence
Top-down, first match wins (CKM §5 + `kit-scorer/rules/` enforcement). When multiple kits qualify for Phase 1, this order resolves which gets the slot:

| Rank | Kit / class | Trigger | Source rule |
|---|---|---|---|
| 1 | **HEALTHY-9 (Pregnancy)** | hormonal includes "Currently pregnant" | HR-2 absolute lock (`absoluteLocks.ts`) |
| 2 | **PRO FACT GI GOLD** | gut includes GERD / IBS / Acid reflux / Crohn (Q10) | `giGoldFinalGuardRule.ts`, `giGoldSupersedesTeGoldRule.ts` |
| 3 | **IRON UP GOLD** | deficiency Iron OR hormonal Heavy bleeding periods (F 18–50) | `ironUpInjectionRule.ts` |
| 4 | **LACTIHEALTH / RAPID WEIGHT LOSS SHIELD** | postpartum still feeding / GLP-1 (early) / crash diet | `lactihealthInjectionRule.ts`, `glp1PrecedenceRule.ts` |
| 5 | **Condition-specific** — HAIR FACT ALOPECIA AREATA / TTM / NIGHT SHIFT / FREQUENT FLYERS / FH WELL 3 | Q-specific triggers | `signalGatedInjectionRule.ts` |
| 6 | **Hormonal** — F-PCOS-1 / PRO FACT META B PCOS / META B HYPOTHYROID / THYROID CARE / PERI MENOPAUSE / META B POSTMENOPAUSE | hormonal/thyroid | `pcosMetaBVariantRule.ts`, `pcosStackRule.ts`, `thyroidInjectionRule.ts`, `menopauseContinuumInjectionRule.ts`, `periMenopauseSupersedesTeGoldRule.ts` |
| 7 | **PRO FACT META B (metabolic)** | Q7 obesity/sedentary/diet, Q8 chronic, Q4 genetics-F≥30, Q4 post-partum (not feeding) | `metabolicModifierRule.ts` |
| 8 | **HAIR FACT HBR** | `cause` Hard water (corroborating shaft-damage signal). Heat/chemical alone insufficient. | G-3 governance |
| 9 | **PHENOTYPE INFLAMMATION** | terrain — Phase 1 only if no stronger root cause OR if multifactorial (≥3 root causes across Q4/Q7/Q8/Q9) | `signalGatedInjectionRule.ts` |
| 10 | **HAIR FACT TE GOLD** | active shedding without higher-precedence root cause | `teGoldGatingRule.ts`, `activeSheddingRule.ts` |

**Universal multifactorial rule:** 3+ root causes across Q4/Q7/Q8/Q9 → PHENOTYPE INFLAMMATION forced to Phase 1, unless pregnancy / GI / Iron already occupies it (CKM §5).

## 4. Driver Hierarchy
Ten root causes from `cause-registry/catalog.ts` (Bayesian softmax + compositeRule for multifactorial). Ranked by clinical priority when isolated:

| Rank | Driver | Phase-1 kit class |
|---|---|---|
| 1 | Pregnancy | HEALTHY-9 (exclusive) |
| 2 | Gut Dysbiosis | PRO FACT GI GOLD |
| 3 | Iron Deficiency | IRON UP GOLD |
| 4 | Autoimmune (AA) | HAIR FACT ALOPECIA AREATA |
| 5 | Acute Hormonal Shift (postpartum, peri/menopause) | LACTIHEALTH / PERI MENOPAUSE / META B POSTMENOPAUSE |
| 6 | Endocrine-Metabolic (PCOS, Thyroid, Diabetes) | PRO FACT META B family |
| 7 | Genetic / Androgenetic (AGA) | MPHL / FPHL |
| 8 | Telogen Effluvium (stress / illness / nutrition) | HAIR FACT TE GOLD |
| 9 | Inflammatory Phenotype | PHENOTYPE INFLAMMATION |
| 10 | Oxidative / Lifestyle | OXIDATIVE STRESS (when count ≥ 2 lifestyle signals) |

Multifactorial composite causes (3+ drivers) → PHENOTYPE INFLAMMATION Phase 1.

## 5. Kit Hierarchy (Tiered)

| Tier | Examples | Phase placement |
|---|---|---|
| **Terrain / Root-Cause** | HEALTHY-9, GI GOLD, IRON UP GOLD, ALOPECIA AREATA, F-PCOS-1, META B family, THYROID CARE, PERI MENOPAUSE, NIGHT SHIFT, FREQUENT FLYERS, TTM, LACTIHEALTH, RWLS, HBR, FH WELL 3 | Phase 1 |
| **Primary Condition** | TE GOLD, MPHL, FPHL, PHENOTYPE INFLAMMATION (as primary) | Phase 2 |
| **Systemic / Immune** | PRO IMMUNE GOLD, OXIDATIVE STRESS | Phase 3 |
| **Consolidation** | PRO IMMUNE GOLD PLUS | Phase 4 |

## 6. Per-Kit Decision Block

### HEALTHY-9
- **Purpose:** Pregnancy hair support — the only kit allowed during pregnancy.
- **Trigger Conditions:** `hormonal` includes "Currently pregnant".
- **Minimum Criteria:** sex == Female (HR-3); confirmed pregnancy.
- **Exclusion Criteria:** Not pregnant.
- **Priority Position:** Phase 1, exclusive (HR-2 absolute lock).
- **Mutual Exclusions:** All other kits suppressed.
- **Severity Thresholds:** none — pregnancy lock bypasses scoring.
- **Recommendation Narrative pointer:** `all-kits-info.txt` HEALTHY-9 block (search "HEALTHY-9").
- **Video Narrative pointer:** [MISSING] — generic pregnancy avatar branch only.
- **Expected Timeline:** Duration of pregnancy.
- **Source:** `absoluteLocks.ts` `PREGNANCY_LOCK`.

### PRO FACT GI GOLD
- **Purpose:** Gut-axis upstream correction for inflammatory bowel patterns.
- **Trigger Conditions:** `gut` includes GERD / IBS / Acid reflux / Crohn (Q10). **Locked**: NEVER for Bloating/Constipation/Indigestion alone (memory feedback 2026-06-XX; enforced by `giGoldFinalGuardRule.ts`).
- **Minimum Criteria:** ≥1 of the four locked options.
- **Exclusion Criteria:** Only Bloating/Constipation/Indigestion (route to GI HEALTH + PRO IMMUNE instead).
- **Priority Position:** Phase 1 — supersedes TE GOLD (`giGoldSupersedesTeGoldRule.ts`).
- **Mutual Exclusions:** none.
- **Severity Thresholds:** any active gut signal.
- **Recommendation Narrative pointer:** `all-kits-info.txt` "Gi Gold" block (line ~713).
- **Video Narrative pointer:** [MISSING].
- **Expected Timeline:** Phase 1 (M1–M2); reassess at M3.
- **Source:** `giGoldFinalGuardRule.ts`, `giGoldSupersedesTeGoldRule.ts`.

### IRON UP GOLD
- **Purpose:** Iron / ferritin repletion — non-negotiable Phase 1.
- **Trigger Conditions:** `deficiency` Iron/Anaemia OR `hormonal` Heavy bleeding periods (Female 18–50).
- **Minimum Criteria:** Either declared signal.
- **Exclusion Criteria:** Pregnancy lock (HR-2).
- **Priority Position:** Phase 1, top precedence after Pregnancy/GI.
- **Mutual Exclusions:** none.
- **Severity Thresholds:** IRON_DEFICIENCY +80.
- **Recommendation Narrative pointer:** `all-kits-info.txt` IRON UP block.
- **Video Narrative pointer:** [MISSING].
- **Expected Timeline:** 8–12 weeks then reassess ferritin.
- **Source:** `ironUpInjectionRule.ts`.

### LACTIHEALTH
- **Purpose:** Lactation nutritional support; Phase 1 for breastfeeding mothers.
- **Trigger Conditions:** `cause` "Post partum — still feeding" OR `hormonal` "Post-delivery or breastfeeding".
- **Minimum Criteria:** sex == Female (HR-3); breastfeeding declared.
- **Exclusion Criteria:** Pregnancy (HEALTHY-9 only).
- **Priority Position:** Phase 1.
- **Mutual Exclusions:** PRO FACT META B + PRO IMMUNE follow in subsequent phases.
- **Severity Thresholds:** TE_POSTPREG +92.
- **Recommendation Narrative pointer:** `all-kits-info.txt` LACTIHEALTH block.
- **Video Narrative pointer:** [MISSING].
- **Expected Timeline:** While breastfeeding + 3 months post-wean.
- **Source:** `lactihealthInjectionRule.ts`.

### RAPID WEIGHT LOSS SHIELD (RWLS)
- **Purpose:** Shield against rapid-weight-loss/GLP-1/crash-diet shedding.
- **Trigger Conditions:** `cause` "Post GLP-1 (within 6 months)" → RWLS Phase 1 position 0; "(after 6 months)" → RWLS position 1 after primary kit (TE GOLD leads); "Rapid weight loss / Crash diet" → RWLS Phase 1; OR `diet` "Crash/Keto/IF".
- **Minimum Criteria:** Any of the above.
- **Exclusion Criteria:** Pregnancy.
- **Priority Position:** Phase 1 (or Phase 2 for GLP-1 late).
- **Mutual Exclusions:** TE GOLD is NOT suppressed; positioned after Shield for GLP-1 early.
- **Severity Thresholds:** WEIGHT_LOSS +90.
- **Recommendation Narrative pointer:** `all-kits-info.txt` RAPID WEIGHT LOSS SHIELD block.
- **Video Narrative pointer:** [MISSING].
- **Expected Timeline:** Phase 1 (M1–M2) then transition.
- **Source:** `glp1PrecedenceRule.ts`.

### HAIR FACT ALOPECIA AREATA
- **Purpose:** Autoimmune AA targeted immune modulation.
- **Trigger Conditions:** `immunity` "Alopecia Areata" OR `hairtype` "Circular bald patches".
- **Minimum Criteria:** ALOPECIA_AREATA +105 (near-absolute lock); grade question SKIPPED.
- **Exclusion Criteria:** none.
- **Priority Position:** Phase 1.
- **Mutual Exclusions:** Sequence: AA → META B → PHENOTYPE → PRO IMMUNE.
- **Severity Thresholds:** ALOPECIA_AREATA +105 dominant.
- **Recommendation Narrative pointer:** `all-kits-info.txt` Alopecia Areata block.
- **Video Narrative pointer:** [MISSING].
- **Expected Timeline:** 6+ months continuous.
- **Source:** `signalGatedInjectionRule.ts`; AA score in `scoreConditions.ts`.

### F-PCOS-1 (and F-PCOS VEG-1)
- **Purpose:** Pure PCOS hormonal correction.
- **Trigger Conditions:** `hormonal` "PCOS/PCOD/PMOS" with NO obesity/sedentary/pre-diabetes/diabetes signals.
- **Minimum Criteria:** sex == Female; PCOS_ONLY route.
- **Exclusion Criteria:** Obesity/Sedentary signal (→ G-2, PRO FACT META B PCOS instead, F-PCOS-1 NOT added); Hypothyroid (→ PCOS+Hypo lock → plain META B).
- **Priority Position:** Phase 1.
- **Mutual Exclusions:** Memory-locked: when PCOS pure, F-PCOS-1 ONLY (no PRO IMMUNE/FPHL/PHENOTYPE unless signals fire).
- **Severity Thresholds:** PCOS_ONLY +92.
- **Recommendation Narrative pointer:** `all-kits-info.txt` PCOS / PMOS block (line ~557).
- **Video Narrative pointer:** [MISSING].
- **Expected Timeline:** 6+ months.
- **Source:** `pcosStackRule.ts`; *memory feedback notes F-PCOS-1 effectively retired in favor of PRO FACT META B PCOS — see VALIDATION.*

### PRO FACT META B PCOS
- **Purpose:** PCOS + metabolic dysfunction (obesity/sedentary/pre-diabetes/diabetes).
- **Trigger Conditions:** PCOS + obesity/sedentary signal.
- **Minimum Criteria:** Female; PCOS_OBESITY route.
- **Exclusion Criteria:** PCOS + Hypothyroid → plain META B (memory 2026-06-17).
- **Priority Position:** Phase 1; G-2 — F-PCOS-1 NOT added in this case.
- **Mutual Exclusions:** F-PCOS-1 suppressed.
- **Severity Thresholds:** PCOS_OBESITY +92 (101 if also Hypothyroid before unification).
- **Recommendation Narrative pointer:** `all-kits-info.txt` PCOS block.
- **Video Narrative pointer:** [MISSING].
- **Expected Timeline:** 6+ months.
- **Source:** `pcosMetaBVariantRule.ts`.

### PRO FACT META B HYPOTHYROID
- **Purpose:** Hypothyroid metabolic correction.
- **Trigger Conditions:** `thyroid` "Hypothyroidism" OR `hormonal` "Hypothyroidism" — and no other META B variant (plain/MENO/POST) already present, no PCOS.
- **Minimum Criteria:** as above.
- **Exclusion Criteria:** +Obesity → swap to plain META B (v34 override); +PCOS → plain META B (2026-06-17 lock); + Menopause continuum kit → leave continuum kit.
- **Priority Position:** Phase 1.
- **Mutual Exclusions:** see exclusion criteria.
- **Severity Thresholds:** THYROID_HYPO +100.
- **Recommendation Narrative pointer:** `all-kits-info.txt` META B HYPOTHYROID block.
- **Video Narrative pointer:** [MISSING].
- **Expected Timeline:** 6+ months.
- **Source:** `thyroidInjectionRule.ts`.

### PRO FACT THYROID CARE
- **Purpose:** Hyperthyroid hair loss.
- **Trigger Conditions:** `thyroid` "Hyperthyroidism".
- **Minimum Criteria:** as above.
- **Exclusion Criteria:** Pregnancy.
- **Priority Position:** Phase 1.
- **Mutual Exclusions:** does not overlap with META B family.
- **Severity Thresholds:** THYROID_HYPER +100.
- **Recommendation Narrative pointer:** `all-kits-info.txt` THYROID CARE block.
- **Video Narrative pointer:** [MISSING].
- **Expected Timeline:** 6+ months.
- **Source:** `thyroidInjectionRule.ts`.

### HAIR FACT PERI MENOPAUSE (and VEG)
- **Purpose:** Peri-menopausal hormonal stabilization.
- **Trigger Conditions:** `hormonal` "Peri-menopause".
- **Minimum Criteria:** Female; peri match (whole-token).
- **Exclusion Criteria:** Pregnancy.
- **Priority Position:** Phase 1; supersedes TE GOLD (`periMenopauseSupersedesTeGoldRule.ts`).
- **Mutual Exclusions:** Sequence PERI MENOPAUSE → FPHL → TE GOLD → PRO IMMUNE; +metabolic → PRO FACT META B inserted after Phase 1.
- **Severity Thresholds:** PERI_MENOPAUSE +98.
- **Recommendation Narrative pointer:** `all-kits-info.txt` Perimenopause block (line ~410, ~630).
- **Video Narrative pointer:** [MISSING].
- **Expected Timeline:** 6–12 months.
- **Source:** `menopauseContinuumInjectionRule.ts`, `periMenopauseSupersedesTeGoldRule.ts`.

### PRO FACT META B POSTMENOPAUSE
- **Purpose:** Post-menopausal transition support.
- **Trigger Conditions:** `hormonal` "Post-menopause".
- **Minimum Criteria:** Female.
- **Exclusion Criteria:** Pregnancy.
- **Priority Position:** Phase 1.
- **Mutual Exclusions:** Sequence META B POSTMENOPAUSE → FPHL → TE GOLD → PRO IMMUNE.
- **Severity Thresholds:** POST_MENOPAUSE +98.
- **Recommendation Narrative pointer:** `all-kits-info.txt` PERI/POST MENOPAUSE blocks.
- **Video Narrative pointer:** [MISSING].
- **Expected Timeline:** 6+ months.
- **Source:** `menopauseContinuumInjectionRule.ts`.

### FH WELL 3
- **Purpose:** Endometriosis-driven hormonal inflammation.
- **Trigger Conditions:** `hormonal` "Endometriosis".
- **Minimum Criteria:** Female.
- **Exclusion Criteria:** none.
- **Priority Position:** Phase 1.
- **Mutual Exclusions:** Sequence FH WELL 3 → PHENOTYPE → PRO IMMUNE.
- **Severity Thresholds:** ENDOMETRIOSIS +85.
- **Recommendation Narrative pointer:** `all-kits-info.txt` FH WELL 3 block.
- **Video Narrative pointer:** [MISSING].
- **Expected Timeline:** 6+ months.
- **Source:** `signalGatedInjectionRule.ts`.

### HAIR FACT NIGHT SHIFT
- **Purpose:** Circadian disruption correction.
- **Trigger Conditions:** `lifestyle` "Night shift work".
- **Minimum Criteria:** as above.
- **Exclusion Criteria:** none.
- **Priority Position:** Phase 1.
- **Mutual Exclusions:** Sequence NIGHT SHIFT → TE GOLD → PHENOTYPE.
- **Severity Thresholds:** NIGHT_SHIFT +62.
- **Recommendation Narrative pointer:** `all-kits-info.txt` NIGHT SHIFT block.
- **Video Narrative pointer:** [MISSING].
- **Expected Timeline:** 4–6 months.
- **Source:** `signalGatedInjectionRule.ts`.

### HAIR FACT FREQUENT FLYERS
- **Purpose:** Frequent-flying circadian + radiation stress.
- **Trigger Conditions:** `lifestyle` "Frequent flying".
- **Minimum Criteria:** as above.
- **Exclusion Criteria:** none.
- **Priority Position:** Phase 1.
- **Mutual Exclusions:** Sequence FREQUENT FLYERS → TE GOLD → PHENOTYPE.
- **Severity Thresholds:** FREQUENT_FLYING +58.
- **Recommendation Narrative pointer:** `all-kits-info.txt` FREQUENT FLYERS block.
- **Video Narrative pointer:** [MISSING].
- **Expected Timeline:** 4–6 months.
- **Source:** `signalGatedInjectionRule.ts`.

### HAIR FACT TTM
- **Purpose:** Trichotillomania neurological + follicle support.
- **Trigger Conditions:** `cause` "Hair pulling habit (Trichotillomania)".
- **Minimum Criteria:** TTM +102.
- **Exclusion Criteria:** none.
- **Priority Position:** Phase 1.
- **Mutual Exclusions:** Sequence TTM → TE GOLD → PHENOTYPE.
- **Severity Thresholds:** +102 near-lock.
- **Recommendation Narrative pointer:** `all-kits-info.txt` TTM block.
- **Video Narrative pointer:** [MISSING].
- **Expected Timeline:** 6+ months (paired with behavioral therapy).
- **Source:** `signalGatedInjectionRule.ts`.

### HAIR FACT HBR
- **Purpose:** Hair shaft breakage repair (keratin/cortex).
- **Trigger Conditions:** `cause` includes "Hard water" — the sole reachable shaft-damage signal after the Q3 "Broken/short" option was retired (2026-06-15 lock; dependency stripped from code 2026-06-18).
- **Minimum Criteria:** Hard water present.
- **Exclusion Criteria:** Heat/Chemical alone without Hard water → HBR NOT added (G-3 unchanged in spirit; corroboration now via Hard water).
- **Priority Position:** Phase 1.
- **Mutual Exclusions:** standalone-only per memory lock.
- **Severity Thresholds:** HAIR_BREAKAGE +52 (Hard water).
- **Recommendation Narrative pointer:** `all-kits-info.txt` HBR block.
- **Video Narrative pointer:** [MISSING].
- **Expected Timeline:** 3–4 months.
- **Source:** Governance G-3 (CKM §4); enforced in `checkTherapyEligibility.ts` (SR_005), `signalGatedInjectionRule.ts`, `pcosStackRule.ts`, `lifestyleRules.ts`.

### PRO FACT META B (plain)
- **Purpose:** Metabolic terrain correction (insulin / adipose / AMPK / T3).
- **Trigger Conditions:** Q7 obesity/sedentary/diet OR Q8 chronic OR Q4 Genetics F≥30 OR Q4 Post-partum (not feeding) OR composite (PCOS+Hypo, Hypo+Obesity, PCOS+Diabetes upgrade).
- **Minimum Criteria:** any of the above.
- **Exclusion Criteria:** none structural.
- **Priority Position:** Phase 1 (when metabolic root) / Phase 2 otherwise.
- **Mutual Exclusions:** Strips META B PCOS + META B HYPOTHYROID when PCOS+Hypo (THYROID_PCOS_UNIFICATION).
- **Severity Thresholds:** depends on driver.
- **Recommendation Narrative pointer:** `all-kits-info.txt` META B block (~line 264).
- **Video Narrative pointer:** [MISSING].
- **Expected Timeline:** 6+ months.
- **Source:** `metabolicModifierRule.ts`, `thyroidInjectionRule.ts`.

### HAIR FACT TE GOLD (and VEG)
- **Purpose:** Telogen Effluvium stabilization — five-pathway (inflammation/nutrition/metabolic/hormonal/stress).
- **Trigger Conditions:** active shedding (Q1 1–3/3–6mo, Q2 50–100/100+, Q3 white bulb, Q4 stress/nutrition/illness).
- **Minimum Criteria:** active shedding declared.
- **Exclusion Criteria:** Q2 "thinning/no visible fall" → TE GOLD permanently suppressed (TE_GOLD_SUPPRESSION_V39); regrow-only goal suppresses TE GOLD; peri-menopause supersedes TE GOLD (`periMenopauseSupersedesTeGoldRule.ts`); GI GOLD supersedes TE GOLD (`giGoldSupersedesTeGoldRule.ts`).
- **Priority Position:** Phase 1 if active shedding + no stronger root cause; Phase 2 otherwise.
- **Mutual Exclusions:** see exclusion criteria.
- **Severity Thresholds:** TE_STRESS +55 / TE_NUTRITION +58 / TE_ILLNESS +72 / TE_POSTPREG +92.
- **Recommendation Narrative pointer:** `all-kits-info.txt` TE GOLD block (line 2–89).
- **Video Narrative pointer:** [MISSING].
- **Expected Timeline:** W2–4 reduce shedding, W6–8 strength, W10–12 regrowth.
- **Source:** `teGoldGatingRule.ts`, `activeSheddingRule.ts`, `regrowGoalRule.ts`.

### MPHL (and MPHL PLUS)
- **Purpose:** Male androgenetic alopecia.
- **Trigger Conditions:** Male + Q3 widening/thinning OR Q4 genetics OR Q5 oily (Male) OR grade Norwood.
- **Minimum Criteria:** Male (HR-4 drops MPHL for Female).
- **Exclusion Criteria:** Female.
- **Priority Position:** Phase 2 (G1–G3); after PRO IMMUNE GOLD Phase 1 for G4–G5 (age ≥ 20).
- **Mutual Exclusions:** MPHL PLUS variant for G4–G5.
- **Severity Thresholds:** Grade 4/5 + age ≥ 20 → MPHL PLUS lock.
- **Recommendation Narrative pointer:** `all-kits-info.txt` MPHL block (line ~237).
- **Video Narrative pointer:** [MISSING].
- **Expected Timeline:** 12+ months continuous.
- **Source:** `agaRules.ts`.

### FPHL (and FPHL PLUS)
- **Purpose:** Female pattern hair loss.
- **Trigger Conditions:** Female + Q3 widening/thinning OR grade Ludwig OR Q5 oily/Female 30+.
- **Minimum Criteria:** Female; age ≥ 30 (FPHL_AGE_GATE); G-4 — suppressed entirely if Genetics + Female ≥ 30 (META B-led only).
- **Exclusion Criteria:** Male (HR-3); Female < 30 with genetics (→ TE + PRO IMMUNE); Genetics + F ≥ 30 (G-4).
- **Priority Position:** Phase 2 (G1–G3); after PRO IMMUNE GOLD Phase 1 for G4–G5 (age ≥ 20).
- **Mutual Exclusions:** FPHL PLUS variant for G4–G5.
- **Severity Thresholds:** Grade 4/5 + age ≥ 20 → FPHL PLUS lock.
- **Recommendation Narrative pointer:** `all-kits-info.txt` FPHL/MPHL block.
- **Video Narrative pointer:** [MISSING].
- **Expected Timeline:** 12+ months.
- **Source:** `agaRules.ts`, G-4 governance.

### PHENOTYPE INFLAMMATION
- **Purpose:** Universal inflammatory terrain clearer.
- **Trigger Conditions:** Q5 inflammation (Dandruff+Itching/Boils/Redness/Burning/Psoriasis/Oily-with-itching) OR Q6 Allergies/Asthma/Skin rash/AA OR multifactorial composite.
- **Minimum Criteria:** any inflammation signal.
- **Exclusion Criteria:** Pregnancy.
- **Priority Position:** Phase 1 if multifactorial OR no stronger root cause; Phase 2 otherwise.
- **Mutual Exclusions:** none.
- **Severity Thresholds:** SCALP_INFLAM +42/+62.
- **Recommendation Narrative pointer:** `all-kits-info.txt` Phenotype block (line ~206).
- **Video Narrative pointer:** [MISSING].
- **Expected Timeline:** 4–6 months.
- **Source:** `signalGatedInjectionRule.ts`.

### PRO IMMUNE GOLD (and VEG)
- **Purpose:** Systemic immune modulation.
- **Trigger Conditions:** `realImmuneSignal` true via immunity, gut, nutrition, illness/medication, age≥30+genetics, etc.
- **Minimum Criteria:** any immune signal.
- **Exclusion Criteria:** Pregnancy.
- **Priority Position:** Phase 3 (standard) — `proImmuneLastRule.ts` enforces last in standard sequence.
- **Mutual Exclusions:** PRO IMMUNE VEG variant under HR-1.
- **Severity Thresholds:** none direct.
- **Recommendation Narrative pointer:** `all-kits-info.txt` Pro immune gold block (line 91).
- **Video Narrative pointer:** [MISSING].
- **Expected Timeline:** 4–6 months.
- **Source:** `signalGatedInjectionRule.ts`, `proImmuneLastRule.ts`.

### PRO IMMUNE GOLD PLUS
- **Purpose:** Advanced immune consolidation for severe (G4–G5) cases.
- **Trigger Conditions:** Grade 4/5 lock OR severe multifactorial.
- **Minimum Criteria:** Severe severity.
- **Exclusion Criteria:** Pregnancy.
- **Priority Position:** Phase 4.
- **Mutual Exclusions:** none.
- **Severity Thresholds:** Severe.
- **Recommendation Narrative pointer:** `all-kits-info.txt` PRO IMMUNE block (advanced variant).
- **Video Narrative pointer:** [MISSING].
- **Expected Timeline:** Month 7+ consolidation.
- **Source:** consolidation logic in `protocolSequencer.ts`.

### OXIDATIVE STRESS
- **Purpose:** ROS damage / smoking / pollution.
- **Trigger Conditions:** `oxidativeCount ≥ 2` (Smoking + Alcohol + Asthma) OR EARLY_GREY protocol.
- **Minimum Criteria:** as above.
- **Exclusion Criteria:** Pregnancy.
- **Priority Position:** Phase 3 standalone when PHENOTYPE absent; Phase 3 augment when PHENOTYPE present.
- **Mutual Exclusions:** none.
- **Severity Thresholds:** OXIDATIVE +58 per signal.
- **Recommendation Narrative pointer:** `all-kits-info.txt` Oxidative Stress block (line ~660).
- **Video Narrative pointer:** [MISSING].
- **Expected Timeline:** 4–6 months.
- **Source:** `signalGatedInjectionRule.ts`.

### EARLY GREYING CARE (and VEG / GOLD)
- **Purpose:** Premature greying — melanocyte support.
- **Trigger Conditions:** `goal` sole "Early greying" (lock) OR `goal` Early greying + hair fall/regrow (`_hasGreyGoal` injects at end).
- **Minimum Criteria:** age < 30 (`_filterOpts` removes for age ≥ 30); goal selection.
- **Exclusion Criteria:** age ≥ 30; Pregnancy.
- **Priority Position:** Phase 1 (lock) OR end-of-protocol injection (co-condition).
- **Mutual Exclusions:** Sole-selected → EARLY GREYING CARE GOLD + OXIDATIVE STRESS + PRO IMMUNE GOLD (lock).
- **Severity Thresholds:** N/A.
- **Recommendation Narrative pointer:** `all-kits-info.txt` Early Greying block.
- **Video Narrative pointer:** [MISSING].
- **Expected Timeline:** 6+ months.
- **Source:** `greyGoalRule.ts`, `absoluteLocks.ts`.

## 7. Hard Rules (always applied)

| ID | Rule | Effect | Source |
|---|---|---|---|
| HR-1 | Q12 diet = Veg/Vegan/Jain | Globally swap each kit to its VEG variant | `resolveKit.ts` |
| HR-2 | Q9 hormonal = Pregnancy | HEALTHY-9 is the **only** kit; all other rules suppressed | `absoluteLocks.ts` |
| HR-3 | Gender = Male | Drop FPHL, F-PCOS-1, FH WELL 3, HEALTHY-9, LACTIHEALTH, peri/post-menopause | `resolveKit.ts` |
| HR-4 | Gender = Female | Drop MPHL | `resolveKit.ts` |
| HR-5 | Age > 30 with MPHL/FPHL candidate | +1 severity score | `scoreConditions.ts` |
| HR-6 | Dedup | Same kit triggered multiple times → keep once | `kitPrioritizer.ts` |

## 8. Governance Overrides (locked 2026-06-08)

| ID | Rule | Resolution | Source |
|---|---|---|---|
| G-1 | Post-partum (not feeding) | PRO FACT META B + PRO IMMUNE GOLD (Mapping wins over Sequencer) | CKM §4 |
| G-2 | PCOS + Obesity | PRO FACT META B PCOS + PHENOTYPE INFLAMMATION; F-PCOS-1 NOT added | `pcosMetaBVariantRule.ts` |
| G-3 | HBR + Heat treatment | HBR only if `cause` includes Hard water (corroborating shaft-damage signal). Heat/chemical alone insufficient. | `checkTherapyEligibility.ts` SR_005; `signalGatedInjectionRule.ts` (Q3 dependency stripped 2026-06-18) |
| G-4 | Genetics + Female ≥ 30 | META B-led only; FPHL suppressed entirely | `agaRules.ts` |

## 9. Combination Rules (memory-locked)

| Combo | Resolution | Lock source |
|---|---|---|
| GI GOLD trigger | Only GERD / IBS / Acid reflux / Crohn at Phase 1. NEVER for Bloating/Constipation/Indigestion | `feedback_gi_gold_trigger.md`; `giGoldFinalGuardRule.ts` |
| F-PCOS -1 status | Effectively retired in favor of PRO FACT META B PCOS for combined cases; F-PCOS-1 remains only for "PCOS pure" pathway per CKM | `feedback_kit_injection_rules.md` |
| HBR | Standalone-only; G-3 gating | `feedback_kit_injection_rules.md` |
| Menopause continuum | Peri / Meno / Post-meno non-negotiable | `feedback_kit_injection_rules.md`; `menopauseContinuumInjectionRule.ts` |
| PCOS + Hypothyroid | Single plain PRO FACT META B (3-axis: AMPK/insulin + androgen + T3); strips META B PCOS + META B HYPOTHYROID | `feedback_kit_injection_rules.md` Rule 3b (2026-06-17); `thyroidInjectionRule.ts` THYROID_PCOS_UNIFICATION |
| Heavy bleeding periods | Female 18–50 → IRON UP Phase 1 (non-negotiable) | `feedback_questionnaire_changes_2026_06_15.md` |
| Pescatarian | `isVeg=false` — standard kit variants | 2026-06-15 schema change |
| Scarring alopecia | Removed from `immunity` options | 2026-06-15 |

## 10. Fallback Rules
- **Eligibility gate (kit-level):** `clinical-engine/contraindications/checkTherapyEligibility.ts` + `therapy_blocks.json` — therapy/ingredient contraindications.
- **Refuse-to-fabricate:** If composer cannot find a candidate paragraph satisfying gender/severity/driver filters, it emits an honest minimal section ("Based on your current data, your primary driver is X; additional findings will refine this section…"). `CONSULTATION_EXPERIENCE_ARCHITECTURE.md` §6.
- **Hard contraindications:** route through `validateContraindications.ts`.

## 11. Recovery / Maintenance Logic
4-phase recovery timeline (CKM §5):

| Phase | Months | Therapeutic role |
|---|---|---|
| Phase 1 | M1–M2 | Repair cellular ENVIRONMENT first |
| Phase 2 | M3–M4 | Target PRIMARY hair condition |
| Phase 3 | M5–M6 | Address systemic / hormonal / metabolic layer |
| Phase 4 | M7–M8 | Consolidate — prevent relapse |

Maintenance default = PRO IMMUNE GOLD PLUS at Phase 4 for severe (G4–G5) cases; otherwise patient transitions off protocol with reassessment.

## 12. Phase Sequencer
Per `kit-scorer/protocolSequencer.ts` — `PROTOCOL_SEQUENCER` is a `Record<DiagnosisKey, ProtocolEntry>` mapping every DiagnosisKey to its base phase ordering. Key entries:

| DiagnosisKey | Phase 1 | Phase 2 | Phase 3 | Phase 4 |
|---|---|---|---|---|
| TE_STRESS | HAIR FACT TE GOLD | PHENOTYPE INFLAMATION | — | — |
| TE_NUTRITION | HAIR FACT TE GOLD | PRO IMMUNE GOLD | — | — |
| TE_ILLNESS | PRO IMMUNE GOLD | PHENOTYPE | HAIR FACT TE GOLD | — |
| TE_POSTPREG | LACTIHEALTH | HAIR FACT TE GOLD | PRO IMMUNE GOLD | — |
| TE_DELIVERY | PRO FACT META B | HAIR FACT TE GOLD | PRO IMMUNE GOLD | — |
| AGA_MALE_123 | HAIR FACT TE GOLD | PHENOTYPE | MPHL | PRO IMMUNE GOLD (or META B-led variant) |
| AGA_MALE_45 | PRO IMMUNE GOLD | MPHL | PHENOTYPE | PRO IMMUNE GOLD PLUS |
| AGA_FEMALE_123 | HAIR FACT TE GOLD | PHENOTYPE | FPHL | PRO IMMUNE GOLD |
| AGA_FEMALE_45 | PRO IMMUNE GOLD | FPHL | PHENOTYPE | PRO IMMUNE GOLD PLUS |
| PCOS_ONLY | F-PCOS-1 (or PRO FACT META B PCOS) | PHENOTYPE | HAIR FACT TE GOLD | — |
| PCOS_OBESITY | PRO FACT META B PCOS | PHENOTYPE | — | — |
| THYROID_HYPO | PRO FACT META B HYPOTHYROID | PHENOTYPE | HAIR FACT TE GOLD | — |
| THYROID_HYPER | PRO FACT THYROID CARE | HAIR FACT TE GOLD | PRO IMMUNE GOLD | — |
| DIABETES | PRO FACT META B | PHENOTYPE | HAIR FACT TE GOLD | — |
| ALOPECIA_AREATA | HAIR FACT ALOPECIA AREATA | PRO FACT META B | PHENOTYPE | PRO IMMUNE GOLD |
| PERI_MENOPAUSE | HAIR FACT PERI MENOPAUSE | FPHL | HAIR FACT TE GOLD | PRO IMMUNE GOLD |
| MENOPAUSE | _[RETIRED 2026-06-18]_ — bare-Menopause hormonal option removed; protocol no longer derivable from questionnaire. Kit kept registered for clinician override only. | — | — | — |
| POST_MENOPAUSE | PRO FACT META B POSTMENOPAUSE | FPHL | HAIR FACT TE GOLD | PRO IMMUNE GOLD |
| ENDOMETRIOSIS | FH WELL 3 | PHENOTYPE | PRO IMMUNE GOLD | — |
| PREGNANCY | HEALTHY-9 | — | — | — |
| WEIGHT_LOSS / GLP1_EARLY | RAPID WEIGHT LOSS SHIELD | HAIR FACT TE GOLD | PRO IMMUNE GOLD | — |
| GLP1_LATE | HAIR FACT TE GOLD | RAPID WEIGHT LOSS SHIELD | PRO IMMUNE GOLD | — |
| NIGHT_SHIFT | HAIR FACT NIGHT SHIFT | HAIR FACT TE GOLD | PHENOTYPE | — |
| FREQUENT_FLYING | HAIR FACT FREQUENT FLYERS | HAIR FACT TE GOLD | PHENOTYPE | — |
| TTM | HAIR FACT TTM | HAIR FACT TE GOLD | PHENOTYPE | — |
| HAIR_BREAKAGE | HAIR FACT HBR | — | — | — |
| EARLY_GREY | EARLY GREYING CARE GOLD | OXIDATIVE STRESS | PRO IMMUNE GOLD | — |
| MOUTH_ULCERS | PHENOTYPE | PRO IMMUNE GOLD | OXIDATIVE STRESS | — |
| IRON_DEFICIENCY | IRON UP GOLD | HAIR FACT TE GOLD | PRO IMMUNE GOLD | — |
| CHRONIC_MEDICAL | PRO IMMUNE GOLD | PHENOTYPE | — | — |

(Entries above synthesized from CKM §5 and code rules; canonical record is `protocolSequencer.ts`.)

## 13. Pseudocode (canonical contract)
From CKM §7:
```
selectKitsAndSequence(answers, gender, age) {
  candidates = []
  for each (q, a) in answers:
    candidates += RULES[q][a]                          // §1 tables
  candidates = applyHardRules(candidates, gender, age, answers)  // HR-1..HR-6
  candidates = applyGovernance(candidates, answers)              // G-1..G-4
  candidates = dedupe(candidates)
  return assignPhases(candidates, answers)                       // PROTOCOL_SEQUENCER + precedence + multifactorial
}
```
Every rule fired carries source `(question, answer)` tuple for V3 report "evidence we used" lines.

## 14. Worked Examples (from CKM §6)

### Example 0 — Female, 35, GERD + AGA G2 thinning + family history
Triggered: Q10 GERD → GI GOLD + PRO IMMUNE; Q3 thinning → FPHL; Q4 genetics F≥30 → META B + PRO IMMUNE (G-4 suppresses FPHL).
Dedup: {GI GOLD, PRO IMMUNE GOLD, META B}.
- Phase 1: PRO FACT GI GOLD (gut-axis upstream)
- Phase 2: PRO FACT META B (metabolic)
- Phase 3: PRO IMMUNE GOLD

### Example A — Sanjay (Male, 34, AGA G2, oily scalp, sedentary)
Triggered: Q3 thinning → MPHL; Q4 genetics → PRO IMMUNE + MPHL; Q5 oily → MPHL; Q7 sedentary → PRO FACT META B; Age>30 → +1 MPHL severity.
Dedup: {MPHL, PRO IMMUNE GOLD, PRO FACT META B}.
- Phase 1: PRO FACT META B
- Phase 2: MPHL
- Phase 3: PRO IMMUNE GOLD

### Example B — Female, 32, PCOS + Obesity, dandruff+itching, vegetarian
Triggered: Q9 PCOS+Obesity → META B PCOS + PHENOTYPE (G-2); Q5 dandruff+itching → PHENOTYPE (dedup); Q12 veg → swap.
Dedup: {META B PCOS, PHENOTYPE}. F-PCOS-1 NOT added (G-2).
- Phase 1: PRO FACT META B PCOS
- Phase 2: PHENOTYPE INFLAMMATION

### Example C — Female, 28, postpartum feeding, mild flaking, vegetarian
Triggered: Q4 postpartum feeding → LACTIHEALTH + META B + PRO IMMUNE; Q5 flaking → PHENOTYPE; Q12 veg.
- Phase 1: LACTIHEALTH
- Phase 2: PRO FACT META B
- Phase 3: PHENOTYPE INFLAMMATION + PRO IMMUNE GOLD

### Example D — Male, 41, heat-treated, hard-water exposure
Triggered: Q4 cause "Hard water" → HBR; Q13 heat → HBR (G-3 satisfied via Hard water corroboration).
- Phase 1: HAIR FACT HBR

(Contrast: same patient with Heat/Chemical reported but no Hard water → HBR NOT added.)

## 15. Determinism Guarantees (RDE)
- Same ledger state + same engine versions → byte-identical output.
- Every recommendation carries: candidate id, ranking position, upstream cause chain, exclusion rationale for non-selected candidates, confidence tier (never raw numbers in patient view), audit chain id.
- RDE asserts Kit Eligibility classes; final kit-id resolution belongs to Kit Knowledge layer (`resolveKit.ts`).
- Replay determinism: `runtime/stepResolver.ts` `buildReplayFrames(protocol, fixture)` for QA replay (`HAIROS_CONSTITUTIONAL_TEST_CORPUS_V1.md`).
