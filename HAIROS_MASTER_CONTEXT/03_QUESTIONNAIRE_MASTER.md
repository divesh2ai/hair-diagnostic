# 03 — Questionnaire Master (Authoritative)

## Executive Summary
Single source of truth: `src/packages/ai-engine/questionnaire-engine/schema/questionnaire.schema.json` (schemaVersion 1.0, extracted 2026-05-15 from `DrFACT_revamp_v44.html`). Six sections, 21 questions, ~70 options. Every option carries `triggers`, `clinicalTags`, `followUpQuestions`, optional `visibleOnlyIf` / `mutuallyExclusive` / `image`. Every question carries `scoringSignals` (rule, sourceCodeReference), `clinicalMappings`, `visibilityRules`, `skipLogic`, `dependencies`, `dynamicFilterRule`, `mutualExclusivityRules`, `runtimeModification`, `validation`, `uiMetadata`, and a `sourceCodeReference` back to the original HTML STEPS[n] line. Frontend MUST NOT hardcode question content (`apps/patient-portal/src/runtime/protocolAdapter.ts` is the only legal consumer). Legacy `apps/patient-portal/src/config/questionnaire/questions.ts` is an explicit `[]` deprecation stub. Below: every question, verbatim.

## Section Index

| Section ID | Title | Question IDs |
|---|---|---|
| S1_PATIENT_IDENTITY | Patient Identity | name, age, goal, sex |
| S2_HAIR_LOSS_ASSESSMENT | Hair Loss Assessment | duration, count, hairtype |
| S3_SCALP_CONDITION | Scalp Condition | scalp |
| S4_MEDICAL_HISTORY | Medical History & Causes | cause, immunity, lifestyle, thyroid, medical, medical_detail, hormonal |
| S5_NUTRITION_AND_DIET | Nutrition, Diet & Treatments | gut, deficiency, diet, treatment |
| S6_GRADE_AND_ADDITIONAL | Hair Loss Grade & Additional Notes | grade, extra |

Source: `questionnaire.schema.json` lines 1–3238.

---

# Section S1 — Patient Identity

## Qname
**Section:** S1_PATIENT_IDENTITY
**Question:** "What is your full name?"
**Type:** text (single)
**Options:** none (free text). Validation: minLength 2, maxLength 80, pattern `^[A-Za-z][A-Za-z\\s.'-]*$`, placeholder "Your full name"
**Conditional Logic:** always shown.
**Skip Logic:** none.
**Scoring Logic:** none.
**Signals Triggered:** none.
**Driver Impact:** none.
**Severity Impact:** none.
**Kit Impact:** none.
**Narrative Impact:** patient personalisation (LLM prompt, report greeting).
**Video Impact:** [MISSING] — no direct video block; used as avatar greeting input.
**Source:** `questionnaire.schema.json` lines 12–38 (STEPS[0] line 3006).

## Qage
**Section:** S1_PATIENT_IDENTITY
**Question:** "How old are you?"
**Type:** number (single, integer)
**Options:** none — validation `min: 10, max: 150`, placeholder "Your age in years"
**Conditional Logic:** always shown.
**Skip Logic:** none.
**Scoring Logic:**
- `AGA_AGE_MODIFIER`: age > 30 → +5 to AGA score (`matchProtocol` line 4389).
- `AGA_GRADE45_LOCK`: age ≥ 20 AND grade 4/5 → absolute lock to `AGA_MALE_45` / `AGA_FEMALE_45` (`matchProtocol` lines 4250–4253).
- `FPHL_AGE_GATE`: Female < 30 with genetics → TE + PRO IMMUNE (FPHL suppressed); Female ≥ 30 → FPHL eligible (`getFunnelKits` lines 4696–4699).
- `GOAL_FILTER`: age ≥ 30 → goal options filtered to first 2 (Early Greying hidden) (`STEPS[2]._filterOpts` lines 3015–3019).
**Signals Triggered:** AGA_AGE_MODIFIER, AGA_GRADE45_LOCK, FPHL_AGE_GATE, GOAL_FILTER.
**Driver Impact:** elevates AGA cause prior; gates Early Greying availability; gates FPHL eligibility.
**Severity Impact:** age > 30 with grade 4/5 → Severe.
**Kit Impact:** age ≥ 20 + Grade 4/5 → MPHL PLUS / FPHL PLUS variants; Female < 30 + genetics → TE GOLD + PRO IMMUNE (no FPHL); Female ≥ 30 + genetics → PRO FACT META B-led (G-4).
**Narrative Impact:** age-band prognosis phrasing; Early Greying option visibility.
**Video Impact:** [MISSING] — affects script variant selection only via downstream kit.
**Source:** `questionnaire.schema.json` lines 39–97 (STEPS[1] line 3007).

## Qgoal
**Section:** S1_PATIENT_IDENTITY
**Question:** "What are your major concerns?"
**Type:** multi_select (required)
**Options:**
1. "Reduce hair fall and improve quality & growth" (value: "Reduce hair fall and improve growth") — triggers full diagnostic flow + duration/count/hairtype questions; tags: active_shedding, telogen_effluvium_possible, AGA_possible; followUp: duration, count, hairtype.
2. "No active hair fall but need to better hair growth quality" (value: "Hair fall is stopped but needs to regrow lost hair") — sets `isRegrowGoal=true`, suppresses TE GOLD globally, skips duration/count/hairtype, routes to REGROW_ONLY or hormonal/AGA sub-paths; tags: regrow_goal, no_active_shedding, anagen_reentry_needed.
3. "Early greying of hair" (value: "Early greying of hair") — sole concern → absolute EARLY_GREY lock; combined with hair fall → `S._hasGreyGoal=true`, EARLY GREYING CARE appended at end; available only for age < 30; tags: premature_greying, melanocyte_damage, ROS_melanocyte, catalase_deficiency.
**Conditional Logic:** dynamicFilterRule — `parseInt(ans.age) >= 30` removes "Early greying" option (`STEPS[2]._filterOpts` lines 3014–3020). Depends on `age`.
**Skip Logic:** none on this question; this question's selections drive skip on duration/count/hairtype.
**Mutual Exclusivity:** options 1 ↔ 2 mutually deselect (toast: "Regrowth-only mode replaces active shedding analysis."). Option 3 (Early greying) is freely combinable. Source: `STEPS[2]` mutual exclusion.
**Scoring Logic:**
- `EARLY_GREY_LOCK`: goal == "Early greying" sole-selected → absolute EARLY_GREY protocol.
- `GREY_CO_CONDITION`: Early greying + hair fall/regrow → inject EARLY GREYING CARE kit at end of protocol.
- `REGROW_GOAL_FLAG`: goal includes "stopped"/"regrow" → `S._isRegrowGoal=true`; TE GOLD always suppressed.
**Signals Triggered:** EARLY_GREY_LOCK, GREY_CO_CONDITION, REGROW_GOAL_FLAG.
**Driver Impact:** routes between three top-level protocols (Diagnostic / Regrow-Only / Early-Grey).
**Severity Impact:** Early Greying lock bypasses severity scoring.
**Kit Impact:** EARLY_GREY → EARLY GREYING CARE GOLD + OXIDATIVE STRESS + PRO IMMUNE GOLD. Regrow → TE GOLD never prescribed; PRO IMMUNE GOLD leads. Hair-fall → full kit engine.
**Narrative Impact:** routes report header phrasing and section selection.
**Video Impact:** drives avatar script branch (regrow-only vs full diagnostic vs greying).
**Source:** `questionnaire.schema.json` lines 98–232 (STEPS[2] lines 3008–3021).

