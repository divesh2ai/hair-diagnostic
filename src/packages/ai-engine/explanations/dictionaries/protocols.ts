import type { ProtocolDictionary } from '../types';

// Protocol-level explanations for every DiagnosisKey.
// Maps the clinical rationale of PROTOCOL_SEQUENCER into human-readable form.
// phaseRationale entries are ordered to match the phases[] array in protocolSequencer.ts.
export const PROTOCOL_EXPLANATIONS: ProtocolDictionary = {

  TE_STRESS: {
    clinical:
      'Stress-TE protocol. Primary objective is telogen phase stabilisation via adaptogenic, anti-inflammatory, and micronutrient support before addressing residual scalp inflammation.',
    patient:
      'Your treatment plan first stops the shedding by stabilising your hair cycle, then clears the scalp inflammation driven by ongoing stress.',
    phaseRationale: [
      'Phase 1 — HAIR FACT TE GOLD: Arrest active shedding. This is the non-negotiable first step — stopping follicular loss before any other intervention can take effect.',
      'Phase 2 — PHENOTYPE INFLAMATION: Clear the chronic stress-driven NF-kB/TNF-α scalp inflammatory load that maintains the hostile follicular microenvironment.',
    ],
  },

  TE_NUTRITION: {
    clinical:
      'Nutritional TE protocol. Arrest active shedding first; resolve residual inflammatory load second. Immune support only added if separate immunity signals are present.',
    patient:
      'Your treatment first stops shedding by correcting the nutritional root cause, then clears any scalp inflammation that has built up as a result.',
    phaseRationale: [
      'Phase 1 — HAIR FACT TE GOLD: Stop active shedding and replenish the micronutrients most commonly deficient in nutritional TE.',
      'Phase 2 — PHENOTYPE INFLAMATION: Clear the secondary scalp inflammatory load that nutritional deficiency has created.',
    ],
  },

  TE_POSTPREG: {
    clinical:
      'Post-partum breastfeeding TE protocol. Lactational nutritional demand is clinically highest priority; TE arrest follows; immune restoration is final phase.',
    patient:
      'Your plan first supports the demanding nutritional needs of breastfeeding, then stops the post-pregnancy shedding, then rebuilds immune resilience.',
    phaseRationale: [
      'Phase 1 — LACTIHEALTH: Address the elevated nutritional demands of breastfeeding — this is the highest priority driver in post-partum TE.',
      'Phase 2 — HAIR FACT TE GOLD: Arrest the concurrent post-partum shedding once maternal nutritional status is supported.',
      'Phase 3 — PRO IMMUNE GOLD: Rebuild post-partum immunity that has been depleted by delivery and sustained lactation.',
    ],
  },

  TE_DELIVERY: {
    clinical:
      'Post-delivery non-breastfeeding TE protocol. Shedding arrest is primary; post-partum immune restoration follows.',
    patient:
      'Your plan first stops the post-delivery shedding, then rebuilds the immune resilience depleted by the delivery process.',
    phaseRationale: [
      'Phase 1 — HAIR FACT TE GOLD: Arrest post-natal TE shedding triggered by the rapid oestrogen decline following delivery.',
      'Phase 2 — PRO IMMUNE GOLD: Restore immune competence depleted by the physiological demands of delivery.',
    ],
  },

  TE_ILLNESS: {
    clinical:
      'Illness/medication TE protocol. Post-illness immune recovery must precede TE kit efficacy — inflamed terrain absorbs nutrients poorly. Immune priming first is non-negotiable.',
    patient:
      'Your plan starts by rebuilding your immune system after illness, because your body needs to be in a recovery state before the hair-specific treatment can work fully.',
    phaseRationale: [
      'Phase 1 — PRO IMMUNE GOLD: Clear post-illness systemic inflammation first — TE GOLD cannot reach its efficacy threshold until immune terrain is restored.',
      'Phase 2 — HAIR FACT TE GOLD: Arrest the diffuse shedding triggered by the illness or medication.',
      'Phase 3 — PHENOTYPE INFLAMATION: Clear residual post-illness scalp inflammatory load that PRO IMMUNE alone does not fully address.',
    ],
  },

  AGA_MALE_123: {
    clinical:
      'Male AGA grade 1–3 protocol. Layered five-phase approach: shedding arrest → microenvironment clearance → DHT blockade → metabolic axis correction → immune-nutritional supply.',
    patient:
      'Your treatment works in five structured phases: stopping shedding, clearing scalp inflammation, blocking DHT, correcting metabolic drivers, then building the nutritional supply for regrowth.',
    phaseRationale: [
      'Phase 1 — HAIR FACT TE GOLD: Arrest any active shedding component. Shedding on top of pattern loss compounds the clinical picture — stop it first.',
      'Phase 2 — PHENOTYPE INFLAMATION: Clear the NF-kB/TNF-α scalp inflammatory terrain so that DHT-blocking nutrients in Phase 3 can actually reach follicles.',
      'Phase 3 — MPHL: Correct DHT-mediated miniaturisation with targeted anti-androgenic and follicle-protective compounds.',
      'Phase 4 — PRO FACT META B: Correct the insulin-androgen axis and improve SHBG to reduce free androgen bioavailability.',
      'Phase 5 — PRO IMMUNE GOLD: Deliver immune-nutritional regrowth support (EGF/Colostrum/Lactoferrin) into a clean, well-prepared follicular environment.',
    ],
  },

  AGA_MALE_45: {
    clinical:
      'Male AGA grade 4–5 protocol. Immune priming leads — follicular rescue environment must be established before DHT correction in advanced grade.',
    patient:
      'For advanced hair loss, your treatment first primes the environment for follicle recovery, then addresses DHT, then clears any remaining scalp inflammation.',
    phaseRationale: [
      'Phase 1 — PRO IMMUNE GOLD: Prime the follicular rescue environment first. At grade 4–5, compromised follicles need immune-nutritional restoration before DHT blockade can be effective.',
      'Phase 2 — MPHL: Apply DHT correction into the prepared environment to halt and partially reverse the advanced miniaturisation pattern.',
      'Phase 3 — PHENOTYPE INFLAMATION: Clear the scalp microenvironment to maximise the anagen re-entry environment created by Phase 1 and Phase 2.',
    ],
  },

  AGA_FEMALE_123: {
    clinical:
      'Female AGA grade 1–3 protocol. Five-phase layered approach mirroring MPHL logic adapted for female androgenetic pattern.',
    patient:
      'Your treatment follows five structured phases: stopping shedding, clearing inflammation, addressing the androgenetic pattern, correcting metabolic factors, then building the nutritional foundation for regrowth.',
    phaseRationale: [
      'Phase 1 — HAIR FACT TE GOLD: Arrest the active shedding component that overlays the androgenetic pattern in most early FPHL presentations.',
      'Phase 2 — PHENOTYPE INFLAMATION: Clear perifollicular inflammatory terrain to allow FPHL correction compounds to reach target follicles effectively.',
      'Phase 3 — FPHL: Apply female-specific androgenetic correction — targeting 5α-reductase and androgen receptor sensitivity in crown follicles.',
      'Phase 4 — PRO FACT META B: Correct metabolic terrain (insulin-androgen axis, SHBG, AMPK pathway) sustaining androgenic drive.',
      'Phase 5 — PRO IMMUNE GOLD: Deliver regrowth-stimulating immune-nutritional support into the prepared follicular environment.',
    ],
  },

  AGA_FEMALE_45: {
    clinical:
      'Female AGA grade 4–5 protocol. Immune environment priming leads, followed by FPHL androgenic correction, then microenvironment clearance.',
    patient:
      'For advanced female pattern thinning, your treatment starts by building the recovery environment, then addresses the hormonal pattern, then clears remaining inflammation.',
    phaseRationale: [
      'Phase 1 — PRO IMMUNE GOLD: Establish the follicular rescue environment. Advanced grade requires immune priming before hormonal correction.',
      'Phase 2 — FPHL: Correct the female androgenetic pattern in the prepared environment.',
      'Phase 3 — PHENOTYPE INFLAMATION: Clear the scalp microenvironment to complete the environment for anagen re-entry.',
    ],
  },

  PCOS_ONLY: {
    clinical:
      'PCOS (non-metabolic) protocol. Androgen excess correction is Phase 1 priority; inflammation clearance follows; concurrent TE shedding is managed in Phase 3.',
    patient:
      'Your treatment first corrects the hormone imbalance driving your PCOS, then clears scalp inflammation, then addresses any active shedding.',
    phaseRationale: [
      'Phase 1 — F-PCOS-1: Correct androgen excess and insulin-AMPK pathway dysregulation — the two primary drivers of PCOS-associated hair loss.',
      'Phase 2 — PHENOTYPE INFLAMATION: Clear the PCOS-driven inflammatory scalp load.',
      'Phase 3 — HAIR FACT TE GOLD: Address the concurrent telogen effluvium component that commonly overlays PCOS hair loss.',
    ],
  },

  PCOS_OBESITY: {
    clinical:
      'PCOS with metabolic syndrome protocol. PRO FACT META B PCOS is the single integrated kit; F-PCOS-1 is never co-prescribed (complete ingredient overlap).',
    patient:
      'Because PCOS and metabolic factors are combined, your treatment uses one powerful integrated kit that addresses both pathways simultaneously.',
    phaseRationale: [
      'Phase 1 — PRO FACT META B PCOS: Single integrated kit combining AMPK/insulin correction (Berberine) with androgen suppression (Inositol + D-Chiro + Spearmint). Replaces F-PCOS-1 to avoid ingredient duplication.',
      'Phase 2 — PHENOTYPE INFLAMATION: Clear the systemic inflammatory load driven by the combined PCOS-metabolic picture.',
    ],
  },

  THYROID_HYPO: {
    clinical:
      'Hypothyroid protocol. Thyroid metabolic correction leads; inflammation clearance follows; shedding arrest is Phase 3. Metabolic modifier rule may upgrade to META B at runtime if obesity signal is present.',
    patient:
      'Your treatment starts by supporting your thyroid function — because until metabolism is restored, other treatments cannot work effectively.',
    phaseRationale: [
      'Phase 1 — PRO FACT META B HYPOTHYROID: Correct thyroid metabolic support co-factors to restore basal metabolic rate. This unlocks cellular metabolism for all downstream phases.',
      'Phase 2 — PHENOTYPE INFLAMATION: Clear the hypothyroid-driven systemic inflammation that has accumulated in the follicular microenvironment.',
      'Phase 3 — HAIR FACT TE GOLD: Arrest the concurrent diffuse shedding that accompanies hypothyroid-related hair loss.',
    ],
  },

  THYROID_HYPER: {
    clinical:
      'Hyperthyroid protocol. Metabolic overactivity correction leads; TE shedding arrest follows; immune restoration in Phase 3 addresses oxidative immune depletion.',
    patient:
      'Your treatment first stabilises the overactive thyroid metabolic state, then stops the shedding it is causing, then rebuilds immune resilience.',
    phaseRationale: [
      'Phase 1 — PRO FACT THYROID CARE: Correct hyperthyroid metabolic overactivity and reduce the oxidative follicular stress it generates.',
      'Phase 2 — HAIR FACT TE GOLD: Arrest the concurrent diffuse shedding driven by hyperthyroid-induced follicular cycling disruption.',
      'Phase 3 — PRO IMMUNE GOLD: Rebuild immunity depleted by chronic hyperthyroid-driven oxidative stress.',
    ],
  },

  ALOPECIA_AREATA: {
    clinical:
      'Alopecia areata protocol. AA-specific immune privilege restoration leads; metabolic terrain support follows; inflammation clearance and immune rebuild complete the stack.',
    patient:
      'Your treatment starts with a kit specifically designed to calm the autoimmune response targeting your follicles, then supports your overall immune balance.',
    phaseRationale: [
      'Phase 1 — HAIR FACT ALOPECIA AREATA: Target the autoimmune follicular attack directly with AA-specific immune-modulating compounds.',
      'Phase 2 — PRO FACT META B: Correct metabolic terrain supporting the inflammatory immune dysregulation underpinning AA.',
      'Phase 3 — PHENOTYPE INFLAMATION: Clear the perifollicular inflammatory microenvironment after immune privilege restoration begins.',
      'Phase 4 — PRO IMMUNE GOLD: Rebuild balanced immune function to sustain the remission achieved by Phase 1.',
    ],
  },

  PERI_MENOPAUSE: {
    clinical:
      'Peri-menopause protocol. Hormonal stabilisation leads; FPHL androgenic correction follows; shedding arrest in Phase 3; immune support last.',
    patient:
      'Your treatment first stabilises the hormonal fluctuations of peri-menopause, then addresses the pattern thinning, then stops shedding, then rebuilds immune health.',
    phaseRationale: [
      'Phase 1 — HAIR FACT PERI MENOPAUSE: Stabilise the hormonal fluctuations of the peri-menopausal transition — the primary driver of follicular vulnerability at this stage.',
      'Phase 2 — FPHL: Correct the androgenetic pattern loss revealed by declining oestrogen during peri-menopause.',
      'Phase 3 — HAIR FACT TE GOLD: Address the concurrent active shedding component common in peri-menopausal presentations.',
      'Phase 4 — PRO IMMUNE GOLD: Deliver immune-nutritional support as the final phase into a stabilised hormonal and inflammatory environment.',
    ],
  },

  MENOPAUSE: {
    clinical:
      'Menopause protocol. Sustained oestrogen decline and metabolic shift are addressed first via integrated menopausal META B; FPHL androgenic correction follows; TE shedding last.',
    patient:
      'Your treatment starts with a kit specifically designed for the menopausal hormonal and metabolic shift, then addresses pattern thinning, then stops any active shedding.',
    phaseRationale: [
      'Phase 1 — PRO FACT META B MENOPAUSE: Correct sustained oestrogen decline, associated metabolic shift, and the downstream androgenic effect on follicles.',
      'Phase 2 — FPHL: Address the androgenetic miniaturisation pattern that accelerates after oestrogen loss.',
      'Phase 3 — HAIR FACT TE GOLD: Manage the concurrent diffuse shedding common in menopausal presentations.',
    ],
  },

  POST_MENOPAUSE: {
    clinical:
      'Post-menopause protocol. Sustained post-menopausal metabolic correction leads; FPHL androgenic correction follows; TE shedding and immune rebuild complete the stack.',
    patient:
      'Your treatment addresses the long-term metabolic changes of post-menopause first, then the pattern thinning, then shedding, then rebuilds immune resilience.',
    phaseRationale: [
      'Phase 1 — PRO FACT META B POSTMENOPAUSE: Correct the post-menopausal metabolic shift, insulin resistance, and chronic androgen-oestrogen imbalance.',
      'Phase 2 — FPHL: Address the sustained androgenetic miniaturisation pattern of post-menopausal hair loss.',
      'Phase 3 — HAIR FACT TE GOLD: Manage the concurrent shedding component.',
      'Phase 4 — PRO IMMUNE GOLD: Rebuild immune resilience depleted by the chronic low-oestrogen inflammatory state.',
    ],
  },

  ENDOMETRIOSIS: {
    clinical:
      'Endometriosis protocol. Hormonal-inflammatory balance correction leads via FH WELL 3; systemic inflammation clearance follows; immune modulation completes.',
    patient:
      'Your treatment first addresses the hormonal-inflammatory imbalance central to endometriosis, then clears systemic inflammation, then rebuilds immune balance.',
    phaseRationale: [
      'Phase 1 — FH WELL 3: Target the endometriotic hormonal-inflammatory environment — the primary driver of both the systemic condition and its hair effects.',
      'Phase 2 — PHENOTYPE INFLAMATION: Clear the systemic prostaglandin-driven inflammatory load affecting scalp follicles.',
      'Phase 3 — PRO IMMUNE GOLD: Modulate the immune dysregulation that underlies endometriosis-associated systemic inflammation.',
    ],
  },

  PREGNANCY: {
    clinical:
      'Pregnancy protocol. Absolute lock: HEALTHY-9 only. Single kit; no additional kits are prescribed under any circumstances during active pregnancy.',
    patient:
      'During pregnancy, your treatment is a single, carefully selected pregnancy-specific supplement that is completely safe and supports both you and your baby.',
    phaseRationale: [
      'Phase 1 — HEALTHY-9: The only compound prescribed during active pregnancy. All other kits are absolutely contraindicated to protect foetal safety.',
    ],
  },

  IRON_DEFICIENCY: {
    clinical:
      'Iron deficiency protocol. Ferritin restoration is non-negotiable Phase 1; TE shedding arrest follows once iron is corrected; PRO IMMUNE explicitly indicated for iron deficiency cases.',
    patient:
      'Your treatment starts with rebuilding your iron stores first — everything else works better once iron levels are restored. Shedding support follows, then immune rebuilding.',
    phaseRationale: [
      'Phase 1 — IRON UP GOLD: Restore ferritin to therapeutic levels. Iron repletion must precede TE treatment — shedding continues until the root deficiency is corrected.',
      'Phase 2 — HAIR FACT TE GOLD: Arrest the TE shedding once iron correction is underway and follicular oxygen delivery is restored.',
      'Phase 3 — PRO IMMUNE GOLD: Explicitly indicated for iron deficiency — iron depletion and immune compromise are closely linked.',
    ],
  },

  SCALP_INFLAM: {
    clinical:
      'Scalp inflammation protocol. Microenvironment clearance is mandatory Phase 1 before any androgenic correction. AGA_GENDER resolved to MPHL or FPHL at runtime.',
    patient:
      'Clearing scalp inflammation is the essential first step — without it, the hair-specific treatment cannot work effectively.',
    phaseRationale: [
      'Phase 1 — PHENOTYPE INFLAMATION: Inflammation must be fully cleared before any AGA correction can penetrate the follicular microenvironment effectively.',
      'Phase 2 — AGA_GENDER (runtime resolved): Once the inflammatory terrain is cleared, the appropriate male or female pattern loss correction is applied.',
    ],
  },

  HAIR_BREAKAGE: {
    clinical:
      'Hair breakage protocol. Shaft repair and cortical integrity restoration leads; scalp inflammation clearance follows.',
    patient:
      'Your treatment first repairs the structural damage to your hair shaft, then clears any scalp inflammation contributing to the problem.',
    phaseRationale: [
      'Phase 1 — HAIR FACT HAIR BREAKAGE REPAIR (HBR): Repair mid-shaft cortical keratin damage and restore cuticle integrity to prevent further breakage.',
      'Phase 2 — PHENOTYPE INFLAMATION: Clear the secondary scalp inflammation that can exacerbate hair breakage patterns.',
    ],
  },

  NIGHT_SHIFT: {
    clinical:
      'Night shift protocol. Circadian reset is the primary driver; concurrent TE shedding arrest follows; oxidative/inflammatory load from sleep disruption cleared in Phase 3.',
    patient:
      'Your treatment starts by resetting your circadian biology — that hormonal rhythm is the root of the hair impact from night shift work.',
    phaseRationale: [
      'Phase 1 — HAIR FACT NIGHT SHIFT: Reset melatonin, cortisol, and growth hormone circadian rhythms — the primary drivers of shift-work-associated hair loss.',
      'Phase 2 — HAIR FACT TE GOLD: Address concurrent shedding triggered by circadian-disrupted hormonal patterns.',
      'Phase 3 — PHENOTYPE INFLAMATION: Clear the oxidative and inflammatory load accumulated from chronic sleep architecture disruption.',
    ],
  },

  FREQUENT_FLYING: {
    clinical:
      'Frequent flying protocol. Combined circadian and travel stress correction leads; concurrent TE managed in Phase 2; oxidative cabin load cleared in Phase 3.',
    patient:
      'Your treatment first addresses the body-clock and immune stress from frequent travel, then supports hair health through the shedding and oxidative aspects.',
    phaseRationale: [
      'Phase 1 — HAIR FACT FREQUENT FLYERS: Correct the circadian desynchrony, immune suppression, and oxidative stress specific to frequent long-haul travel.',
      'Phase 2 — HAIR FACT TE GOLD: Manage the concurrent shedding driven by chronic travel-related physiological stress.',
      'Phase 3 — PHENOTYPE INFLAMATION: Clear the cabin radiation and environmental oxidative inflammatory load.',
    ],
  },

  OXIDATIVE: {
    clinical:
      'Oxidative stress protocol. PHENOTYPE INFLAMATION enables the oxidative stress kit; PRO IMMUNE rebuilds depleted antioxidant immune defence.',
    patient:
      'Your treatment first clears the scalp inflammatory load created by oxidative stress, then directly targets the free radical damage, then rebuilds immune antioxidant defences.',
    phaseRationale: [
      'Phase 1 — PHENOTYPE INFLAMATION: Prepare the inflammatory terrain — oxidative stress kit works optimally in a cleared microenvironment.',
      'Phase 2 — OXIDATIVE STRESS: Directly target the oxidative damage pathway driving premature follicular senescence.',
      'Phase 3 — PRO IMMUNE GOLD: Rebuild immune and antioxidant defence capacity depleted by chronic oxidative exposure.',
    ],
  },

  WEIGHT_LOSS: {
    clinical:
      'Rapid weight loss protocol. GLP-1/nutrient-deficit shedding shield at Phase 1 (non-negotiable); TE GOLD in reduced scope (Phase 2); immune rebuild in Phase 3.',
    patient:
      'Your treatment starts with a specific protective shield for your hair follicles during the rapid weight loss phase, then supports shedding arrest, then rebuilds immunity.',
    phaseRationale: [
      'Phase 1 — RAPID WEIGHT LOSS SHIELD: Arrest shedding at the GLP-1/nutrient-deficit trigger level. This is the primary intervention for rapid weight loss TE.',
      'Phase 2 — HAIR FACT TE GOLD (reduced scope): Iron/ferritin repletion and residual stress-TE support only — ingredient overlap with Phase 1 managed by the clinical engine.',
      'Phase 3 — PRO IMMUNE GOLD: Rebuild immunity depleted by the rapid nutrient loss that accompanies GLP-1 or crash-diet-driven weight reduction.',
    ],
  },

  TTM: {
    clinical:
      'Trichotillomania protocol. Neurological OCD-pathway modulation leads; TE Gold repairs follicular pulling damage; PHENOTYPE clears scalp trauma-induced inflammation.',
    patient:
      'Your treatment first supports the neurological pathways involved in the pulling urge, then helps damaged follicles recover, then clears scalp inflammation from the trauma.',
    phaseRationale: [
      'Phase 1 — HAIR FACT TTM (OCD): Address the neurological OCD-driven pulling urge with NAC/Inositol/Magnesium/B6/Zinc/Ashwagandha — the root cause must be targeted first.',
      'Phase 2 — HAIR FACT TE GOLD: Repair follicular damage and arrest the shedding caused by repeated mechanical avulsion.',
      'Phase 3 — PHENOTYPE INFLAMATION: Clear the scalp trauma-induced perifollicular inflammatory load from chronic pulling.',
    ],
  },

  CHRONIC_MEDICAL: {
    clinical:
      'Chronic medical protocol. Immune resilience restoration leads (chronic medication depletes immunity); inflammation clearance follows. META B added only when a true metabolic signal is present.',
    patient:
      'Your treatment first rebuilds immune resilience — because chronic medication often depletes it — then addresses the inflammation that is affecting your hair.',
    phaseRationale: [
      'Phase 1 — PRO IMMUNE GOLD: Rebuild immune resilience depleted by chronic medication or sustained systemic disease activity.',
      'Phase 2 — PHENOTYPE INFLAMATION: Clear the chronic low-grade inflammation driven by the underlying medical condition.',
    ],
  },

  DIABETES: {
    clinical:
      'Diabetes/pre-diabetes protocol. Insulin-AMPK pathway correction leads; hyperglycaemia-driven inflammation cleared in Phase 2; immune resilience rebuilt in Phase 3.',
    patient:
      'Your treatment starts by correcting the blood sugar and metabolic imbalance at the root of your hair concerns, then clears inflammation, then rebuilds immune health.',
    phaseRationale: [
      'Phase 1 — PRO FACT META B: Correct the insulin resistance, AMPK pathway dysfunction, and hyperglycaemia driving microvascular follicular damage.',
      'Phase 2 — PHENOTYPE INFLAMATION: Clear the chronic low-grade inflammation driven by sustained hyperglycaemia.',
      'Phase 3 — PRO IMMUNE GOLD: Rebuild immune resilience chronically suppressed by diabetic immune dysregulation.',
    ],
  },

  GUT_ISSUES: {
    clinical:
      'Gut-hair axis protocol. Gut microbiome restoration leads; gut-driven systemic inflammation cleared in Phase 2; immune rebuild in Phase 3; TE shedding addressed last once gut absorption is restored.',
    patient:
      'Your treatment starts in the gut — healing absorption first means every other treatment works more effectively. Inflammation, immunity, and shedding are addressed in sequence.',
    phaseRationale: [
      'Phase 1 — PRO FACT GI GOLD: Restore gut microbiome diversity and mucosal integrity to re-establish micronutrient bioavailability for hair follicles.',
      'Phase 2 — PHENOTYPE INFLAMATION: Address the gut-driven systemic LPS-mediated inflammatory load affecting follicular health.',
      'Phase 3 — PRO IMMUNE GOLD: Rebuild the gut-depleted immune competence.',
      'Phase 4 — HAIR FACT TE GOLD: Address the TE shedding component last — only once gut absorption is restored can hair-specific nutrients be effectively delivered.',
    ],
  },

  MOUTH_ULCERS: {
    clinical:
      'Mouth ulcer / gut-immune protocol. Gut-immune terrain cleared first; PRO IMMUNE reduces recurrent mucosal inflammation; OXIDATIVE STRESS addresses free radical ulceration driver.',
    patient:
      'Your treatment first clears the gut-immune inflammation causing recurring ulcers, then rebuilds immune defence, then addresses the oxidative stress underlying both conditions.',
    phaseRationale: [
      'Phase 1 — PHENOTYPE INFLAMATION: Clear the gut-immune inflammatory terrain driving recurrent mucosal ulceration.',
      'Phase 2 — PRO IMMUNE GOLD: Rebuild immune defence and reduce the recurrent mucosal inflammation cycle.',
      'Phase 3 — OXIDATIVE STRESS: Address the free radical load driving both mucosal ulceration and follicular stress.',
    ],
  },

  MULTI: {
    clinical:
      'Multi-factorial protocol. Universal terrain (inflammation) cleared first; TE shedding arrested in Phase 2; gut absorption restored; AGA_GENDER pattern correction last.',
    patient:
      'Your treatment follows a layered sequence designed for complex cases: clear inflammation first, stop shedding, restore gut health, then address pattern loss.',
    phaseRationale: [
      'Phase 1 — PHENOTYPE INFLAMATION: Inflammation is the universal terrain for multi-factorial cases — always the mandatory first phase.',
      'Phase 2 — HAIR FACT TE GOLD: Stop active shedding once the inflammatory microenvironment is being addressed.',
      'Phase 3 — PRO FACT GI GOLD: Restore gut absorption so that all subsequent nutritional interventions can be properly bioavailable.',
      'Phase 4 — AGA_GENDER (runtime resolved): Correct androgenetic pattern loss last, in a well-prepared systemic and follicular environment.',
    ],
  },

  EARLY_GREY: {
    clinical:
      'Premature canities protocol. Melanocyte-specific correction leads; oxidative damage pathway addressed in Phase 2; immune melanocyte protection in Phase 3.',
    patient:
      'Your treatment first directly targets the root causes of premature greying, then addresses the oxidative damage driving pigment loss, then strengthens immune protection for pigment cells.',
    phaseRationale: [
      'Phase 1 — EARLY GREYING CARE GOLD: Correct the nutritional deficiencies (copper, PABA, B12, folic acid) and melanocyte-specific factors driving premature pigment loss.',
      'Phase 2 — OXIDATIVE STRESS: Address the free radical damage pathway that drives melanocyte apoptosis in the follicular bulge.',
      'Phase 3 — PRO IMMUNE GOLD: Build immune protection for melanocyte stem cells and sustain the pigment restoration environment.',
    ],
  },

  REGROW_ONLY: {
    clinical:
      'Regrowth-only protocol. TE GOLD is never prescribed (no active shedding). PRO IMMUNE stimulates anagen re-entry; PHENOTYPE clears residual inflammation; META B corrects metabolic dormancy terrain.',
    patient:
      'Because your shedding has stopped, your treatment focuses entirely on waking up dormant follicles and creating the conditions for new hair to grow.',
    phaseRationale: [
      'Phase 1 — PRO IMMUNE GOLD: Stimulate follicular anagen re-entry via EGF/Colostrum/Lactoferrin signalling. This is the primary growth driver when shedding is absent.',
      'Phase 2 — PHENOTYPE INFLAMATION: Clear any residual scalp inflammation that is maintaining follicles in telogen dwell.',
      'Phase 3 — PRO FACT META B: Correct the metabolic terrain that may be sustaining follicular dormancy.',
    ],
  },
};
