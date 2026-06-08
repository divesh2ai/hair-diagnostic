/**
 * Deterministic narrative composer.
 *
 * Produces patient / doctor / scientific framings + themes per
 * primary cause. Strings are templated from registry concepts; no AI.
 */

import {
  ClinicalReplayCase,
  DiagnosisResult,
  NarrativeResult,
  ProtocolResult,
} from "../types";

interface CauseNarrative {
  themes: string[];
  doctor: string;
  patient: string;
  scientific: string;
}

const NARRATIVES: Record<string, CauseNarrative> = {
  ANDROGEN_DRIVEN_MINIATURIZATION: {
    themes: ["ANDROGENIC_PROGRESSION", "ENDOCRINE_REBALANCE", "EXPECTATION_SETTING_SLOW"],
    doctor: "Androgen-mediated terminal-to-vellus conversion is the dominant explanation for the observed pattern thinning topology, with miniaturization pathway leading on signal weight aggregation; the hormonal axis (and in female patients the perimenopausal or menopausal estrogen profile) modulates expression and is addressed alongside follicle-directed therapy.",
    patient: "Your hair is getting finer because of how your follicles respond to hormonal signals over time — a hereditary pattern that progresses gradually if left alone. In female pattern this often interacts with menopausal or perimenopausal shifts. Addressing the hormonal context alongside targeted hair therapy slows the pattern and supports density when started early and continued consistently.",
    scientific: "DHT-driven dermal-papilla signaling shortens anagen and reduces follicle volume across successive cycles, producing the gradient thinning topology observed in this case; the female pattern is hormonally modulated by perimenopausal and menopausal estrogen withdrawal, requiring endocrine rebalance alongside follicle-directed therapy for stabilisation.",
  },
  STRESS_DRIVEN_TELOGEN_EFFLUVIUM: {
    themes: ["CYCLE_RESET", "REVERSIBILITY_REASSURANCE", "STRESS_RECOVERY"],
    doctor: "Diffuse synchronized telogen release triggered by an identifiable precipitant; architectural follicle integrity is preserved and the chronic shedding pattern is fully reversible once the precipitant resolves and a full telogen cycle elapses.",
    patient: "A stress event two to four months ago pushed many hairs into a resting telogen phase, which now show up as visible shedding. This is fully reversible — most regrowth happens over the next telogen cycle once chronic stress is addressed.",
    scientific: "Stress-axis activation accelerates anagen-to-telogen transition; the diffuse shedding lags the precipitant by approximately one telogen cycle and is reversible once HPA-axis tone normalises and follicle cycling re-synchronises across the chronic phase.",
  },
  POST_PARTUM_TE: {
    themes: ["CYCLE_RESET", "REVERSIBILITY_REASSURANCE", "HORMONAL_RECOVERY"],
    doctor: "Post-partum diffuse shedding driven by the abrupt estrogen withdrawal at parturition; the synchronised telogen release is physiologic, time-limited, and architecturally non-destructive to follicles.",
    patient: "Pregnancy held many hairs in growth phase for longer than usual. After delivery, that group enters the resting phase together and sheds over a few months. It looks alarming but reverses on its own as your hormones rebalance.",
    scientific: "Estrogen-mediated anagen prolongation during pregnancy is released abruptly post-partum; the resulting synchronised telogen entry produces visible diffuse shedding between months two and six, with spontaneous recovery as cycling de-synchronises.",
  },
  ILLNESS_DRIVEN_TE: {
    themes: ["CYCLE_RESET", "REVERSIBILITY_REASSURANCE", "INFLAMMATORY_RECOVERY"],
    doctor: "Post-illness or post-surgical diffuse telogen release driven by systemic cytokine load and nutrient redistribution during recovery; reversible once systemic inflammation resolves and substrate availability is restored.",
    patient: "Illness or surgery pulls nutrients and energy toward recovery, which forces many follicles into a resting phase. The shedding shows up a couple of months later and recovers as your body settles and follicle cycling re-aligns.",
    scientific: "Systemic inflammatory states elevate IL-6 and TNF-α, suppress anagen maintenance, and synchronise telogen entry; recovery follows once cytokine load normalises and substrate redistribution to follicles resumes.",
  },
  MEDICATION_INDUCED_TE: {
    themes: ["CYCLE_RESET", "REVERSIBILITY_REASSURANCE", "PHARMACOLOGIC_RECOVERY"],
    doctor: "Medication-associated diffuse shedding consistent with anagen suppression or accelerated telogen entry; clinically reversible on discontinuation or substitution where medically appropriate, with cycling restored over one to two telogen cycles.",
    patient: "A medication you are taking is interfering with how follicles cycle, leading to shedding. In most cases this reverses once the drug is stopped or substituted — never alter prescription medication without your physician.",
    scientific: "Several drug classes (retinoids, anticoagulants, antihypertensives, antidepressants) disrupt follicle cycling via anagen suppression or accelerated telogen entry; the shedding lags initiation by weeks to months and reverses on cessation.",
  },
  RAPID_WEIGHT_LOSS_TE: {
    themes: ["NUTRITIONAL_RESTORATION", "CYCLE_RESET", "REVERSIBILITY_REASSURANCE"],
    doctor: "Diffuse telogen release driven by acute substrate deficit from rapid weight loss; reversible once caloric and micronutrient intake stabilise and a full telogen cycle has elapsed under restored nutrition.",
    patient: "Sudden weight loss pulls calories and nutrients away from non-essential tissues like hair. Follicles shift into resting phase as a result. Restoring balanced nutrition reverses this within a few months.",
    scientific: "Acute caloric restriction and micronutrient depletion disrupt matrix proliferation; the resulting synchronised telogen entry produces visible diffuse shedding that resolves with restored substrate availability and follicle cycle re-synchronisation.",
  },
  NUTRITIONAL_HAIR_STRESS: {
    themes: ["NUTRITIONAL_RESTORATION", "REVERSIBILITY_REASSURANCE"],
    doctor: "Substrate insufficiency for follicular proliferation — iron, vitamin D, B-complex, or protein — is the dominant explanation; correction reverses the phenotype within a telogen cycle once stores are replete.",
    patient: "Your hair is reflecting a nutrient gap. Restoring substrate restores normal cycling and density typically follows within a few months once iron, vitamin D, B-complex, and protein are stable.",
    scientific: "Reduced ferritin and 25-OH-vitamin-D constrain matrix proliferation; correction reverses the phenotype within a telogen cycle once intracellular stores normalise and matrix kinetics resume baseline cycling.",
  },
  IRON_DEFICIENCY_ANAEMIA: {
    themes: ["NUTRITIONAL_RESTORATION", "REVERSIBILITY_REASSURANCE", "OXYGEN_DELIVERY_RECOVERY"],
    doctor: "Iron-restricted erythropoiesis with ferritin-driven matrix substrate deficit; hair phenotype reverses on iron repletion confirmed by ferritin normalisation rather than haemoglobin alone.",
    patient: "Low iron means follicles do not receive enough oxygen and building material. Restoring iron is non-negotiable here, and hair density follows over the next few months once your ferritin is well above the deficiency threshold.",
    scientific: "Low ferritin restricts matrix proliferation independent of overt anaemia; iron repletion targeting ferritin above 70 ng/mL precedes phenotype recovery by approximately one telogen cycle.",
  },
  HORMONAL_HAIR_LOSS: {
    themes: ["ENDOCRINE_REBALANCE", "ANDROGENIC_PROGRESSION", "EXPECTATION_SETTING_SLOW"],
    doctor: "Endocrine perturbation — PCOS, thyroid axis, or peri/post-menopausal estrogen withdrawal — is the named driver of the observed loss; correcting the upstream endocrine state typically improves the hair phenotype on standard cycles.",
    patient: "A hormonal shift is the leading explanation here — PCOS, thyroid, or a menopausal transition. Addressing the underlying endocrine state, alongside targeted hair therapy, gives the best chance of improvement and is reversible in many cases.",
    scientific: "Thyroid, androgen, estrogen, and insulin–PCOS axes modulate follicle cycling; perturbation in any of these endocrine systems produces phenotype-specific loss patterns including diffuse and menopausal patterns that respond when the axis is rebalanced.",
  },
  PCOS_DRIVEN_HORMONAL: {
    themes: ["ENDOCRINE_REBALANCE", "ANDROGENIC_PROGRESSION", "EXPECTATION_SETTING_SLOW"],
    doctor: "PCOS-driven hyperandrogenism with insulin-axis cross-talk explains the female-pattern thinning topology; metabolic and hormonal correction precede the hair-directed therapy on a months-long timeline.",
    patient: "PCOS shifts your hormones in a way that affects how follicles cycle, producing thinning at the crown and parting. Addressing the hormonal and metabolic side gives the best chance of stabilising and improving density.",
    scientific: "Hyperinsulinaemia suppresses SHBG, raises bioavailable androgens, and amplifies follicular miniaturisation; reversing the metabolic axis reduces androgenic drive and supports follicle recovery over successive cycles.",
  },
  HYPOTHYROID_HAIR_LOSS: {
    themes: ["ENDOCRINE_REBALANCE", "REVERSIBILITY_REASSURANCE"],
    doctor: "Hypothyroid-driven follicular hypoproliferation; hair phenotype reverses once euthyroid status is restored, with hair-directed therapy supporting the recovery cycle on standard cycling timelines.",
    patient: "An underactive thyroid slows almost every cell in the body, including follicles. Once your thyroid hormone is in range, hair cycling resumes and density typically improves over a few months.",
    scientific: "Reduced T3 lowers matrix proliferation kinetics and shortens anagen; euthyroid restoration via replacement therapy precedes hair phenotype recovery by approximately one telogen cycle.",
  },
  HYPERTHYROID_HAIR_LOSS: {
    themes: ["ENDOCRINE_REBALANCE", "REVERSIBILITY_REASSURANCE"],
    doctor: "Hyperthyroid-driven accelerated telogen entry and diffuse shedding; phenotype reverses once thyroid hormone levels are normalised under endocrine management.",
    patient: "An overactive thyroid speeds up cycling and pushes more follicles into the resting phase, producing diffuse shedding. Once thyroid hormone levels are back in range, hair cycling normalises and density follows.",
    scientific: "Excess T3/T4 accelerates anagen-to-telogen transition and increases overall cycling rate; thyroid normalisation precedes phenotype recovery by approximately one telogen cycle.",
  },
  MENOPAUSAL_TRANSITION: {
    themes: ["ENDOCRINE_REBALANCE", "ANDROGENIC_PROGRESSION", "EXPECTATION_SETTING_SLOW"],
    doctor: "Peri- or post-menopausal estrogen decline unmasks androgenic influence on follicles, producing diffuse-plus-pattern thinning that responds best to combined hormonal and hair-directed therapy.",
    patient: "Lower estrogen during and after menopause reveals the androgen sensitivity your follicles always had, producing thinning at the crown and parting. Treatment combines hormonal support with targeted hair therapy on a months-long timeline.",
    scientific: "Estrogen withdrawal removes a protective tone on follicle cycling and unmasks androgenic miniaturisation pressure; combined endocrine and follicle-directed therapy supports stabilisation over successive cycles.",
  },
  METABOLIC_HAIR_DYSFUNCTION: {
    themes: ["MULTIFACTORIAL_COORDINATION", "ENDOCRINE_REBALANCE"],
    doctor: "Insulin–androgen axis cross-talk is the named driver of the follicular phenotype; multiple metabolic drivers act together and therapy combines metabolic optimisation with hair-directed support on a coordinated multi-phase timeline.",
    patient: "Multiple metabolic factors are working together — sugar regulation, weight, and related hormonal patterns. Addressing them in combination is the primary explanation here, and stabilising metabolism unlocks the rest of the protocol over a few months.",
    scientific: "Hyperinsulinaemia raises bioavailable androgens via SHBG suppression, amplifying miniaturisation risk; multiple converging metabolic drivers require coordinated correction to reduce androgenic drive and restore follicle cycling kinetics across successive cycles.",
  },
  AUTOIMMUNE_HAIR_LOSS: {
    themes: ["AUTOIMMUNE_CONTROL", "EXPECTATION_SETTING_SLOW"],
    doctor: "Immune-mediated follicular targeting is the named driver, supported by patchy topology and alopecia areata history; treatment focuses on immune quiescence and relapse-remission expectation setting over months.",
    patient: "Your immune system is reacting against the follicles. Treatment focuses on calming that response and supporting regrowth — outcomes vary and we plan for relapse cycles as part of the long-term plan.",
    scientific: "Loss of immune privilege at the follicle bulge with CD8+ T-cell infiltration produces the areata phenotype; scarring forms reflect irreversible perifollicular fibrosis when intervention is delayed beyond critical windows.",
  },
  GUT_HAIR_AXIS_DYSFUNCTION: {
    themes: ["GUT_RECOVERY", "NUTRITIONAL_RESTORATION", "REVERSIBILITY_REASSURANCE"],
    doctor: "Functional malabsorption and chronic gut inflammation are the named upstream drivers of the substrate insufficiency manifesting in hair; gut correction precedes other layers in the protocol sequence and is reversible over a telogen cycle.",
    patient: "Your gut and hair are connected — chronic gut symptoms are reducing how much your follicles can build with. Addressing gut function is the upstream lever and comes first in your protocol; the hair phenotype is reversible once gut is settled.",
    scientific: "Chronic mucosal inflammation reduces iron and B-complex bioavailability while systemic cytokine load suppresses anagen; gut healing precedes substrate-driven follicle recovery across successive telogen cycles and is reversible.",
  },
  INFLAMMATORY_SCALP_DYSFUNCTION: {
    themes: ["INFLAMMATORY_QUIESCENCE", "REVERSIBILITY_REASSURANCE"],
    doctor: "Perifollicular and surface inflammation is the named driver; resolving the scalp-surface dermatosis restores cycling and unlocks the rest of the protocol when present in a multi-factorial case.",
    patient: "The scalp environment around the follicle is inflamed. Calming the scalp is the primary lever here, and improvement is generally fast once inflammation settles and follicle cycling resumes.",
    scientific: "Malassezia-driven seborrhoeic inflammation and cytokine load disrupt anagen maintenance and pigmentation; topical and systemic anti-inflammatory therapy precedes follicle phenotype recovery within weeks to a single cycle.",
  },
  OXIDATIVE_LIFESTYLE: {
    themes: ["OXIDATIVE_RECOVERY", "INFLAMMATORY_QUIESCENCE", "REVERSIBILITY_REASSURANCE"],
    doctor: "Lifestyle-driven oxidative load — smoking, alcohol, pollution exposure — is the named upstream driver of follicular cycle disruption; behavioural and antioxidant interventions precede hair-directed therapy in the protocol sequence.",
    patient: "Smoking, alcohol, and similar exposures generate damaging molecules that injure follicles. Reducing those exposures alongside antioxidant support is the upstream lever for your hair density.",
    scientific: "Reactive oxygen species from tobacco, alcohol, and pollutants damage follicle stem cells and shorten anagen; reducing exposure and supplying antioxidants supports phenotype recovery over successive cycles.",
  },
  CIRCADIAN_DRIVEN_TE: {
    themes: ["CIRCADIAN_RECOVERY", "CYCLE_RESET", "REVERSIBILITY_REASSURANCE"],
    doctor: "Circadian disruption from shift work or frequent long-haul travel desynchronises follicle cycling and amplifies stress-axis tone; corrective sleep architecture is the upstream lever and precedes hair-directed therapy.",
    patient: "Disrupted sleep and timezone shifts throw off the daily rhythms that follicles rely on, leading to shedding. Fixing your sleep window is the upstream lever, with targeted hair support layered on top.",
    scientific: "Misaligned circadian cues disrupt cortisol, melatonin, and clock-gene expression in follicles; restoring stable sleep architecture is necessary for matrix proliferation kinetics to normalise across successive cycles.",
  },
  HAIR_SHAFT_DAMAGE_SYNDROME: {
    themes: ["SHAFT_RECONSTRUCTION", "REVERSIBILITY_REASSURANCE"],
    doctor: "Cuticle/cortex compromise from extrinsic exposures is the named driver; follicular architecture is intact and the phenotype reflects shaft-level damage rather than active shedding from the root.",
    patient: "Your hair is breaking, not falling — the strands are damaged by heat, chemicals, or environment, not the roots. Treatment focuses on shaft reconstruction and protective practice over the coming weeks to months.",
    scientific: "Repeated thermal and oxidative insults degrade cuticular integrity, producing mid-shaft fracture under normal mechanical load; shaft-directed therapy and reduced exposure precede visible recovery.",
  },
  TRICHOTILLOMANIA_CAUSE: {
    themes: ["BEHAVIOURAL_REGULATION", "EXPECTATION_SETTING_SLOW", "REVERSIBILITY_REASSURANCE"],
    doctor: "Compulsive hair-pulling behaviour produces the patchy distribution with broken hairs of varying length; behavioural intervention precedes follicle-directed therapy in the protocol sequence.",
    patient: "Pulling hair, often without realising, is the driver here. Reducing the behaviour with structured support is the first step, and follicles recover once the pulling stops over a few months.",
    scientific: "Impulse-control behaviour produces mechanical follicle disruption with broken hairs of varying lengths and patchy distribution; recovery requires behavioural intervention as the necessary precursor to follicle-level therapy.",
  },
  MULTIFACTORIAL_HAIR_LOSS: {
    themes: ["MULTIFACTORIAL_COORDINATION", "EXPECTATION_SETTING_SLOW"],
    doctor: "No single driver dominates; the case requires a composite explanation across at least three pathways. Treatment must address the top co-leading causes in parallel under a coordinated phased protocol.",
    patient: "Multiple causes are working together here. We need to address more than one driver to see meaningful improvement — single-lever fixes will under-deliver, and the protocol is staged across several phases.",
    scientific: "Multiple converging mechanisms exceed activation threshold without a single dominant posterior; treatment combinatorics required across endocrine, metabolic, inflammatory, and substrate axes in a coordinated sequence.",
  },
};