## Qsex
**Section:** S1_PATIENT_IDENTITY
**Question:** "What is your gender?"
**Type:** single_select (required)
**Options:**
1. "Male" — sets `isMale=true`; hides hormonal question; routes AGA to MPHL; filters cause options to remove postpartum; adds gender rule to LLM prompt forbidding female conditions; tags: MPHL_candidate, DHT_pathway.
2. "Female" — sets `isMale=false`; shows hormonal question; routes AGA to FPHL; shows postpartum options; enables PCOS/menopause paths; tags: FPHL_candidate, hormonal_pathway, androgen_sensitivity; followUp: hormonal.
3. "Other" — treated as Female for kit resolution (`isMale=false`); no clinical tags.
**Conditional Logic:** always shown.
**Skip Logic:** none on this question; drives skip of `hormonal` for non-Female and filter of `cause` postpartum options.
**Scoring Logic:**
- `KIT_GENDER_RESOLVER`: `isMale=true` → MPHL; `isMale=false` → FPHL.
- `VEG_GENDER_SWAP`: `resolveKit()` uses `isMale` to resolve AGA_GENDER placeholder.
**Signals Triggered:** KIT_GENDER_RESOLVER, VEG_GENDER_SWAP.
**Driver Impact:** gates hormonal pathway entirely.
**Severity Impact:** none directly.
**Kit Impact:** Hard Rule HR-3 (Male) drops FPHL, F-PCOS-1, FH WELL 3, HEALTHY-9, LACTIHEALTH, peri/post-menopause kits. HR-4 (Female) drops MPHL.
**Narrative Impact:** controls pronoun + gender-specific section blocks.
**Video Impact:** selects M / F avatar variant.
**Source:** `questionnaire.schema.json` lines 233–317 (STEPS[3] lines 3023–3028).

---

# Section S2 — Hair Loss Assessment

## Qduration
**Section:** S2_HAIR_LOSS_ASSESSMENT
**Question:** "How long have you been experiencing hair loss?"
**Type:** single_select (required: false; effectively required for active-shedding flow)
**Options:**
1. "1–3 months" — activates `hasActiveShedding`; boosts TE_STRESS; tags: acute_TE, recent_trigger, short_duration.
2. "3–6 months" — continued TE + micro-inflammation signal; tags: subacute_TE, micro_inflammation_beginning.
3. "6–12 months" — AGA signal boost; chronic TE + oxidative unmasking; tags: chronic_TE, AGA_risk_elevated, oxidative_stress_unmasked.
4. "More than 1 year" — chronic inflammation phenotype; AGA score boost; PCOS_FPHL signal if combined with Genetics; tags: chronic_inflammation, AGA_dominant, pattern_loss_likely.
**Conditional Logic:** depends on `goal`. Skipped (skipTo `hairtype`) if `goal` includesAny `[regrow, greying, Greying, Early greying]` (`_skipIf`).
**Skip Logic:** see above.
**Scoring Logic:**
- `AGA_DURATION_BONUS`: "6-12" or "More than" → contributes to `hasAGAsignals`.
- `ACTIVE_SHEDDING_TE`: "1-3" or "3-6" → `hasActiveShedding=true`; TE GOLD moves to Phase 1.
- `PCOS_FPHL_SIGNAL`: hasCause('Genetics') AND duration "More than" → `pcosHasFPHL=true` in PCOS stack.
**Signals Triggered:** AGA_DURATION_BONUS, ACTIVE_SHEDDING_TE, PCOS_FPHL_SIGNAL.
**Driver Impact:** elevates TE acuity prior; contributes to AGA chronicity prior.
**Severity Impact:** longer duration → higher AGA confidence.
**Kit Impact:** TE GOLD Phase 1 (if active shedding), TE GOLD + PHENOTYPE (3–6mo), TE GOLD + PHENOTYPE + PRO IMMUNE (6–12mo), PRO IMMUNE + PHENOTYPE (>1y) — per CKM ref §1 Q1 table.
**Narrative Impact:** drives "your hair fall pattern" timeline phrasing.
**Video Impact:** [MISSING] — narrative input only.
**Source:** `questionnaire.schema.json` lines 326–451 (STEPS[4] lines 3030–3036).

## Qcount
**Section:** S2_HAIR_LOSS_ASSESSMENT
**Question:** "How much hair do you lose per day?"
**Type:** single_select (required: false)
**Options:**
1. "~20–50 strands (Normal range)" (value: `~20–50 strands\n(Normal range)`) — tags: normal_shedding; no triggers.
2. "~50–100 strands (Noticeable)" (value: `~50–100 strands\n(Noticeable)`) — `hasActiveShedding=true`; TE active shedding signal; tags: active_TE, noticeable_shedding.
3. "100+ strands (Heavy loss)" (value: `100+ strands\n(Heavy loss)`) — `hasActiveShedding=true`; severe TE; TE GOLD Phase 1 forced; tags: severe_TE, chronic_telogen, heavy_shedding.
4. "Just thinning, no visible fall" (value: `Just thinning,\nno visible fall`) — `hasNoVisibleFall=true`; **TE GOLD permanently suppressed** from entire protocol (v39 rule); AGA signal boost; tags: no_active_shedding, pattern_loss_only, miniaturisation, AGA_signal.
**Conditional Logic:** depends on `goal`. Skipped to `hairtype` if `goal` includesAny `[regrow, greying, Greying, Early greying]`.
**Skip Logic:** see above.
**Scoring Logic:**
- `TE_GOLD_SUPPRESSION_V39`: count includes "thinning"/"no visible fall" → TE GOLD permanently suppressed (lines 4012–4019).
- `ACTIVE_SHEDDING_SIGNAL`: count "50-100" or "100+" → `hasActiveShedding=true`; TE GOLD → Phase 1.
- `AGA_COUNT_SIGNAL`: count "thinning" → contributes to `hasAGAsignals`.
**Signals Triggered:** TE_GOLD_SUPPRESSION_V39, ACTIVE_SHEDDING_SIGNAL, AGA_COUNT_SIGNAL.
**Driver Impact:** "thinning" routes to pattern-loss; "100+" routes to chronic TE.
**Severity Impact:** "100+" → severe TE confidence; thinning → AGA confidence.
**Kit Impact:** see Q2 table in CKM ref §1.
**Narrative Impact:** quantitative shedding phrasing in report.
**Video Impact:** [MISSING].
**Source:** `questionnaire.schema.json` lines 453–574 (STEPS[5] lines 3038–3044).

