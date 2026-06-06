// ─────────────────────────────────────────────────────────────────────────────
// Compose Therapy Explanation
//
// Maps the recommended kit IDs to therapy templates, then assembles a
// structured therapy explanation covering mechanism, expected outcomes,
// usage instructions, and cautions.
//
// Kit-to-template mapping is heuristic: kit IDs containing known keywords
// are routed to the appropriate TherapyTemplate. Unknown kits are omitted
// gracefully — no errors thrown.
// ─────────────────────────────────────────────────────────────────────────────

import type { ExplanationContext }              from '../types';
import type { TherapyTemplate }                 from '../templates/types';
import type { ComposeOptions, ComposedNarrative, ComposedSegment } from './types';
import { TARGET_CONSTRAINTS }                   from './types';
import { MINOXIDIL_THERAPY_TEMPLATE }           from '../templates/therapies/minoxidil';
import { PEPTIDES_THERAPY_TEMPLATE }            from '../templates/therapies/peptides';
import { ANTI_INFLAMMATORY_THERAPY_TEMPLATE }   from '../templates/therapies/antiInflammatory';
import { METABOLIC_THERAPY_TEMPLATE }           from '../templates/therapies/metabolic';
import {
  buildPatientSeed,
  resolveConditions,
  assembleSection,
  ensureTermination,
  cap,
}                                               from '../templates/_fragmentUtils';
import { buildComposedNarrative, makeSegment }  from './_composeUtils';

// ─── Kit → therapy template routing ──────────────────────────────────────────

/**
 * Maps a kit ID to a TherapyTemplate using keyword matching.
 * Returns undefined if no template applies (kit has no therapy narrative).
 */
function kitToTemplate(kitId: string): TherapyTemplate | undefined {
  const id = kitId.toUpperCase();
  if (id.includes('MINOX') || id.includes('MPHL') || id.includes('FPHL')) {
    return MINOXIDIL_THERAPY_TEMPLATE;
  }
  if (id.includes('PEPTIDE') || id.includes('HAIR FACT') || id.includes('PRO IMMUNE') || id.includes('REGROW')) {
    return PEPTIDES_THERAPY_TEMPLATE;
  }
  if (id.includes('INFLAM') || id.includes('PHENOTYPE') || id.includes('SCALP')) {
    return ANTI_INFLAMMATORY_THERAPY_TEMPLATE;
  }
  if (id.includes('META') || id.includes('PCOS') || id.includes('F-PCOS') || id.includes('LACTI')) {
    return METABOLIC_THERAPY_TEMPLATE;
  }
  return undefined;
}

// ─── De-duplicate templates by key ───────────────────────────────────────────

function dedupeTemplates(templates: TherapyTemplate[]): TherapyTemplate[] {
  const seen = new Set<string>();
  return templates.filter((t) => {
    if (seen.has(t.therapyKey)) return false;
    seen.add(t.therapyKey);
    return true;
  });
}

// ─── Main composer ────────────────────────────────────────────────────────────

/**
 * Produces a therapy explanation narrative from the kit recommendation.
 *
 * For each unique therapy template (deduplicated), sections are:
 * mechanism → expected outcomes → usage → caution.
 * Multiple therapies are separated with a labelled header.
 */
export function composeTherapyExplanation(
  context: ExplanationContext,
  options: ComposeOptions = {}
): ComposedNarrative {
  const { clinicalProfile, kitRecommendation } = context;
  const target      = options.target  ?? 'patient-report';
  const constraints = TARGET_CONSTRAINTS[target];
  const length      = options.length  ?? constraints.defaultLength;
  const locale      = options.locale  ?? 'en';

  const seed       = buildPatientSeed(clinicalProfile);
  const conditions = resolveConditions(clinicalProfile);

  const kitIds: string[] = kitRecommendation.rankedKits.map((k) => k.kitId);
  const rawTemplates = kitIds.map(kitToTemplate).filter((t): t is TherapyTemplate => t !== undefined);
  const templates = dedupeTemplates(rawTemplates);

  const segments: ComposedSegment[] = [];

  for (const template of templates) {
    const sectionDefs = [
      { label: 'How It Works',      fragments: template.mechanism },
      { label: 'What To Expect',    fragments: template.expectedOutcomes },
      { label: 'How To Use It',     fragments: template.usage },
      { label: 'Important Caution', fragments: template.caution },
    ];

    for (const { label, fragments } of sectionDefs) {
      const assembled = assembleSection(
        `${template.therapyKey}_${label}`,
        fragments,
        conditions,
        seed,
        length
      );
      const seg = makeSegment(label, ensureTermination(cap(assembled.text)));
      if (seg) segments.push(seg);
    }
  }

  return buildComposedNarrative(segments, length, target, locale, constraints);
}