function normaliseCauseId(raw: string): string {
  if (!raw) return raw;
  return raw
    .toUpperCase()
    .replace(/-/g, "_")
    .replace(/\s+/g, "_");
}

function fallbackNarrative(): CauseNarrative {
  return {
    themes: ["EXPECTATION_SETTING_SLOW", "MULTIFACTORIAL_COORDINATION"],
    doctor: "Cause posterior is below confidence floor for a single dominant driver; defer to a conservative phased protocol pending repeat assessment, additional history, and where indicated targeted laboratory evaluation over the next clinical cycle.",
    patient: "We do not yet have enough information to name a single dominant cause for your hair changes. We will start a conservative supportive protocol while gathering additional history and tests, and refine the plan at your next review.",
    scientific: "Insufficient signal weight for a confident causal hypothesis at this evaluation; supportive intervention and repeat clinical assessment with targeted investigations are warranted to disambiguate competing mechanisms in subsequent cycles.",
  };
}

export function composeNarrative(
  c: ClinicalReplayCase,
  diag: DiagnosisResult,
  protocol: ProtocolResult
): NarrativeResult {
  const key = normaliseCauseId(diag.primary);
  const base = NARRATIVES[key] ?? fallbackNarrative();
  const themes = new Set(base.themes);
  if (diag.coExplanations.length > 0) themes.add("MULTIFACTORIAL_COORDINATION");
  if (c.questionnaireAnswers.deficiency?.length) themes.add("NUTRITIONAL_RESTORATION");
  if (protocol.protocolClass === "TE_POST_ILLNESS") themes.add("STRESS_RECOVERY");

  return {
    themes: [...themes].sort(),
    patientFraming: base.patient,
    doctorFraming: base.doctor,
    scientificFraming: base.scientific,
  };
}