## Qhairtype
**Section:** S2_HAIR_LOSS_ASSESSMENT
**Question:** "What type of hair fall are you seeing?"
**Type:** multi_select (required: false)
**Options:**
1. "Full-length hairs with white bulb" — TE — telogen phase release confirmed; tags: telogen_effluvium, white_bulb, full_length_shedding.
2. "Hair on pillow / floor / shower" — general shedding confirmation; tags: active_shedding, telogen_effluvium_possible.
3. "Widening parting or thinning" — AGA signal; `pcosHasFPHL=true`; `realPatternSignal=true`; FPHL/MPHL pattern injection; tags: FPHL, MPHL, pattern_loss, follicle_miniaturisation, AGA_signal.
4. "Circular bald patches / Coin-sized bald spots" — ALOPECIA_AREATA score contribution; tags: alopecia_areata, autoimmune, AA_signal, CD8_T_cell_attack.
5. "None of the above" — no triggers.
**Conditional Logic:** depends on `goal`. Skipped to `scalp` if `goal` includesAny `[regrow, greying, Greying, Early greying]`.
**Skip Logic:** see above.
**Scoring Logic:**
- `AGA_PATTERN_SIGNAL`: includes "Thinning"/"widening"/"parting" → `hasAGAsignals=true`; `realPatternSignal=true`.
- `AA_SIGNAL`: includes "circular"/"patches" → ALOPECIA_AREATA +105.
- `TE_WHITE_BULB`: includes "white bulb" → TE classification confirmed (clinical signal only).
**Signals Triggered:** AGA_PATTERN_SIGNAL, AA_SIGNAL, TE_WHITE_BULB.
**Driver Impact:** routes to pattern-loss vs autoimmune vs TE.
**Severity Impact:** circular patches → AA high confidence.
**Kit Impact:** Widening parting → MPHL/FPHL; Circular patches → HAIR FACT ALOPECIA AREATA + META B + PRO IMMUNE; White bulb → HAIR FACT TE GOLD. (HBR gating is routed off Hard water in `cause`, not Q3 — the "Broken/short" hairtype option was retired and the dependency was stripped 2026-06-18.)
**Narrative Impact:** pattern-recognition phrasing.
**Video Impact:** [MISSING].
**Source:** `questionnaire.schema.json` lines 576–717 (STEPS[6] lines 3046–3052).

---

# Section S3 — Scalp Condition

## Qscalp
**Section:** S3_SCALP_CONDITION
**Question:** "What's your scalp like right now?"
**Type:** multi_select (required: true)
**Options:**
1. "Dandruff" (value: "Dandruff / white flakes") — SCALP_INFLAM contribution; `realInflamSignal=true`; PHENOTYPE INFLAMATION injection; `hasAGAsignals=true`; mutex: "Dandruff + Itching + White flakes"; tags: seborrhoeic_dermatitis, malassezia, AGA_risk, dandruff.
2. "Dandruff + Itching + White flakes" — SCALP_INFLAM contribution; PHENOTYPE mandatory; seborrhoeic dermatitis note; mutex: "Dandruff / white flakes"; tags: seborrhoeic_dermatitis, NF_kB_activation, inflammatory_dandruff, itching.
3. "Oily scalp" — SCALP_INFLAM contribution; `hasAGAsignals=true`; Female <30 → PHENOTYPE; Male / Female 30+ → MPHL/FPHL + PHENOTYPE; mutex: "Dry scalp"; tags: sebaceous_hyperactivity, DHT_driven_oiliness, AGA_risk.
4. "Dry scalp" — HBR signal — dry scalp associated with shaft damage; mutex: "Oily scalp"; tags: dry_scalp, keratin_damage, HBR_associated.
5. "Redness or irritation" — `realInflamSignal=true`; PHENOTYPE injection; SCALP_INFLAM +42/+62; `hasScalpInflam=true`; tags: scalp_inflammation, NF_kB, TNF_alpha, follicle_microenvironment_toxicity.
6. "Boils or pimples" — `realInflamSignal=true`; PHENOTYPE; `hasScalpInflam=true`; `pcosHasScalpInflam=true`; tags: folliculitis, bacterial_scalp, inflammation.
7. "Burning sensation" — `realInflamSignal=true`; PHENOTYPE; `hasScalpInflam=true`; tags: neurogenic_inflammation, scalp_burning, PHENOTYPE_signal.
8. "Normal scalp" — no triggers.
9. "Psoriasis / Inflammation" — `realInflamSignal=true`; PHENOTYPE; immune_signal; tags: psoriasis, autoimmune_scalp, IL6, TNF_alpha, systemic_inflammation.
**Conditional Logic:** always shown.
**Skip Logic:** none.
**Mutual Exclusivity:** Dry ↔ Oily; Dandruff (plain) ↔ Dandruff+Itching+Flakes (`_scalpExclusive`, line 3059).
**Scoring Logic:**
- `SCALP_INFLAM_SCORE`: `hasScalpInflam` (Redness/Boils/Burning) OR `hasScalpOilyDandruff` → SCALP_INFLAM +42 (+62 if female < 30) (lines 4370–4372).
- `PHENOTYPE_INJECTION`: Dandruff/Redness/Boils/Burning/Flaking/Oily+Itching → `realInflamSignal=true` → PHENOTYPE INFLAMATION injected in Step 5b pool (lines 4762–4768).
- `AGA_SIGNALS_BOOST`: Dandruff or Oily → `hasAGAsignals=true` (lines 4382–4383).
- `PCOS_SCALP_INFLAM`: Redness/Boils/Burning/Dandruff/Oily+Itching → `pcosHasScalpInflam=true` (lines 4566–4569).
**Signals Triggered:** SCALP_INFLAM_SCORE, PHENOTYPE_INJECTION, AGA_SIGNALS_BOOST, PCOS_SCALP_INFLAM.
**Driver Impact:** primary terrain signal — drives PHENOTYPE Phase-1/Phase-2 placement.
**Severity Impact:** Female <30 scalp inflammation → +62 (vs +42 baseline).
**Kit Impact:** see Q5 table in CKM ref §1; PHENOTYPE INFLAMMATION + (HBR removed from Flaking/Boils/Redness per CKM update).
**Narrative Impact:** scalp-state phrasing in barrier section.
**Video Impact:** [MISSING].
**Source:** `questionnaire.schema.json` lines 718–957 (STEPS[7] lines 3054–3059).

---

# Section S4 — Medical History & Causes

