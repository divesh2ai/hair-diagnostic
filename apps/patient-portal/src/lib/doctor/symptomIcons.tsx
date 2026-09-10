// Colourful clinical symptom iconography for the doctor review.
//
// ── Why an icon SYSTEM, not one-off art ─────────────────────────────────────
// The engine emits free-text signals ("Diffuse shedding", "Chronic stress",
// "Recent illness", "Widening parting"…) drawn from a large, evolving option
// set. A hand-drawn icon per signal would break the moment a new option lands.
// Instead this resolves an icon deterministically from the signal text, with a
// per-category fallback, so every signal — known or new — gets a meaningful,
// on-brand glyph.
//
// ── Colour is the category's, not the component's ───────────────────────────
// The chip paints itself from `--cat-ink / --cat-tint / --cat-edge`, which the
// token layer resolves from the nearest `data-cat` ancestor. Colour ownership
// stays in one file (doctor-tokens.css); this module only chooses the glyph and
// the shape. That is the same discipline the rest of the review already follows.

import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Apple,
  Baby,
  Brain,
  CircleCheck,
  CircleDot,
  Cigarette,
  Clock,
  Coffee,
  Droplet,
  Droplets,
  Dumbbell,
  Flame,
  GlassWater,
  HeartPulse,
  History,
  Leaf,
  Moon,
  Pill,
  Pipette,
  Ruler,
  Salad,
  Scissors,
  Snowflake,
  Sparkles,
  Stethoscope,
  Sun,
  Syringe,
  Thermometer,
  TrendingDown,
  Waves,
  Wind,
  Wine,
} from "lucide-react";
import { Info } from "lucide-react";
import type { MergedGroupKey } from "@/lib/doctor/clinicalSignals";

// Ordered most-specific first. The first rule whose pattern hits the (lower-
// cased) signal text wins, so "recent illness" resolves to the illness glyph
// before the generic "recent"/duration rule can claim it.
const RULES: { test: RegExp; icon: LucideIcon }[] = [
  // Medical / metabolic — placed first so "post-illness shedding" is illness,
  // not shedding.
  { test: /illness|fever|infection|viral|covid|typhoid|surgery|hospital|post[- ]?illness/, icon: Thermometer },
  { test: /thyroid/, icon: Activity },
  { test: /pcos|hormon|menopaus|\bperi\b|menstru|period|pregnan|postpartum|delivery|lactat/, icon: HeartPulse },
  { test: /iron|an[ae]mia|ferritin|h[ae]moglobin|bleeding|blood/, icon: Droplets },
  { test: /diabet|sugar|insulin|metabolic|cholesterol|pcod/, icon: Activity },
  { test: /injection|steroid|biopsy/, icon: Syringe },
  { test: /medication|medicine|\bdrug|supplement|tablet|antibiotic/, icon: Pill },

  // Scalp
  { test: /dandruff|flak|flaking|dry scalp/, icon: Snowflake },
  { test: /oily|greasy|sebum|grease/, icon: Droplet },
  { test: /itch|irritat|burning/, icon: Sparkles },
  { test: /inflamm|redness|\bred\b|sore|tender/, icon: Flame },
  { test: /normal scalp|healthy scalp|no dandruff/, icon: CircleCheck },

  // Lifestyle
  { test: /stress|anxiet|tension|burnout/, icon: Brain },
  { test: /sleep|insomnia|rest\b/, icon: Moon },
  { test: /smok|tobacco|cigarette/, icon: Cigarette },
  { test: /alcohol|drink/, icon: Wine },
  { test: /caffeine|coffee|\btea\b/, icon: Coffee },
  { test: /water|hydrat/, icon: GlassWater },
  { test: /exercise|sedentary|physical|workout|gym/, icon: Dumbbell },
  { test: /sun|uv\b|heat styling|heat/, icon: Sun },
  { test: /vegetarian|vegan|pescatarian|protein|nutri|diet|eating|junk|food/, icon: Salad },
  { test: /fruit|vitamin/, icon: Apple },

  // Hair & shedding / pattern
  { test: /diffuse/, icon: Wind },
  { test: /shedding|hair ?fall|fall\b|falling|clumps|loss/, icon: TrendingDown },
  { test: /thinning|density|volume|\bthin\b/, icon: Waves },
  { test: /parting|widening|midline/, icon: Ruler },
  { test: /receding|hairline|temple|frontal/, icon: Ruler },
  { test: /crown|vertex|patch|bald|circular/, icon: CircleDot },

  // Treatments / history
  { test: /minoxidil|serum|topical|lotion|solution|\boil\b|foam/, icon: Pipette },
  { test: /previous|prior|\bpast\b|used|tried|treatment|therapy/, icon: History },

  // Genetic / family
  { test: /genetic|family|hereditary|inherited/, icon: Baby },

  // Timing (generic — last so specific timing-adjacent signals win first)
  { test: /duration|month|year|week|recent|since|chronic|ongoing/, icon: Clock },
];

const CATEGORY_FALLBACK: Record<MergedGroupKey, LucideIcon> = {
  HAIR: Scissors,
  SCALP: Droplet,
  LIFESTYLE: Leaf,
  MEDICAL: Stethoscope,
  TREATMENTS: History,
  // Interpretations the engine flagged without a matching reported selection.
  OTHER: Info,
};

/**
 * The glyph for one signal. Matches the signal text first; only when nothing
 * matches does it fall back to the category's own icon, so every row is
 * meaningful rather than defaulting to a generic dot.
 */
export function resolveSymptomIcon(
  value: string,
  category: MergedGroupKey,
): LucideIcon {
  const text = (value ?? "").toLowerCase();
  for (const rule of RULES) {
    if (rule.test.test(text)) return rule.icon;
  }
  return CATEGORY_FALLBACK[category] ?? CircleDot;
}

/**
 * A colourful icon chip. Paints from the category CSS variables resolved by the
 * nearest `data-cat` ancestor, so the same glyph reads in its clinical colour
 * without this component ever naming one.
 */
export function SymptomIcon({
  value,
  category,
  size = "md",
}: {
  value: string;
  category: MergedGroupKey;
  size?: "sm" | "md";
}) {
  const Icon = resolveSymptomIcon(value, category);
  const box = size === "sm" ? "size-7" : "size-9";
  const glyph = size === "sm" ? "size-[15px]" : "size-[18px]";
  return (
    <span
      aria-hidden
      className={`flex ${box} shrink-0 items-center justify-center rounded-xl border`}
      style={{
        background: "var(--cat-tint)",
        color: "var(--cat-ink)",
        borderColor: "var(--cat-edge)",
      }}
    >
      <Icon className={glyph} strokeWidth={2} />
    </span>
  );
}
