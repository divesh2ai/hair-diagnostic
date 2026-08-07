#!/usr/bin/env node

import { mkdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const repoRoot = path.resolve(import.meta.dirname, "../../..");
const manifestPath = path.resolve(repoRoot, "docs/clinical-option-crop-manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const outputDir = path.resolve(repoRoot, manifest.output.directory);
const background = manifest.output.background;

await mkdir(outputDir, { recursive: true });

const results = [];
for (const item of manifest.crops) {
  const source = manifest.sourceSheets[item.sourceSheet];
  if (!source) throw new Error(`Unknown source sheet: ${item.sourceSheet}`);
  await stat(source.path);

  const { x: left, y: top, width, height } = item.crop;
  const outputPath = path.join(outputDir, item.targetFilename);
  console.log(`[clinical-options] extracting ${item.optionCode}`);
  const cropped = await sharp(source.path)
    .extract({ left, top, width, height })
    .toBuffer();
  await sharp(cropped)
    .trim({ background: "#ffffff", threshold: 10 })
    .resize({
      width: 384,
      height: 384,
      fit: "contain",
      background,
      kernel: sharp.kernel.lanczos3,
    })
    .extend({ top: 64, bottom: 64, left: 64, right: 64, background })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(outputPath);

  const metadata = await sharp(outputPath).metadata();
  results.push({
    optionCode: item.optionCode,
    outputPath: path.relative(repoRoot, outputPath).replaceAll("\\", "/"),
    width: metadata.width,
    height: metadata.height,
  });
}

console.log(JSON.stringify({ extracted: results.length, results }, null, 2));