## Qcause
**Section:** S4_MEDICAL_HISTORY
**Question:** "What do you think is the cause for your hair loss?"
**Type:** multi_select (required: true)
**Options:**
1. "Stress / Anxiety / Depression" — TE_STRESS +55 (if no nutritional); `hasActiveShedding=true`; HPA axis signal; tags: HPA_axis_dysregulation, cortisol_elevation, telogen_effluvium, TE_STRESS.
2. "Genetics / Family history" — `hasGeneticCause=true`; AGA contribution; if age ≥ 30 → `realImmuneSignal=true` → PRO IMMUNE injection; pcosHasFPHL signal if combined with duration; tags: androgenetic_alopecia, DHT_sensitivity, 5AR_genetic, family_history.
3. "Nutritional deficiencies" — TE_NUTRITION +58; `realImmuneSignal=true` → PRO IMMUNE; tags: nutritional_TE, iron_deficiency_possible, B12_deficiency, micronutrient_depletion.
4. "Medication / Recent Illness / Surgery" — TE_ILLNESS +72; `realImmuneSignal=true` → PRO IMMUNE; CHRONIC_MEDICAL +80; tags: iatrogenic_TE, post_illness_TE, immune_depletion, medication_induced.
5. "Post partum — still feeding" *(visible only if sex==Female)* — TE_POSTPREG +92; LACTIHEALTH Phase 1; tags: postpartum_TE, breastfeeding, hormonal_shift, nutritional_drain.
6. "Post partum — not feeding" *(visible only if sex==Female)* — TE_DELIVERY +90 (with 'not feeding'); TE GOLD Phase 1 + PRO IMMUNE Phase 2; tags: postpartum_TE, post_delivery, hormonal_crash, oestrogen_drop.
7. "Hair pulling habit (Trichotillomania)" — TTM +102; protocol TTM → TE GOLD → PHENOTYPE; tags: trichotillomania, OCD, compulsive_pulling, follicle_trauma.
8. "Hard water" — HAIR_BREAKAGE +52; `hasHBRHardWater=true`; HBR injection; tags: hard_water, mineral_deposit, cortex_damage, HBR_signal.
9. "Post GLP-1 receptor agonist (hair loss within 6 months)" — WEIGHT_LOSS +90; `hasGLP1EarlyFlag=true`; RAPID WEIGHT LOSS SHIELD forced to position 0 in all protocols (v39); TE GOLD NOT suppressed but in reduced scope after Shield; tags: GLP1_acute, GLP1_ozempic, rapid_weight_loss, nutrient_depletion, synchronous_TE.
10. "Post GLP-1 receptor agonist (hair loss after 6 months)" — WEIGHT_LOSS +90; `hasGLP1LateFlag=true`; SHIELD position 1 after primary diagnosis kit; TE_STRESS +50 also added (TE leads as Kit 1); tags: GLP1_late, nutritional_recovery, post_acute_TE, shield_secondary.
11. "Rapid weight loss / Crash diet" (value: "Post crash diet") — WEIGHT_LOSS +90 via `hasCrashDiet`; RAPID WEIGHT LOSS SHIELD Phase 1; tags: crash_diet, caloric_restriction, rapid_weight_loss, nutrient_depletion.
12. "Not sure" — no triggers.
13. "None of the above" — no triggers.
**Conditional Logic:** dynamicFilterRule — `ans.sex !== 'Female'` removes options 5 and 6 (`STEPS[8]._filterOpts` lines 3067–3073).
**Skip Logic:** none.
**Scoring Logic:** see option triggers and signals below.
**Signals Triggered:** TTM_SCORE (+102), TE_STRESS_SCORE (+55), TE_NUTRITION_SCORE (+58), TE_ILLNESS_SCORE (+72), TE_POSTPREG_SCORE (+92), TE_DELIVERY_SCORE (+90), WEIGHT_LOSS_SCORE (+90), HAIR_BREAKAGE_SCORE (+52), AGA_GENETICS.
**Driver Impact:** strongest single router into TE / AGA / TTM / weight-loss / hormonal-postpartum buckets.
**Severity Impact:** TTM +102 near-lock; TE_POSTPREG +92 dominant.
**Kit Impact:** per CKM ref §1 Q4 table — Stress → TE GOLD; Genetics F<30 → TE+PRO IMMUNE; Genetics F≥30 → META B + PRO IMMUNE (G-4); Genetics M → MPHL + PRO IMMUNE; Nutritional → TE + PRO IMMUNE; Medication/Illness → PRO IMMUNE + PHENOTYPE; Postpartum (not feeding) → META B + PRO IMMUNE (G-1); Postpartum (feeding) → LACTIHEALTH + META B + PRO IMMUNE; TTM → HAIR FACT TTM; Hard water → HBR; GLP-1 early → RWLS pos 0; GLP-1 late → primary kit + RWLS pos 1; Crash diet → RWLS.
**Narrative Impact:** root-cause section selection; "Why this happens" copy.
**Video Impact:** drives root-cause module of avatar script.
**Source:** `questionnaire.schema.json` lines 958–1276 (STEPS[8] lines 3062–3074).

## Qimmunity
**Section:** S4_MEDICAL_HISTORY
**Question:** "Any immunity or skin-related issues?"
**Type:** multi_select (required: true)
**Options:**
1. "Frequent infections / cold / fever" — `needsImmune=true`; PRO IMMUNE GOLD injection; `pcosHasImmune=true`; tags: immune_compromise, chronic_infection, immune_depletion.
2. "Allergies" — `needsImmune=true`; `realInflamSignal=true` → PHENOTYPE; `pcosHasImmune=true`; tags: atopy, immune_dysregulation, IgE_mediated, inflammation.
3. "Asthma" — `needsImmune=true`; `realInflamSignal=true` → PHENOTYPE; oxidativeCount +1; `pcosHasImmune=true`; tags: asthma, airway_inflammation, oxidative_stress, immune_dysregulation.
4. "Skin rashes or eczema" — `needsImmune=true`; `realInflamSignal=true` → PHENOTYPE; `pcosHasImmune=true`; tags: eczema, atopic_dermatitis, Th2_inflammation, skin_barrier_dysfunction.
5. "Alopecia Areata (circular patches)" — **ALOPECIA_AREATA +105** (near-absolute lock); **grade question SKIPPED** (`STEPS[19]._skipIf` line 3149); `needsImmune=true`; protocol HAIR FACT ALOPECIA AREATA → PRO FACT META B → PHENOTYPE → PRO IMMUNE; PHENOTYPE injection via `realInflamSignal`; tags: alopecia_areata, autoimmune, CD8_T_cell, follicle_immune_attack, AA_absolute.
6. "Mouth ulcers" — MOUTH_ULCERS +72 (if gut also active); protocol PHENOTYPE Phase 1 + PRO IMMUNE Phase 2 + OXIDATIVE STRESS Phase 3; tags: mouth_ulcers, gut_immune_link, mucosal_inflammation, immune_gut_axis.
7. "None of the above" — no triggers.
**Conditional Logic:** always shown.
**Skip Logic:** Alopecia Areata selection skips `grade` question.
**Scoring Logic:**
- `AA_SCORE`: includes "Alopecia Areata"/"Areata" → ALOPECIA_AREATA +105.
- `GRADE_SKIP_TRIGGER`: AA → grade hidden (`STEPS[19]._skipIf` line 3149).
- `IMMUNE_INJECTION`: any active immune issue → `needsImmune=true` → PRO IMMUNE GOLD.
- `PHENOTYPE_INJECTION`: Allergies/Asthma/Skin rash/AA → `realInflamSignal=true` → PHENOTYPE.
- `MOUTH_ULCERS_SCORE`: ulcer + gut → MOUTH_ULCERS +72.
- `OXIDATIVE_COUNT`: Asthma → oxidativeCount +1 (≥2 for standalone OXIDATIVE STRESS injection).
**Signals Triggered:** AA_SCORE, GRADE_SKIP_TRIGGER, IMMUNE_INJECTION, PHENOTYPE_INJECTION, MOUTH_ULCERS_SCORE, OXIDATIVE_COUNT.
**Driver Impact:** AA = near-lock; otherwise contributes to PHENOTYPE + PRO IMMUNE injection.
**Severity Impact:** AA +105 dominates score race.
**Kit Impact:** AA → HAIR FACT ALOPECIA AREATA + META B + PHENOTYPE + PRO IMMUNE; Allergies/Asthma/Skin rash → PHENOTYPE + PRO IMMUNE; Asthma also → OXIDATIVE STRESS (combined with smoking/alcohol); Mouth ulcers → PHENOTYPE + GI GOLD.
**Narrative Impact:** immune section of report.
**Video Impact:** [MISSING] for AA-specific block beyond avatar generic script.
**Source:** `questionnaire.schema.json` lines 1277–1446 (STEPS[9] lines 3076–3081).

