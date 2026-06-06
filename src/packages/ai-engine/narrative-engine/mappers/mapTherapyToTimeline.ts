import type { TherapyNeeds } from '../../therapy-engine/types';
import type { KitRecommendation } from '../../kit-scorer/types';
import type { ClinicalProfile } from '../../clinical-engine/types';
import type { TimelineEvent } from '../types';
import { RECOVERY_WINDOWS } from '../constants';

// ─── Timeline Mapper ──────────────────────────────────────────────────────────

export function mapTherapyToTimeline(
  therapyPlan: TherapyNeeds,
  kitRecommendation: KitRecommendation,
  profile: ClinicalProfile
): readonly TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const needs = new Set(therapyPlan.needs);
  const severity = profile.severity;
  const diagnosis = profile.primaryDiagnosis;

  // ── Phase 0: Initiation ────────────────────────────────────────────────────

  events.push({
    weekRange: 'Weeks 1–2',
    phase: 'early',
    milestone: 'Protocol Initiation',
    expectation: 'Your body begins adjusting to the therapeutic ingredients. Some initial scalp sensitivity is normal during the first week as active compounds take effect.',
    confidenceNote: 'Adjustment phase — no visible change expected yet.',
    isConditional: false,
  });

  // ── Phase 1: Shedding arrest (if active shedding) ──────────────────────────

  if (needs.has('SHEDDING_ARREST') || profile.flags.hasActiveShedding) {
    events.push({
      weekRange: 'Weeks 2–6',
      phase: 'early',
      milestone: 'Shedding Reduction',
      expectation: needs.has('SHEDDING_ARREST')
        ? 'Active shedding should begin to slow. Most patients notice a reduction in daily hair fall within 4–6 weeks of consistent use.'
        : 'Background shedding should stabilise as the protocol takes effect.',
      confidenceNote: 'Response varies; some patients see improvement earlier, others take the full 6 weeks.',
      isConditional: false,
    });
  }

  // ── Phase 1b: Scalp condition (if inflammation) ────────────────────────────

  if (needs.has('INFLAMMATION_CONTROL')) {
    events.push({
      weekRange: 'Weeks 3–8',
      phase: 'early',
      milestone: 'Scalp Environment Normalisation',
      expectation: 'Scalp inflammation, oiliness, or sensitivity should reduce progressively, creating a healthier environment for follicle recovery.',
      confidenceNote: 'Topical anti-inflammatory ingredients work cumulatively over this period.',
      isConditional: false,
    });
  }

  // ── Phase 2: Stabilisation ─────────────────────────────────────────────────

  const stabEnd = severity === 'SEVERE' ? 'Month 4' : 'Month 3';
  events.push({
    weekRange: `Month 2 – ${stabEnd}`,
    phase: 'mid',
    milestone: 'Stabilisation',
    expectation: severity === 'SEVERE'
      ? 'The primary goal is stabilisation — stopping further loss. Your protocol is building the biological foundation needed before regrowth becomes possible.'
      : 'Hair loss should be largely stable at this point. The therapeutic mechanisms are now active at the follicle level.',
    confidenceNote: 'This phase requires patience. Underlying biological changes precede visible improvement.',
    isConditional: false,
  });

  // ── Phase 3: Early regrowth signals ───────────────────────────────────────

  if (!profile.flags.isGrade45) {
    events.push({
      weekRange: 'Months 3–6',
      phase: 'mid',
      milestone: 'Early Regrowth Signals',
      expectation: 'Fine new hairs (baby hairs) may begin to appear, particularly along the hairline and parting. Hair texture and density may also improve.',
      confidenceNote: 'Regrowth at this stage is positive but subtle. Photographic tracking is recommended.',
      isConditional: true,
    });
  }

  // ── Phase 3b: Follicle stimulation (if needed) ────────────────────────────

  if (needs.has('FOLLICLE_STIMULATION')) {
    events.push({
      weekRange: 'Months 4–8',
      phase: 'mid',
      milestone: 'Follicle Reactivation',
      expectation: 'Dormant follicles are being coaxed back into the active growth phase. Increased hair density and improved scalp coverage should become more noticeable.',
      confidenceNote: 'Consistent daily application is critical during this window — skipping doses significantly delays response.',
      isConditional: false,
    });
  }

  // ── Phase 4: Measurable improvement ──────────────────────────────────────

  events.push({
    weekRange: `Months 6–${severity === 'SEVERE' ? '12' : '9'}`,
    phase: 'late',
    milestone: 'Measurable Improvement',
    expectation: 'Most patients with good adherence see meaningful improvement in hair density, coverage, and overall appearance by this stage. Progress photos at your clinic visit will document change objectively.',
    confidenceNote: `${RECOVERY_WINDOWS[diagnosis]}`,
    isConditional: false,
  });

  // ── Phase 5: Maintenance ──────────────────────────────────────────────────

  const isChronicCondition = [
    'AGA_MALE_123', 'AGA_MALE_45', 'AGA_FEMALE_123', 'AGA_FEMALE_45',
    'MENOPAUSE', 'POST_MENOPAUSE'
  ].includes(diagnosis);

  events.push({
    weekRange: isChronicCondition ? 'Month 12+ (ongoing)' : 'Month 9–12',
    phase: 'maintenance',
    milestone: isChronicCondition ? 'Long-Term Maintenance' : 'Consolidation & Prevention',
    expectation: isChronicCondition
      ? 'Your condition requires ongoing management to sustain results. Reducing or stopping treatment will gradually reverse progress. Your protocol will be optimised at your follow-up visit.'
      : 'Once your hair loss trigger is resolved, maintenance doses and protective care will prevent recurrence and consolidate your regrowth.',
    confidenceNote: 'Adherence at this phase determines long-term durability of results.',
    isConditional: false,
  });

  return events;
}

