// Emits `-lite` variants next to each heavy PNG so originals stay intact.
// Run from patient-portal so sharp resolves via its node_modules.
import sharp from "sharp";
import { promises as fs } from "node:fs";
import path from "node:path";

const PUBLIC = path.resolve("public");
const targets = [
  // [src relative to public, maxWidth, quality]
  ["report-assets/snapshot/healthy-hair-goal.png", 600, 80],
  ["report-assets/snapshot/duration-months.png", 600, 80],
  ["report-assets/patient/female-fallback-premium.png", 500, 82],
  ["report-assets/patient/male-fallback-premium.png", 500, 82],
  ["report-assets/patient/neutral-fallback-premium.png", 500, 82],
  ["report-assets/conditions/immune-ai.png", 600, 80],
  ["report-assets/conditions/fallback-neutral-ai.png", 600, 80],
  ["report-assets/conditions/condition-sheet-ai.png", 600, 80],
  ["report-assets/conditions/immune-general-sheet-ai.png", 600, 80],
  ["report-assets/recovery/day-0-30-ai.png", 500, 80],
  ["report-assets/recovery/day-30-60-ai.png", 500, 80],
  ["report-assets/recovery/day-60-120-ai.png", 500, 80],
  ["report-assets/recovery/beyond-120-ai.png", 500, 80],
];

const results = [];
for (const [rel, maxW, q] of targets) {
  const src = path.join(PUBLIC, rel);
  const out = src.replace(/\.png$/i, "-lite.png");
  try {
    const before = (await fs.stat(src)).size;
    await sharp(src)
      .resize({ width: maxW, withoutEnlargement: true })
      .png({ quality: q, compressionLevel: 9, palette: true })
      .toFile(out);
    const after = (await fs.stat(out)).size;
    results.push({ src: rel, beforeKB: (before / 1024) | 0, afterKB: (after / 1024) | 0, saved: `${(100 - (after / before) * 100).toFixed(0)}%` });
  } catch (err) {
    results.push({ src: rel, error: String(err.message ?? err) });
  }
}
console.log(JSON.stringify(results, null, 2));