## Qlifestyle
**Section:** S4_MEDICAL_HISTORY
**Question:** "How is your lifestyle?"
**Type:** multi_select (required: true)
**Options:**
1. "Smoking / Vaping" — OXIDATIVE +58; `realInflamSignal=true` → PHENOTYPE; oxidativeCount +1; `smokingVaping=true` for kit cap.
2. "Alcohol (8–10×/month)" — OXIDATIVE +58; PHENOTYPE; oxidativeCount +1.
3. "Bodybuilding / Heavy gym" — `hasAGAsignals=true` (DHT amplification).
4. "Obesity / Struggle to lose weight" (value: "Obesity / Sedentary / Struggle to lose weight / Slowly gaining weight") — `hasMetabolicSignal=true` → PRO FACT META B; `pcosObese=true` → PCOS_OBESITY route; PERI_MENOPAUSE + metabolic → PRO FACT META B inserted after Phase 1; THYROID_HYPO + metabolic → swap PRO FACT META B HYPOTHYROID for PRO FACT META B.
5. "Irregular eating time / Outside eating (3–4×/week)" (value: "Erratic / Outside eating (3–4×/week)") — `hasMetabolicSignal=true` via "Irregular"/"poor" match.
6. "Night shift work" — NIGHT_SHIFT +62; protocol NIGHT SHIFT → TE GOLD → PHENOTYPE.
7. "Frequent flying" — FREQUENT_FLYING +58; protocol FREQUENT FLYERS → TE GOLD → PHENOTYPE.
8. "None of the above" — no triggers.
**Conditional Logic:** always shown.
**Skip Logic:** none.
**Scoring Logic:**
- `OXIDATIVE_SCORE`: Smoking/Vaping/Alcohol → OXIDATIVE +58; oxidativeCount incremented.
- `STANDALONE_OXIDATIVE`: oxidativeCount ≥ 2 → OXIDATIVE STRESS standalone phase if PHENOTYPE absent.
- `METABOLIC_SIGNAL`: Obesity/Sedentary/weight → `hasMetabolicSignal=true` → PRO FACT META B.
- `NIGHT_SHIFT_SCORE`: +62.
- `FREQUENT_FLYING_SCORE`: +58.
- `AGA_GYM_SIGNAL`: Bodybuilding → AGA contribution.
- `KIT_CAP_SIGNAL`: smokingVaping → injectionTarget raised; cap reaches 5–7.
**Signals Triggered:** as above.
**Driver Impact:** metabolic/oxidative/circadian routers.
**Severity Impact:** drives PRO FACT META B activation across multiple downstream rules.
**Kit Impact:** see Q7 table in CKM ref §1.
**Narrative Impact:** lifestyle section of report.
**Video Impact:** [MISSING].
**Source:** `questionnaire.schema.json` lines 1447–1647 (STEPS[10] lines 3083–3088).

## Qthyroid
**Section:** S4_MEDICAL_HISTORY
**Question:** "Do you have either of the following conditions?"
**Type:** multi_select (required: true)
**Options:**
1. "Hypothyroidism" — THYROID_HYPO +100; protocol PRO FACT META B HYPOTHYROID → PHENOTYPE → HAIR FACT TE GOLD; +Obesity → swap to PRO FACT META B (v34 override); PCOS + Hypo → PCOS priority raised to 101 (beats thyroid).
2. "Hyperthyroidism" — THYROID_HYPER +100; protocol PRO FACT THYROID CARE → TE GOLD → PRO IMMUNE.
3. "Pre diabetes" — DIABETES +90; `hasMetabolicSignal=true` → PRO FACT META B; `hasDiabetesSignal=true` → upgrades F-PCOS-1 to PRO FACT META B PCOS in PCOS stack.
4. "Diabetes" — DIABETES +90; `hasMetabolicSignal=true`; `hasDiabetesSignal=true` → PCOS upgrade.
5. "Not Applicable" — no triggers.
**Conditional Logic:** always shown.
**Skip Logic:** none.
**Scoring Logic:**
- `THYROID_HYPO_SCORE`: +100 (via thyroid OR hormonal "Thyroid").
- `THYROID_HYPER_SCORE`: +100.
- `DIABETES_SCORE`: +90.
- `METABOLIC_SIGNAL_DIABETES`: Pre-diabetes/Diabetes → PRO FACT META B.
- `PCOS_THYROID_PRIORITY`: PCOS + Hypo → PCOS priority 101.
- `PCOS_DIABETES_UPGRADE`: PCOS + diabetes → F-PCOS-1 → PRO FACT META B PCOS.
- `V38_OVERRIDE`: PCOS_OBESITY + Hypo → single PRO FACT META B (drops PRO FACT META B PCOS + PRO FACT META B HYPOTHYROID). Locked 2026-06-17.
**Signals Triggered:** as above.
**Driver Impact:** thyroid/diabetes routers; collapses PCOS combinations.
**Severity Impact:** disease-tier (+100/+90).
**Kit Impact:** Hypo alone → PRO FACT META B HYPOTHYROID; Hyper → PRO FACT THYROID CARE; Hypo + Obesity → PRO FACT META B; Pre-diabetes/Diabetes → PRO FACT META B; PCOS + Hypo → PRO FACT META B (memory lock 2026-06-17).
**Narrative Impact:** thyroid/diabetes section.
**Video Impact:** [MISSING].
**Source:** `questionnaire.schema.json` lines 1648–1792 (STEPS[11] lines 3090–3095).

## Qmedical
**Section:** S4_MEDICAL_HISTORY
**Question:** "Are you currently under treatment for any chronic medical condition?"
**Type:** single_select (required: true)
**Options:**
1. "Yes, currently on medication" — CHRONIC_MEDICAL +80 (if no diabetes); activates `medical_detail` question; protocol PRO IMMUNE GOLD + PHENOTYPE.
2. "No, no chronic conditions" — skips `medical_detail`.
**Conditional Logic:** always shown.
**Skip Logic:** "No" skips `medical_detail`; "Yes" reveals it.
**Scoring Logic:** CHRONIC_MEDICAL +80 if "Yes" AND no diabetes (`matchProtocol` lines 4316–4319).
**Signals Triggered:** CHRONIC_MEDICAL_SCORE.
**Driver Impact:** triggers chronic-disease pathway (immune + inflammatory).
**Severity Impact:** +80 disease-tier.
**Kit Impact:** PRO IMMUNE GOLD + PHENOTYPE INFLAMMATION (PRO FACT META B only if true metabolic signal also present, NOT for chronic medication alone).
**Narrative Impact:** chronic condition framing.
**Video Impact:** [MISSING].
**Source:** `questionnaire.schema.json` lines 1793–1851 (STEPS[12] lines 3097–3102).