// ─── Clinical Timeline (Doctor Version) ──────────────────────────────────────

export function mapTherapyToClinicianTimeline(
  therapyPlan: TherapyNeeds,
  profile: ClinicalProfile
): readonly TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const needs = new Set(therapyPlan.needs);

  events.push({
    weekRange: 'Weeks 0–4',
    phase: 'early',
    milestone: 'Induction Phase',
    expectation: 'Therapeutic saturation of active compounds. Sebaceous regulation begins. No visible endpoint expected.',
    confidenceNote: 'Baseline photography recommended at initiation.',
    isConditional: false,
  });

  if (needs.has('SHEDDING_ARREST')) {
    events.push({
      weekRange: 'Weeks 4–8',
      phase: 'early',
      milestone: 'Telogen Effluvium Resolution / Shedding Arrest',
      expectation: 'Daily hair count should decline from peak. Miniaturised fibre density begins to respond to DHT blockade or follicle stimulation.',
      confidenceNote: 'Initial TE shedding spike may occur with minoxidil initiation — counsel patient.',
      isConditional: true,
    });
  }

  events.push({
    weekRange: 'Months 2–4',
    phase: 'mid',
    milestone: 'Stabilisation',
    expectation: 'Progressive reduction in telogen count. Anagen re-entry signals visible microscopically. Clinician assessment of scalp condition recommended.',
    confidenceNote: 'Trichoscopy may reveal early perifollicular improvement.',
    isConditional: false,
  });

  events.push({
    weekRange: 'Months 4–9',
    phase: 'late',
    milestone: 'Regrowth Phase',
    expectation: 'Vellus-to-terminal conversion in responsive follicles. Photographic and trichoscopic documentation recommended at month 6.',
    confidenceNote: `Clinical response correlates with ${profile.severity.toLowerCase()} severity baseline.`,
    isConditional: false,
  });

  events.push({
    weekRange: 'Months 9–12',
    phase: 'maintenance',
    milestone: 'Review & Protocol Optimisation',
    expectation: 'Evaluate response. Adjust protocol based on patient adherence, side-effect profile, and measured outcomes.',
    confidenceNote: 'Consider escalation if response is sub-optimal at 12 months.',
    isConditional: false,
  });

  return events;
}
