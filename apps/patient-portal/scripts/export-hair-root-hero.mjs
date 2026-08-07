import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import sharp from 'sharp';

const sourceArg = process.argv[2];

if (!sourceArg) {
  console.error('Usage: npm run assets:hair-root -- <path-to-source-artwork>');
  process.exit(1);
}

const sourcePath = path.resolve(sourceArg);
const outputDir = path.resolve('public/images');
const sourceMetadata = await sharp(sourcePath).metadata();
const sourceWidth = sourceMetadata.autoOrient?.width ?? sourceMetadata.width;
const sourceHeight = sourceMetadata.autoOrient?.height ?? sourceMetadata.height;

if (!sourceWidth || !sourceHeight) {
  throw new Error(`Could not read source dimensions: ${sourcePath}`);
}

const widths = {
  oneX: Math.min(1700, sourceWidth),
  twoX: Math.min(3000, sourceWidth),
};

await mkdir(outputDir, { recursive: true });

const outputs = [
  { file: 'hair-root-hero.webp', width: widths.oneX, format: 'webp' },
  { file: 'hair-root-hero@2x.webp', width: widths.twoX, format: 'webp' },
  { file: 'hair-root-hero.avif', width: widths.oneX, format: 'avif' },
  { file: 'hair-root-hero@2x.avif', width: widths.twoX, format: 'avif' },
];

for (const output of outputs) {
  const pipeline = sharp(sourcePath)
    .rotate()
    .resize({
      width: output.width,
      fit: 'inside',
      withoutEnlargement: true,
    });

  if (output.format === 'webp') {
    pipeline.webp({ quality: 88, alphaQuality: 100, effort: 6, smartSubsample: true });
  } else {
    pipeline.avif({ quality: 74, effort: 6, chromaSubsampling: '4:4:4' });
  }

  const outputPath = path.join(outputDir, output.file);
  await pipeline.toFile(outputPath);
  const metadata = await sharp(outputPath).metadata();
  console.log(`${output.file}: ${metadata.width}x${metadata.height}, alpha=${metadata.hasAlpha}`);
}

console.log(`Source unchanged: ${sourcePath} (${sourceWidth}x${sourceHeight})`);