## Qmedical_detail
**Section:** S4_MEDICAL_HISTORY
**Question:** "Please tell us which condition(s) you are being treated for and any medications you are currently taking:"
**Type:** text (free text, not multi)
**Options:** none — placeholder "e.g. Hypothyroidism, Diabetes, BP — metformin, levothyroxine..."
**Conditional Logic:** visible only if `medical` includes "Yes".
**Skip Logic:** `_skipIf` — if medical !== "Yes" → skipTo `hormonal`.
**Scoring Logic:** none structured.
**Signals Triggered:** none (free text passed to LLM prompt as "Chronic conditions / medications").
**Driver Impact:** none structured.
**Severity Impact:** none.
**Kit Impact:** none structured.
**Narrative Impact:** appears in LLM contextual reasoning.
**Video Impact:** [MISSING].
**Source:** `questionnaire.schema.json` lines 1852–1896 (STEPS[13] lines 3104–3108).

## Qhormonal
**Section:** S4_MEDICAL_HISTORY
**Question:** "Any hormonal or reproductive health issues? (Females)"
**Type:** multi_select (required: false; visible only if sex==Female)
**Options:**
1. "PMOS / PCOS" (value: "PCOS / PCOD only") — PCOS_ONLY +92 (or +101 if also Hypothyroid); F-PCOS-1 as primary kit; PCOS precision stack; PCOS_OBESITY upgrade via lifestyle Obesity/Sedentary.
2. "Endometriosis" — ENDOMETRIOSIS +85; protocol FH WELL 3 → PHENOTYPE → PRO IMMUNE.
3. "Heavy bleeding periods" — IRON_DEFICIENCY root cause derived (chronic menstrual loss); IRON UP GOLD non-negotiable injection; IRON UP GOLD lifted to Phase 1.
4. "Currently pregnant" — PREGNANCY absolute lock; HEALTHY-9 ONLY (HR-2).
5. "Post-delivery or breastfeeding" — TE_POSTPREG +92; LACTIHEALTH Phase 1 → TE GOLD Phase 2 → PRO IMMUNE Phase 3.
6. "Peri-menopause" — PERI_MENOPAUSE +98; protocol PERI MENOPAUSE → FPHL → TE GOLD → PRO IMMUNE; +metabolic → PRO FACT META B inserted after Phase 1.
7. "Post-menopause" — POST_MENOPAUSE +98; protocol PRO FACT META B POSTMENOPAUSE → FPHL → TE GOLD → PRO IMMUNE.
8. "Hormone Replacement Therapy (HRT)" — clinical context signal (LLM narrative only).
9. "None of the above" — no triggers.
**Conditional Logic:** visible only if `sex == Female`. Heavy bleeding periods further restricted to age 18–50 (`ans.age < 18 || ans.age > 50` removes it — locked clinical rule 2026-06-15).
**Skip Logic:** if `sex != Female` → skipTo `gut`. Runtime `S.step` logic at line 8237.
**Runtime Modification:** IIFE at runtime removes "Thyroid disorder" option (captured in dedicated thyroid step); hint updated. Lines 3156–3167.
**Scoring Logic:**
- `POST_MENOPAUSE_SCORE`: +98.
- `HEAVY_BLEEDING_IRON_LOSS`: → IRON_DEFICIENCY root cause; IRON UP GOLD Phase 1.
- `PERI_MENOPAUSE_SCORE`: +98 (matches Peri-menopause/Peri menopause/Perimenopause/peri/Peri-Menopause).
- `ENDOMETRIOSIS_SCORE`: +85.
- `PCOS_SCORE`: +92 / +101 if Hypothyroid; PCOS_OBESITY route via obesity signal.
- `PREGNANCY_LOCK`: absolute → HEALTHY-9 only.
- `POSTPREG_SCORE`: +92.
- `THYROID_IN_HORMONAL`: hormonal includes "Thyroid" → THYROID_HYPO +100 (cross-field).
**Signals Triggered:** as above.
**Driver Impact:** primary hormonal router for Female patients.
**Severity Impact:** disease-tier (+85 to +98).
**Kit Impact:** see CKM ref §1 Q9 table. Memory-locked: HEALTHY-9 only during pregnancy; PCOS+Hypo → plain META B; PCOS pure → F-PCOS-1 only (no PRO IMMUNE/FPHL/PHENOTYPE unless signals fire); PCOS+Obesity → PRO FACT META B PCOS only (no F-PCOS-1).
**Narrative Impact:** hormonal section; menopause continuum text.
**Video Impact:** drives gender+hormonal-specific avatar branch.
**Source:** `questionnaire.schema.json` lines 1897–2165 (STEPS[14] lines 3110–3115; runtime cleanup 3156–3167).

---

# Section S5 — Nutrition, Diet & Treatments

## Qgut
**Section:** S5_NUTRITION_AND_DIET
**Question:** "Any gut or digestive issues?"
**Type:** multi_select (required: true)
**Options:**
1. "Bloating / gas" — GUT_ISSUES +62 (if no mouth ulcers); `realImmuneSignal=true` → PRO IMMUNE; `hasGut=true`; tags: gut_dysbiosis, SIBO, microbiome_imbalance, bloating.
2. "Constipation" — no kit triggers (GI GOLD removed from schema 2026-06-18 per locked governance); tags: constipation, gut_motility, microbiome_dysbiosis.
3. "IBS / Crohn's" — GUT_ISSUES +62; `realGutSignal=true` → PRO FACT GI GOLD; `realImmuneSignal=true` → PRO IMMUNE; `hasGut=true`.
4. "Acid reflux (heartburn) / GERD (Chronic Heartburn)" (value: `Acid reflux\n(heartburn) /\nGERD\n(Chronic Heartburn)`) — GUT_ISSUES +62; → PRO FACT GI GOLD; → PRO IMMUNE; `hasGut=true`.
5. "Indigestion" — contributes to `hasActiveGut`.
6. "No gut issues" — no triggers.
**Conditional Logic:** always shown.
**Skip Logic:** none.
**Scoring Logic:**
- `GUT_ISSUES_SCORE`: active gut + immunity ulcer → MOUTH_ULCERS +72; else → GUT_ISSUES +62.
- `GI_GOLD_INJECTION`: gut includes IBS/GERD/Acid/Crohn → `realGutSignal=true` → PRO FACT GI GOLD injected. (Constipation removed 2026-06-18.)
- `PRO_IMMUNE_GUT`: GERD/Bloating/IBS/Acid → `realImmuneSignal=true` → PRO IMMUNE.
- `KIT_CAP_GUT`: `hasGut=true` → activeSignalCount incremented; injectionTarget raised.
**Signals Triggered:** as above.
**Driver Impact:** **gut-axis upstream — root-cause precedence #2** (after pregnancy).
**Severity Impact:** GERD/IBS/Crohn → GI GOLD non-negotiable Phase 1.
**Kit Impact:** **Memory-locked governance:** PRO FACT GI GOLD only for GERD / IBS / Acid reflux / Crohn (NEVER for Bloating/Constipation/Indigestion alone — those route to PRO FACT GI HEALTH or PRO IMMUNE only). Enforced by `giGoldFinalGuardRule.ts` at runtime AND by the schema text after the 2026-06-18 cleanup. See `04_RECOMMENDATION_ENGINE.md` §5.
**Narrative Impact:** gut-hair axis section.
**Video Impact:** [MISSING].
**Source:** `questionnaire.schema.json` lines 2166–2304 (STEPS[15] lines 3117–3122).

