"use client";

import Image from "next/image";
import { Package, Droplet } from "lucide-react";
import {
  resolveProductImage,
  type ProductCategory,
} from "@/lib/kits/kitImage";

// A normalized frame for product artwork.
//
// ── Why a frame and not an <img> ────────────────────────────────────────────
// The packshots are photographed at different sizes and aspect ratios: the
// kit cartons run roughly 500×667 portrait, the topical bottles are taller and
// narrower, and a handful of files are square. Dropped into a layout at their
// natural size, one product visually dominates the one beside it purely
// because of how it was shot — which reads as an emphasis the clinical record
// never made.
//
// So every image renders inside a fixed box at a fixed aspect ratio with
// `object-contain`. Nothing is cropped (a cropped carton loses the product
// name printed on it), nothing is stretched, and two rows of the same list are
// always the same height.
//
// ── The fallback is a label, never a stand-in ───────────────────────────────
// An unresolved product shows a neutral frame with a category glyph. It does
// NOT show another product's artwork and does not show a generic "kit" photo:
// a wrong packshot beside an authorised prescription is a clinical error, and
// an empty frame is merely a missing photograph.

const SIZES = {
  // List row — the kit lineup editor, where the packshot rides the row height.
  // Any larger and five kits stop fitting on one screen, which is the whole
  // point of that list.
  xs: { box: "h-11 w-11", px: 44 },
  // Row thumbnail — protocol lists, queue rows.
  sm: { box: "h-24 w-24", px: 96 },
  // Card image — the recommended-solution card.
  md: { box: "h-32 w-32", px: 128 },
  // Hero — single-kit emphasis.
  lg: { box: "h-44 w-44", px: 176 },
} as const;

export type ProductImageSize = keyof typeof SIZES;

export interface ProductImageProps {
  /** Kit id or topical product name, exactly as the record stores it. */
  id: string | null | undefined;
  /**
   * Which registry to ask. Passed by the caller from the record's own shape —
   * `treatmentPlan.kitPhases` are kits, `treatmentPlan.topicals` are topicals.
   * Never inferred from the name.
   */
  category: ProductCategory;
  size?: ProductImageSize;
  className?: string;
}

export function ProductImage({
  id,
  category,
  size = "sm",
  className,
}: ProductImageProps) {
  const resolved = resolveProductImage(id, category);
  const { box, px } = SIZES[size];
  // Topicals sit slightly smaller inside the same outer box: a bottle
  // photographed full-height would otherwise read as larger than the carton
  // beside it, and the carton is the more significant of the two.
  // The inset scales with the frame: `p-3` inside a 44px box would leave the
  // carton about 20px wide. Small frames get a hairline, large ones breathe.
  const tight = size === "xs";
  const inset = tight
    ? "p-1"
    : category === "topical"
      ? "p-4"
      : "p-3";

  const shell =
    `relative ${box} shrink-0 overflow-hidden rounded-xl border border-stone-200 ` +
    `bg-white ${className ?? ""}`;

  if (!resolved) {
    const Glyph = category === "kit" ? Package : Droplet;
    return (
      <div
        className={`${shell} flex items-center justify-center bg-stone-50`}
        // Decorative: the product name is always rendered beside this frame,
        // so an empty box adds nothing for a screen reader.
        aria-hidden
      >
        <Glyph className="h-5 w-5 text-stone-300" />
      </div>
    );
  }

  return (
    <div className={`${shell} ${inset}`}>
      <Image
        src={resolved.src}
        alt={resolved.alt}
        width={px}
        height={px}
        // `object-contain` is the whole contract: preserve the product's own
        // proportions, fit it to the frame, crop nothing.
        className="h-full w-full object-contain"
        // The packshots are local static files served from /public. The
        // optimizer adds a round trip per image on a page that renders several
        // of them, for artwork already sized for this use.
        unoptimized
      />
    </div>
  );
}
