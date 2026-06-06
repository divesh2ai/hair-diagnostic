/**
 * VISUAL JOURNEY EXPANSION LAYER
 *
 * Augments the base visual journey with additional sections populated
 * from clinical analysis, therapy needs, and root causes.
 *
 * Sections added:
 * 1. Current Scalp State
 * 2. Root Cause Map
 * 3. Inflammatory Pathway
 * 4. Metabolic Contribution
 * 5. Hormonal Influence
 * 6. Therapy Timeline
 * 7. Expected Recovery Phases
 */

import type { ClinicalProfile } from "../ai-engine/clinical-engine/types";
import type { TherapyNeeds } from "../ai-engine/therapy-engine/types";
import type { KitRecommendation } from "../ai-engine/kit-scorer/types";
import { THERAPY_NEED_EXPANSIONS, ROOT_CAUSE_EXPLANATIONS } from "../ai-engine/explanations/expansion";
import type { VisualJourney, VisualSection } from "./types";

/**
 * Expanded visual journey with clinical narrative sections
 */
export interface ExpandedVisualJourney extends VisualJourney {
  clinicalNarrativeSections: VisualSection[];
}

/**
 * Expand base visual journey with narrative-driven sections
 */
export function expandVisualJourney(
  baseJourney: VisualJourney,
  clinical: ClinicalProfile,
  therapy: TherapyNeeds,
  recommendation: KitRecommendation
): ExpandedVisualJourney {
  const narrativeSections: VisualSection[] = [];

  // ── Section: Root Cause Map ────────────────────────────────────────────────
  if (clinical.rootCauses.length > 0) {
    const rootCauseTexts = clinical.rootCauses
      .map((cause) => {
        const explanation = ROOT_CAUSE_EXPLANATIONS[cause];
        return explanation
          ? `${explanation.title}: ${explanation.clinicalContext}`
          : cause;
      })
      .join("\n\n");

    narrativeSections.push({
      sectionTitleKey: "section.root_causes",
      sectionDescriptionKey: "section.root_causes.desc",
      defaultTitle: "Root Cause Analysis",
      defaultDescription: `Your hair loss is being driven by the following factors:\n\n${rootCauseTexts}`,
      visuals: [],
    });
  }

  // ── Section: Inflammatory Pathway ──────────────────────────────────────────
  if (
    clinical.inflammationScore > 30 ||
    clinical.rootCauses.includes("INFLAMMATION")
  ) {
    const inflammationContext = `Your scalp and systemic inflammation markers indicate an ongoing inflammatory response. This inflammation signals hair follicles to exit the growth phase prematurely, resulting in increased shedding.

Specific inflammatory drivers identified:
${clinical.inflammatorySignals.map((signal) => `• ${signal}`).join("\n")}

Anti-inflammatory therapy helps suppress these signals and stabilize hair follicles in the growth phase.`;

    narrativeSections.push({
      sectionTitleKey: "section.inflammation",
      sectionDescriptionKey: "section.inflammation.desc",
      defaultTitle: "Understanding Your Inflammation",
      defaultDescription: inflammationContext,
      visuals: [],
    });
  }

  // ── Section: Metabolic Contribution ────────────────────────────────────────
  if (
    clinical.metabolicScore > 30 ||
    clinical.rootCauses.includes("METABOLIC")
  ) {
    const metabolicContext = `Metabolic dysfunction is contributing to your hair loss by:

1. Increasing DHT production (shrinks hair follicles)
2. Reducing IGF-1 signaling (which supports follicle growth)
3. Promoting follicle miniaturization

Signs of metabolic dysfunction detected:
${clinical.metabolicSignals
  ? clinical.metabolicSignals.map((signal) => `• ${signal}`).join("\n")
  : "• Elevated glucose metabolism"}

Metabolic optimization through diet, exercise, and supplementation restores insulin sensitivity and normalizes DHT production within 4-6 weeks.`;

    narrativeSections.push({
      sectionTitleKey: "section.metabolic",
      sectionDescriptionKey: "section.metabolic.desc",
      defaultTitle: "Metabolic Optimization for Hair Growth",
      defaultDescription: metabolicContext,
      visuals: [],
    });
  }

  // ── Section: Hormonal Influence ────────────────────────────────────────────
  if (
    recommendation.rankedKits.some(
      (k) =>
        k.kitId.includes("ANDROGEN") ||
        k.kitId.includes("FINASTERIDE") ||
        k.kitId.includes("DUTASTERIDE")
    )
  ) {
    const hormonalContext = `Hair loss pattern analysis indicates androgen-driven follicle miniaturization. This occurs when genetically sensitive hair follicles are exposed to DHT (dihydrotestosterone), which shrinks them progressively.

Your therapy protocol includes androgen modulation to:
1. Reduce DHT production by 70-90% (via 5-alpha reductase inhibition)
2. Block androgen receptor signaling
3. Allow follicles to recover normal size (reversal of miniaturization)

Expected timeline:
• Weeks 1-4: DHT reduction (physiological effect)
• Months 3-4: Hair cycle stabilization
• Months 6-12: Visible thickening and recovery`;

    narrativeSections.push({
      sectionTitleKey: "section.hormonal",
      sectionDescriptionKey: "section.hormonal.desc",
      defaultTitle: "Androgen-Driven Hair Loss and Treatment",
      defaultDescription: hormonalContext,
      visuals: [],
    });
  }

  // ── Section: Therapy Timeline ──────────────────────────────────────────────
  if (recommendation.rankedKits.length > 0) {
    const timelineContext = `Your prescribed therapy follows this timeline:

Phase 1 (Weeks 1-4): Foundation
${recommendation.rankedKits
  .slice(0, 1)
  .map(
    (k) =>
      `• ${k.kitId}: Addresses immediate drivers (stabilizes follicles, reduces shedding)`
  )
  .join("\n")}

Phase 2 (Months 2-3): Optimization
${recommendation.rankedKits
  .slice(1, 2)
  .map(
    (k) =>
      `• ${k.kitId}: Enhances recovery and supports growth factors`
  )
  .join("\n") || "• Micronutrient optimization and lifestyle integration"}

Phase 3+ (Months 4+): Recovery
• Visible regrowth appears (terminal hair recovery)
• Follicle cycle normalization
• Progressive thickening

Complete therapy duration: 6-12 months for optimal results`;

    narrativeSections.push({
      sectionTitleKey: "section.timeline",
      sectionDescriptionKey: "section.timeline.desc",
      defaultTitle: "Your Treatment Timeline",
      defaultDescription: timelineContext,
      visuals: [],
    });
  }

  // ── Section: Expected Recovery Phases ───────────────────────────────────────
  const recoveryContext = `Hair regrowth follows predictable phases once underlying drivers are addressed:

Phase 1: Stabilization (Weeks 1-8)
• Shedding rate decreases
• New hair enters growth phase
• Follicles exit telogen prematurely

Phase 2: Transition (Months 2-4)
• New terminal hairs begin to appear
• Existing hairs thicken
• Scalp appearance improves

Phase 3: Recovery (Months 4-12)
• Visible regrowth becomes obvious
• Hair density increases progressively
• Strength and texture improve

Important: Hair grows ~0.5 inches per month. Terminal hairs need 3-4 months to become visible. Complete recovery typically requires 6-12 months of consistent therapy.`;

  narrativeSections.push({
    sectionTitleKey: "section.recovery",
    sectionDescriptionKey: "section.recovery.desc",
    defaultTitle: "Expected Recovery Phases",
    defaultDescription: recoveryContext,
    visuals: [],
  });

  return {
    ...baseJourney,
    clinicalNarrativeSections: narrativeSections,
  };
}

/**
 * Merge clinical narrative sections with base visual journey
 */
export function mergeVisualJourneySections(
  baseJourney: VisualJourney,
  expandedSections: VisualSection[]
): VisualJourney {
  return {
    ...baseJourney,
    sections: [...baseJourney.sections, ...expandedSections],
  };
}