## Qdeficiency
**Section:** S5_NUTRITION_AND_DIET
**Question:** "Any confirmed nutritional deficiencies?"
**Type:** multi_select (required: true)
**Options:**
1. "Iron / Anaemia" — IRON_DEFICIENCY +80; `realImmuneSignal=true` → PRO IMMUNE; IRON UP GOLD injection (priority 2 in pool); `pcosHasImmune=true`; position logic inserts after PCOS/TE primary.
2. "Vitamin D3" — nutritional signal — LLM narrative only.
3. "Vitamin B12" — nutritional signal — LLM narrative only.
4. "None / Not tested" — no triggers.
**Conditional Logic:** always shown.
**Skip Logic:** none.
**Scoring Logic:**
- `IRON_DEFICIENCY_SCORE`: +80.
- `IRON_UP_GOLD_INJECTION`: iron → IRON UP GOLD added at pool position 2.
- `PRO_IMMUNE_IRON`: iron → PRO IMMUNE injection.
- `PCOS_IMMUNE_IRON`: iron → `pcosHasImmune=true` in PCOS stack.
**Signals Triggered:** as above.
**Driver Impact:** root-cause precedence #3 — iron repletion non-negotiable Phase 1.
**Severity Impact:** disease-tier (+80).
**Kit Impact:** IRON UP GOLD Phase 1 (also triggered by hormonal "Heavy bleeding periods" for Female 18–50).
**Narrative Impact:** iron/anaemia section; B12 + D3 as clinical flags only.
**Video Impact:** [MISSING].
**Source:** `questionnaire.schema.json` lines 2305–2410 (STEPS[16] lines 3124–3129).

## Qdiet
**Section:** S5_NUTRITION_AND_DIET
**Question:** "What best describes your diet?"
**Type:** multi_select (required: true)
**Options:**
1. "Normal diet" — baseline; no kit swap; no metabolic signal.
2. "Vegetarian" — `isVeg=true` → all kits switch to VEG variants via `resolveKit()`.
3. "Vegan" — `isVeg=true` → VEG variants.
4. "Non-vegetarian" — standard kit variants; MPHL/FPHL DHT risk signal.
5. "Pescatarian" — `isVeg=false` (pescatarians consume fish); standard kit variants; omega-3 adequate. *(Added 2026-06-15.)*
6. "High protein diet" — DHT amplification signal.
7. "Irregular / poor diet" — `hasMetabolicSignal=true` → PRO FACT META B.
8. "Crash / Keto / Intermittent fasting" (value: "Crash Diet / Keto / IF") — WEIGHT_LOSS +90 via `hasCrashDiet`; `hasMetabolicSignal=true`; RAPID WEIGHT LOSS SHIELD Phase 1.
9. "None of the above" — no triggers.
**Conditional Logic:** always shown.
**Skip Logic:** none.
**Scoring Logic:**
- `VEG_KIT_SWAP`: Vegetarian/Vegan/Jain → `isVeg=true` → resolveKit swaps to VEG variants (TE GOLD VEG, PERI MENOPAUSE VEG, F-PCOS VEG-1, PRO IMMUNE VEG, EARLY GREYING CARE VEG).
- `WEIGHT_LOSS_DIET`: Crash/Keto → WEIGHT_LOSS +90.
- `METABOLIC_DIET`: Irregular/poor/Keto/Crash → `hasMetabolicSignal=true`.
**Signals Triggered:** as above.
**Driver Impact:** veg flag is the global VEG-variant lever (HR-1).
**Severity Impact:** Crash/Keto → WEIGHT_LOSS dominant (+90).
**Kit Impact:** Hard Rule HR-1 globally swaps every selected kit to its VEG variant when one exists.
**Narrative Impact:** dietary section; references VEG-ingredient substitutions.
**Video Impact:** [MISSING].
**Source:** `questionnaire.schema.json` lines 2411–2587 (STEPS[17] lines 3131–3136).

## Qtreatment
**Section:** S5_NUTRITION_AND_DIET
**Question:** "Any heat or chemical treatments on your hair?"
**Type:** multi_select (required: not declared; effectively optional)
**Options:**
1. "Heat styling (straightener etc.)" — `hasHBRTreatment=true`; **HBR injection requires Hard water corroboration** (heat/chemical alone insufficient).
2. "Chemical treatment (colour / keratin)" — `hasHBRTreatment=true`; HBR only if Hard water also present in `cause`.
3. "No heat or chemical treatments" — no triggers.
**Conditional Logic:** always shown.
**Skip Logic:** none.
**Scoring Logic:**
- `HBR_TREATMENT_SIGNAL`: Heat/Chemical → `hasHBRTreatment=true`; HBR injection requires `cause` includes 'Hard water' as the corroborating shaft-damage signal — heat/chemical alone insufficient. Rule: `realShaftDamage = hardWaterSignal`. (Q3 'Broken/short' hairtype option retired 2026-06-15; dependency stripped from code 2026-06-18.)
- `HAIR_BREAKAGE_SCORE`: +52 if `cause` includes 'Hard water'.
**Signals Triggered:** HBR_TREATMENT_SIGNAL, HAIR_BREAKAGE_SCORE.
**Driver Impact:** Governance Rule **G-3** — HBR conditional, not "always added" on heat/chemical; Hard water is the gating corroboration.
**Severity Impact:** none on its own.
**Kit Impact:** HBR only when Hard water present in `cause`.
**Narrative Impact:** styling damage narrative.
**Video Impact:** [MISSING].
**Source:** `questionnaire.schema.json` lines 2588–2672 (STEPS[18] lines 3138–3143).

---

# Section S6 — Hair Loss Grade & Additional Notes

## Qgrade
**Section:** S6_GRADE_AND_ADDITIONAL
**Question:** "Which image best describes your hair loss right now?"
**Type:** image_select (required: false)
**Options:** (Norwood scale, sex==Male only)
1. "Norwood I — No visible recession" (Grade 1 — Norwood I) — isGrade123, norwood_I, grade_1, AGA_early.
2. "Norwood II — Slight temporal recession" (Grade 1 — Norwood II) — isGrade123.
3. "Norwood IIa — Anterior recession" (Grade 2 — Norwood IIa) — isGrade123.
4. "Norwood III — Frontotemporal recession" (Grade 2 — Norwood III) — isGrade123.
5. "Norwood III vertex — Crown thinning begins" (Grade 2 — Norwood III vertex) — isGrade123.
6. "Norwood IIIa — Deeper anterior recession" (Grade 2 — Norwood IIIa) — isGrade123.
7. "Norwood IV — Hairline + vertex loss, bridge intact" (Grade 3 — Norwood IV) — isGrade123.
8. "Norwood IVa — Anterior loss extends to mid-scalp" (Grade 3 — Norwood IVa) — isGrade123.
9. "Norwood V — Hairline + vertex merging, bridge thinning" (Grade 4 — Norwood V) — **isGrade45**, absolute AGA_MALE_45 lock at age ≥ 20, MPHL PLUS variant.
10. "Norwood Va — Advanced anterior merging" (Grade 4 — Norwood Va) — isGrade45, AGA lock, MPHL PLUS.
11. "Norwood VI — Bridge gone, large bald zone" (Grade 5 — Norwood VI) — isGrade45, AGA lock, MPHL PLUS; **prognosis addendum:** bald areas not reversible.
12. "Norwood VII — Only horseshoe rim remains" (Grade 5 — Norwood VII) — isGrade45, AGA lock, MPHL PLUS; prognosis addendum.

