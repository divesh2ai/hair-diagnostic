import Image from "next/image";
import type {
  GeneralLifestyleGuide,
  DietLifestyleRecommendation,
} from "../../../../../src/packages/ai-engine/report-engine/types";
import { CardShell } from "./_shell";

// Diet & lifestyle, with pictures.
//
// ── Why imagery here and nowhere else on the review ────────────────────────
// Everything else a doctor reads on this page is a clinical claim, and a
// picture beside a claim is a picture that can contradict it. Diet and
// lifestyle guidance is the one block that is advice rather than finding, so
// an illustration carries no diagnostic weight — it only tells the eye which
// of two columns is "eat more" and which is "eat less" before a single word is
// read.
//
// The art is DECORATIVE and marked aria-hidden. Every item stays in the
// text list beside it: the images illustrate the CATEGORY, never a specific
// food, so nothing here can imply a recommendation the engine did not make.
// That also means the artwork is fixed per column rather than matched to the
// contents — there are no per-food packshots in the repo, and inventing a
// mapping from a free-text string like "leafy greens" to a photograph is how a
// UI ends up asserting something clinical it was never given.
//
// Sources are the existing clinical-option and condition illustrations, so the
// art direction matches the rest of the product. They are NOT `unoptimized`:
// the lifestyle composite is a 2.4MB master rendered here at 64px, and letting
// next/image resize it is the difference between a thumbnail and a download.

const ART = {
  add: {
    src: "/report-assets/clinical-options/high_protein_diet.png",
    alt: "",
  },
  reduce: {
    src: "/report-assets/clinical-options/irregular_poor_diet.png",
    alt: "",
  },
  lifestyle: {
    src: "/report-assets/conditions/lifestyle-modifier-premium.png",
    alt: "",
  },
} as const;

export function LifestyleCard({
  general,
  conditionMapped,
}: {
  general: GeneralLifestyleGuide;
  conditionMapped: DietLifestyleRecommendation[];
}) {
  return (
    <CardShell eyebrow="Lifestyle" title="Diet & lifestyle">
      <div className="mb-5 grid gap-4 sm:grid-cols-2">
        <Column
          title="Add to diet"
          items={general.foodsToAdd}
          tone="add"
          art={ART.add}
        />
        <Column
          title="Reduce"
          items={general.foodsToAvoid}
          tone="reduce"
          art={ART.reduce}
        />
      </div>
      {general.lifestyleRecommendations.length > 0 && (
        <div className="mb-5 flex gap-3.5 rounded-xl border border-stone-200 bg-white p-3">
          <Art {...ART.lifestyle} />
          <div className="min-w-0 flex-1">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
              Lifestyle
            </p>
            <ul className="space-y-1 text-sm text-slate-700">
              {general.lifestyleRecommendations.map((l, idx) => (
                <li key={idx}>· {l}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {conditionMapped.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">
            Condition-specific
          </p>
          <ul className="space-y-2">
            {conditionMapped.map((r, idx) => (
              <li key={idx} className="text-sm">
                <p className="text-slate-800"><strong>{r.condition}</strong> · {r.recommendation}</p>
                <p className="text-xs text-stone-500">{r.expectedBenefit}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </CardShell>
  );
}

/**
 * A 64px square of the source artwork.
 *
 * `object-contain` on a fixed frame, matching the packshot contract elsewhere:
 * these masters are square-ish but not identical, and cropping food art to fill
 * a box is how a plate of greens loses its greens. Decorative, so it carries an
 * empty alt and aria-hidden rather than a description of a picture that states
 * nothing the text does not.
 */
function Art({ src, alt }: { src: string; alt: string }) {
  return (
    <div
      aria-hidden
      className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-stone-50"
    >
      <Image
        src={src}
        alt={alt}
        // No `sizes`. With width/height set, next/image emits a fixed 1x/2x
        // srcset (128px and 256px) — right for a 64px frame. Adding `sizes`
        // flips it to the responsive deviceSizes ladder, which made the src
        // resolve to w=3840: a 2.4MB master re-encoded at 3840px to fill a
        // 64px box. Measured on this page before the change.
        width={128}
        height={128}
        className="h-full w-full object-contain"
      />
    </div>
  );
}

function Column({
  title,
  items,
  tone,
  art,
}: {
  title: string;
  items: string[];
  tone: "add" | "reduce";
  art: { src: string; alt: string };
}) {
  // "add" and "reduce" are the two halves of one piece of advice, so they are
  // separated by hue rather than by weight — neither is a warning, and neither
  // outranks the other.
  const headColor = tone === "add" ? "text-teal-700" : "text-rose-700";
  return (
    <div className="flex gap-3.5 rounded-xl border border-stone-200 bg-white p-3">
      <Art {...art} />
      <div className="min-w-0 flex-1">
        <p className={`mb-2 text-xs font-semibold uppercase tracking-wide ${headColor}`}>
          {title}
        </p>
        {items.length === 0 ? (
          <p className="text-xs text-stone-500">—</p>
        ) : (
          <ul className="space-y-1 text-sm text-slate-700">
            {items.map((it, idx) => (
              <li key={idx}>· {it}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
