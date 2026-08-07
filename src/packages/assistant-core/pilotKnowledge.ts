import type { KnowledgePublicationStatus } from "./knowledgeStatus";

export type PilotChunk = { id: string; kitId: string; sectionType: string; content: string; approvalStatus: KnowledgePublicationStatus };
const k = (kitId: string, sectionType: string, content: string): PilotChunk => ({ id: `${kitId}_${sectionType}_V1`, kitId, sectionType, content, approvalStatus: "MEDICAL_REVIEW" });

/** Exact rows from the supplied Clinical Chunks sheet; all remain pending medical review. */
export const PILOT_CHUNKS: PilotChunk[] = [
  k("KIT_TE_GOLD", "INDICATION", "Hair shedding pattern consistent with Telogen Effluvium, commonly triggered by physiological stress, illness or nutritional depletion."),
  k("KIT_TE_GOLD", "OBJECTIVE", "Interrupt active shedding and restore normal follicular cycling by correcting internal imbalances."),
  k("KIT_TE_GOLD", "STRATEGY", "Inflammation control; nutritional repletion; metabolic optimisation; hormonal modulation; stress regulation."),
  k("KIT_TE_GOLD", "FORMULATION_RATIONALE", "Bioavailable micronutrients, amino acids, anti-inflammatory antioxidants, metabolic and thyroid support, adaptogens, gut optimisation and lactoferrin-based iron support."),
  k("KIT_TE_GOLD", "EXPECTED_RESPONSE", "Weeks 2-4: noticeable reduction in daily hair fall. Weeks 6-8: improved hair strength. Weeks 10-12: early regrowth and cycle normalisation."),
  k("KIT_TE_GOLD", "CLINICAL_NOTE", "This is a foundational phase. Growth stimulation without stabilising shedding may produce suboptimal or short-lived results."),
  k("KIT_TE_GOLD", "CONCLUSION", "Designed to reset the internal environment required for healthy hair growth."),
  k("KIT_GI_GOLD", "INDICATION", "Gut imbalance or dysbiosis contributing to hair fall, skin issues, hormonal imbalance and stress-related symptoms."),
  k("KIT_GI_GOLD", "OBJECTIVE", "Restore gut balance, improve nutrient absorption, regulate inflammation and support hair, skin and hormonal function."),
  k("KIT_GI_GOLD", "STRATEGY", "Microbiome restoration; inflammation reduction; hormonal regulation; gut-brain support."),
  k("KIT_GI_GOLD", "FORMULATION_RATIONALE", "Probiotics and Bioperine for gut support; Ashwagandha, L-Tyrosine and Melatonin for stress; Vitamin D and Curcumin for inflammatory support."),
  k("KIT_GI_GOLD", "EXPECTED_RESPONSE", "Weeks 3-5: improved digestion and energy. Weeks 5-8: reduced inflammation. Weeks 8-12: improved hair stability and systemic balance."),
  k("KIT_GI_GOLD", "CLINICAL_NOTE", "GI GOLD eligibility must follow the locked rule set and should not be triggered by minor bloating or constipation alone."),
  k("KIT_GI_GOLD", "CONCLUSION", "Supports long-term improvement in hair, skin, hormones and overall health through the gut-brain-skin axis."),
  k("KIT_PRO_IMMUNE_GOLD", "INDICATION", "Hair fall and skin compromise associated with weakened immunity, chronic inflammation or poor recovery."),
  k("KIT_PRO_IMMUNE_GOLD", "OBJECTIVE", "Restore immune balance, reduce systemic inflammation and support healthy hair growth and skin repair."),
  k("KIT_PRO_IMMUNE_GOLD", "STRATEGY", "Immune modulation; inflammation control; oxidative-stress reduction; stress and sleep regulation; gut-skin optimisation."),
  k("KIT_PRO_IMMUNE_GOLD", "FORMULATION_RATIONALE", "Colostrum, Lactoferrin and Vitamin C; Vitamin D3 and Pine Bark; adaptogens; sleep regulators; antioxidants; gut optimisation."),
  k("KIT_PRO_IMMUNE_GOLD", "EXPECTED_RESPONSE", "Improved energy and recovery, better scalp and skin condition, and stronger hair-growth support."),
  k("KIT_PRO_IMMUNE_GOLD", "CLINICAL_NOTE", "Educational and supportive language only. Do not present this kit as replacing medical therapy."),
  k("KIT_PRO_IMMUNE_GOLD", "CONCLUSION", "Designed to rebuild internal resilience and support long-term hair and skin health."),
  k("KIT_INFLAMMATION_PHENOTYPE", "INDICATION", "Chronic low-grade inflammation contributing to persistent hair fall, weak follicles and poor cycle recovery."),
  k("KIT_INFLAMMATION_PHENOTYPE", "OBJECTIVE", "Reduce systemic inflammation, stabilise the hair cycle and protect follicles from ongoing damage."),
  k("KIT_INFLAMMATION_PHENOTYPE", "STRATEGY", "Cytokine suppression; immune modulation; androgen-sensitivity control; oxidative protection; stress regulation."),
  k("KIT_INFLAMMATION_PHENOTYPE", "FORMULATION_RATIONALE", "Curcumin, NAC, Resveratrol and Vitamin D; immune modulators; androgen-sensitivity modulators; antioxidants; stress regulators."),
  k("KIT_INFLAMMATION_PHENOTYPE", "EXPECTED_RESPONSE", "Weeks 3-5: reduced scalp irritation and variable shedding. Weeks 6-8: improved scalp stability. Weeks 8-12: better strength and recovery."),
  k("KIT_INFLAMMATION_PHENOTYPE", "CLINICAL_NOTE", "Severe inflammation may be prioritised above hormonal drivers only when the deterministic rules confirm it."),
  k("KIT_INFLAMMATION_PHENOTYPE", "CONCLUSION", "Stabilises the internal environment to support more effective and sustained recovery."),
  k("KIT_PRO_FACT_META_B", "INDICATION", "Slow or impaired metabolism contributing to hair fall, weight changes, low energy and hormonal imbalance."),
  k("KIT_PRO_FACT_META_B", "OBJECTIVE", "Restore metabolic efficiency, improve energy production and support healthy hair, weight balance and hormonal stability."),
  k("KIT_PRO_FACT_META_B", "STRATEGY", "Weight and insulin regulation; hormonal balance; cellular energy; gut and digestion; stress and neuro-regulation."),
  k("KIT_PRO_FACT_META_B", "FORMULATION_RATIONALE", "Metabolic regulators, inositol-related hormonal support, mitochondrial support, hair and skin nutrients, adaptogens and digestive support."),
  k("KIT_PRO_FACT_META_B", "EXPECTED_RESPONSE", "Weeks 3-5: improved energy. Weeks 5-8: better digestion, mood and cravings. Weeks 8-12: improved metabolic, skin and hair quality."),
  k("KIT_PRO_FACT_META_B", "CLINICAL_NOTE", "Generic Meta B resolves to the standalone PRO FACT META B base kit. Named variants such as PCOS, THYROID and MENOPAUSE remain separate governed entities and cannot be chosen by free-form RAG."),
  k("KIT_PRO_FACT_META_B", "CONCLUSION", "Supports metabolic reset and creates conditions for stronger hair growth and long-term stability."),
];

const words = (value: string) => new Set(value.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 2));

export function searchPilotKnowledge(query: string, options: { audience: "INTERNAL_PREVIEW" | "PATIENT"; kitId?: string } = { audience: "PATIENT" }) {
  // Supplied chunks are MEDICAL_REVIEW and may only be used by the explicit
  // preview path. Patient retrieval therefore fails closed.
  if (options.audience !== "INTERNAL_PREVIEW") return [];
  const queryWords = words(query);
  return PILOT_CHUNKS
    .filter((chunk) => !options.kitId || chunk.kitId === options.kitId)
    .map((chunk) => ({ ...chunk, score: [...words(chunk.content)].filter((word) => queryWords.has(word)).length }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}
