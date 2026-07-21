/**
 * Build Assessment V3 chapter-transition artwork derivatives.
 *
 * Drop a master image per chapter into:
 *   public/design-preview/assessment-v3/chapters/_masters/
 *     {slug}-desktop.(png|jpg|jpeg|webp)   ≥ 2880×1800, subject on the RIGHT
 *     {slug}-mobile.(png|jpg|jpeg|webp)     ≥ 1170×2532, subject LOWER / centre
 *
 * Then run:  node scripts/build-chapter-assets.mjs
 *
 * It emits the exact 8-file set the component expects, matching the Nutrition
 * benchmark's dimensions, formats and naming — desktop 1440×900 (@2x 2880×1800)
 * and mobile 585×1266 (@2x 1170×2532), each as avif + webp. Chapters without a
 * master are skipped. Nutrition is only rebuilt if you supply a nutrition master
 * (otherwise the approved committed assets are left untouched).
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const CHAPTERS_DIR = path.resolve('public/design-preview/assessment-v3/chapters');
const MASTERS_DIR = path.join(CHAPTERS_DIR, '_masters');

// slug → chapter (documentation only; the script processes whatever masters exist)
const SLUGS = ['identity', 'hair-history', 'symptoms', 'lifestyle', 'nutrition', 'completion'];

const VARIANTS = {
  desktop: { w: 1440, h: 900 },
  'desktop@2x': { w: 2880, h: 1800 },
  mobile: { w: 585, h: 1266 },
  'mobile@2x': { w: 1170, h: 2532 },
};

const EXTS = ['png', 'jpg', 'jpeg', 'webp'];

function findMaster(slug, kind) {
  for (const ext of EXTS) {
    const p = path.join(MASTERS_DIR, `${slug}-${kind}.${ext}`);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

async function emit(master, slug, variantKey) {
  const { w, h } = VARIANTS[variantKey];
  const base = sharp(master).resize(w, h, { fit: 'cover', position: 'attention' });
  const webpOut = path.join(CHAPTERS_DIR, `${slug}-${variantKey}.webp`);
  const avifOut = path.join(CHAPTERS_DIR, `${slug}-${variantKey}.avif`);
  await base.clone().webp({ quality: 82 }).toFile(webpOut);
  await base.clone().avif({ quality: 55 }).toFile(avifOut);
  return [webpOut, avifOut];
}

if (!fs.existsSync(MASTERS_DIR)) {
  console.error(`No masters dir. Create ${MASTERS_DIR} and drop {slug}-desktop.* / {slug}-mobile.* masters.`);
  process.exit(1);
}

let built = 0;
for (const slug of SLUGS) {
  const desktopMaster = findMaster(slug, 'desktop');
  const mobileMaster = findMaster(slug, 'mobile');
  if (!desktopMaster && !mobileMaster) continue;
  if (!desktopMaster || !mobileMaster) {
    console.warn(`! ${slug}: needs BOTH desktop and mobile masters (skipping).`);
    continue;
  }
  const out = [];
  out.push(...(await emit(desktopMaster, slug, 'desktop')));
  out.push(...(await emit(desktopMaster, slug, 'desktop@2x')));
  out.push(...(await emit(mobileMaster, slug, 'mobile')));
  out.push(...(await emit(mobileMaster, slug, 'mobile@2x')));
  built += 1;
  console.log(`✓ ${slug}: ${out.length} files`);
}

console.log(built ? `\nDone — ${built} chapter(s) built.` : '\nNo masters found — nothing to build.');