(Ludwig scale, sex != Male)

13. "Ludwig Grade 1 — Minimal thinning" (Grade 1 — Ludwig 1) — isGrade123, ludwig_1, FPHL_early.
14. "Ludwig Grade 2 — Slight central thinning" (Grade 2 — Ludwig 2) — isGrade123.
15. "Ludwig III — Moderate thinning" (Grade 3 — Ludwig III) — isGrade123.
16. "Ludwig I-1 — Increased thinning" (Grade 3 — Ludwig I-1) — isGrade123.
17. "Ludwig II-1 — Advanced thinning" (Grade 4 — Ludwig II-1) — **isGrade45**, AGA_FEMALE_45 lock at age ≥ 20, FPHL PLUS.
18. "Ludwig III-1 — Severe thinning" (Grade 5 — Ludwig III-1) — isGrade45, AGA lock, FPHL PLUS; prognosis addendum.

**Conditional Logic:** image options gated by sex (`visibleOnlyIf sex == Male` for Norwood, `notEquals Male` for Ludwig). Depends on `immunity`.
**Skip Logic:** if `immunity` includes "Alopecia Areata" → skipTo `extra` (`STEPS[19]._skipIf` line 3149) — AA is immune condition, not graded pattern.
**Scoring Logic:**
- `AGA_GRADE45_LOCK`: Grade 4/5 AND age ≥ 20 → ABSOLUTE LOCK to AGA_MALE_45 (M) or AGA_FEMALE_45 (F). Overrides all other scoring (lines 4246–4253).
- `MPHL_FPHL_PLUS_VARIANT`: isGrade45 → MPHL PLUS / FPHL PLUS resolution.
- `AGA_PROTOCOL_GRADE45`: Sequence PRO IMMUNE GOLD → MPHL/FPHL → PHENOTYPE (per Excel rows 7/9).
- `SEVERITY_MODIFIER`: Grade 4/5 → Severe / confidence 90; Grade 1/2 → Mild / confidence 78; else Moderate.
- `PROGNOSIS_ADDENDUM`: Grade 4/5 → "completely bald areas cannot be regrown; up to 30% density improvement in areas where hair still exists".
**Signals Triggered:** AGA_GRADE45_LOCK, MPHL_FPHL_PLUS_VARIANT, AGA_PROTOCOL_GRADE45, SEVERITY_MODIFIER, PROGNOSIS_ADDENDUM.
**Driver Impact:** absolute AGA lock at G4/G5 + age ≥ 20.
**Severity Impact:** primary severity input — Mild / Moderate / Severe with confidence band.
**Kit Impact:** G1–G3 → MPHL/FPHL; G4–G5 (age ≥ 20) → MPHL PLUS / FPHL PLUS + PRO IMMUNE GOLD Phase 1 + PHENOTYPE.
**Narrative Impact:** primary severity language; prognosis disclaimer at G4/G5.
**Video Impact:** drives avatar visual reveal of pattern.
**Source:** `questionnaire.schema.json` lines 2673–3208 (STEPS[19] lines 3145–3150).

## Qextra
**Section:** S6_GRADE_AND_ADDITIONAL
**Question:** "Anything else Dr. FACT should know? (optional)"
**Type:** textarea (free text, optional)
**Options:** none — placeholder "Any other symptoms, medical history, treatments tried, or concerns..."
**Conditional Logic:** always shown.
**Skip Logic:** none.
**Scoring Logic:** none structured.
**Signals Triggered:** none.
**Driver Impact:** none structured.
**Severity Impact:** none.
**Kit Impact:** none.
**Narrative Impact:** passed to LLM prompt as "Additional notes" for contextual narrative.
**Video Impact:** [MISSING].
**Source:** `questionnaire.schema.json` lines 3209–3237 (STEPS[20] line 3151).

---

## Memory-Locked Governance Cross-Reference (2026-06-15 onward)
Sourced from `~/.claude/.../feedback_questionnaire_changes_2026_06_15.md` and `feedback_kit_injection_rules.md`. Status vs schema:

| Lock | Schema status |
|---|---|
| **Heavy bleeding periods** option added (Female 18–50) → IRON UP Phase 1 | ✅ Present in schema (`hormonal` option, with `dynamicFilterRule` age 18–50). |
| **Pescatarian** option added | ✅ Present in schema (`diet` option). |
| **Scarring alopecia** removed | ✅ Absent from `immunity` options in current schema. |
| **Menopause** label removed from inappropriate slot | ✅ "Post-menopause" and "Peri-menopause" remain in `hormonal`; bare "Menopause" absent. **2026-06-18 follow-up:** bare-Menopause trigger logic stripped from `hormonalRules.ts`, `scoreConditions.ts`, `menopauseContinuumInjectionRule.ts`, `protocolSequencer.ts`, schema docs, and `extraction-rules.json`. PRO FACT META B MENOPAUSE kit kept registered for clinician override. |
| **"peri" substring collision fix** | ⚠ PERI_MENOPAUSE_SCORE regex still includes a generic `'peri'` substring match per the scoringSignals text — verify the runtime matcher is anchored to whole-token; otherwise "peri" inside e.g. "Postmenopausal hyperpigmentation" could collide. Flagged in VALIDATION_REPORT. |
| **F-PCOS-1 retired** | ⚠ F-PCOS-1 still scored as primary kit for "PCOS only (no obesity)" in schema clinicalMappings. See VALIDATION_REPORT — collision with memory lock. |
| **HBR standalone-only** | ✅ G-3 enforced in code. 2026-06-18: gate re-routed from retired Q3 "Broken/short" option onto `cause` Hard water as the corroborating shaft-damage signal. Heat/chemical alone still insufficient. |
| **PCOS + Hypo → plain META B** | ✅ Enforced in `thyroidInjectionRule.ts` (THYROID_PCOS_UNIFICATION; locked rule 2026-06-17). |
| **GI GOLD only GERD/IBS/Acid reflux/Crohn at Phase 1** | ✅ 2026-06-18: schema text tightened — Constipation no longer routes to GI GOLD in the option triggers or `GI_GOLD_INJECTION` scoringSignal. Runtime `giGoldFinalGuardRule.ts` remains as defense-in-depth. |
| **Menopause continuum non-negotiable** | ✅ Enforced in `menopauseContinuumInjectionRule.ts`. |
