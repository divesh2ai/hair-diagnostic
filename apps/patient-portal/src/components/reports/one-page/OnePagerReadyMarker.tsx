"use client";

import { useEffect } from "react";

/**
 * Tells the renderer that the sheet is finished.
 *
 * ── Why the page decides, and not the renderer ──────────────────────────────
 * A renderer can only guess at readiness: a fixed sleep is too short on a cold
 * instance and wasted on a warm one, and — worse — it fails silently in the
 * one case that matters, capturing a half-drawn sheet that screenshots
 * perfectly well and is wrong. Only the page knows when it has finished
 * drawing, so the page is what says so.
 *
 * ── What "finished" means here ──────────────────────────────────────────────
 * The render target is server-rendered from an immutable snapshot: there is no
 * client fetch, no skeleton and no loading state, so the DOM is complete on
 * first paint. What is NOT complete on first paint is:
 *
 *   • webfonts, which swap in later and reflow every line they touch,
 *   • images, which reserve space before they have pixels.
 *
 * Both are awaited, then one animation frame, so a layout invalidated by the
 * last font swap has been flushed before the capture.
 *
 * The attribute goes on <html> rather than on the report element so the
 * renderer can wait for it without racing the report's own mount.
 */
export function OnePagerReadyMarker({ attribute }: { attribute: string }) {
  useEffect(() => {
    let cancelled = false;

    async function settle() {
      try {
        await document.fonts?.ready;
        await Promise.all(
          Array.from(document.images).map((img) => {
            if (img.complete && img.naturalWidth > 0) return Promise.resolve();
            return img.decode?.().catch(() => undefined) ?? Promise.resolve();
          }),
        );
      } catch {
        // A font or image that will not settle must not hold the sheet
        // hostage: the renderer's own timeout is the backstop, and a report
        // missing one illustration is better than no report at all.
      }
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      if (!cancelled) {
        document.documentElement.setAttribute(attribute, "true");
      }
    }

    void settle();
    return () => {
      cancelled = true;
    };
  }, [attribute]);

  return null;
}
