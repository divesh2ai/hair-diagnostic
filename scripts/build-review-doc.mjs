/**
 * Generates docs/localisation/assessment-<locale>-review.md from the live
 * protocol plus that locale's content pack.
 *
 * Generated rather than hand-written so the clinical team can never review
 * wording that has since drifted from what the app renders. Re-run after any
 * protocol or translation change:
 *
 *   node scripts/build-review-doc.mjs            # every translated locale
 *   node scripts/build-review-doc.mjs mr         # just one
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createRequire } from 'node:module';

import { build } from 'esbuild';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

const schema = require(
  resolve(root, 'src/packages/ai-engine/questionnaire-engine/schema/questionnaire.schema.json'),
);

// Locales that ship a content pack, and the human name used in the doc title.
// Adding a language here is the last step of adding it to the app.
const LOCALES = {
  hi: { name: 'Hindi', native: 'हिन्दी', pronoun: 'आप' },
  mr: { name: 'Marathi', native: 'मराठी', pronoun: 'तुम्ही' },
};

const requested = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const targets = requested.length ? requested : Object.keys(LOCALES);
for (const locale of targets) {
  if (!LOCALES[locale]) {
    console.error(`Unknown locale "${locale}". Known: ${Object.keys(LOCALES).join(', ')}`);
    process.exit(1);
  }
}

// Content packs are TypeScript, which node cannot import directly. Bundle each
// to an ESM string with esbuild (already a dependency) and evaluate that, so
// this script always reads the *real* pack rather than a copy that can rot.
async function loadPack(locale) {
  const bundled = await build({
    entryPoints: [
      resolve(root, `apps/patient-portal/src/lib/assessment-i18n/content/${locale}.ts`),
    ],
    bundle: true,
    format: 'esm',
    write: false,
    platform: 'node',
  });
  const mod = await import(
    'data:text/javascript;base64,' +
      Buffer.from(bundled.outputFiles[0].text, 'utf8').toString('base64')
  );
  return mod[`${locale}Content`];
}

const SECTION_TITLES_EN = {
  S1_PATIENT_IDENTITY: ['About You', 'A few quick details so we can personalise the rest of the assessment.'],
  S2_HAIR_LOSS_ASSESSMENT: ['Hair History', 'These questions help us recognise the pattern, pace and texture of what you are experiencing.'],
  S3_SCALP_CONDITION: ['Symptoms', 'The scalp environment is often the silent factor behind shedding. A few short questions ahead.'],
  S4_MEDICAL_HISTORY: ['Lifestyle', 'Sleep, stress and routines shape the growth cycle more than most people realise.'],
  S5_NUTRITION_AND_DIET: ['Nutrition, Diet & Treatments', 'Subtle nutritional gaps can mimic genetic loss. We are looking for the difference.'],
  S6_GRADE_AND_ADDITIONAL: ['The Final Picture', 'A few final questions to complete your hair profile.'],
};

/** Clinical intent per question — why the question exists, for the reviewer. */
const INTENT = {
  name: 'Patient identity for the report and doctor queue.',
  age: 'Drives age-gated option filtering (e.g. greying goal hidden at 30+) and hormonal windows.',
  goal: 'Primary treatment objective. Regrowth-only suppresses active-shedding analysis.',
  sex: 'Gates Norwood vs Ludwig grading and every female-specific hormonal option.',
  duration: 'Acute (1–3 mo) vs chronic shedding — drives TE GOLD eligibility.',
  count: 'Shedding volume band; separates normal turnover from active telogen effluvium.',
  hairtype: 'Shedding morphology — distinguishes diffuse TE from patterned loss and alopecia areata.',
  scalp: 'Scalp environment: inflammation, seborrhoea, dandruff scoring.',
  cause: 'Patient-perceived aetiology; feeds cause ranking alongside objective signals.',
  immunity: 'Autoimmune and atopic signals; alopecia areata detection.',
  lifestyle: 'Modifiable lifestyle drivers — metabolic, oxidative and circadian load.',
  thyroid: 'Thyroid and glycaemic status. Mutually exclusive hypo/hyper pairs.',
  medical: 'Chronic-condition gate for the free-text follow-up below.',
  medical_detail: 'Free-text medication and condition capture for doctor review.',
  hormonal: 'Female hormonal axis: PCOS, pregnancy, postpartum, menopause continuum.',
  gut: 'Absorption capacity — GI GOLD trigger set is a strict subset of these.',
  deficiency: 'Confirmed lab deficiencies (iron, D3, B12).',
  diet: 'Dietary pattern and protein adequacy.',
  treatment: 'Heat and chemical damage load on the shaft.',
  grade: 'Visual severity grade — Norwood (male) or Ludwig (female).',
  extra: 'Open-ended notes surfaced verbatim to the reviewing doctor.',
};

async function buildDoc(locale) {
  const meta = LOCALES[locale];
  const pack = await loadPack(locale);
  const lines = [];
  const push = (s = '') => lines.push(s);

  push(`# Dr FACT Hair Assessment — ${meta.name} Translation Review`);
  push();
  push('> **Generated file — do not edit by hand.**');
  push('> Produced by `scripts/build-review-doc.mjs` from the live protocol');
  push(`> (\`questionnaire.schema.json\`) and the ${meta.name} content pack`);
  push(`> (\`apps/patient-portal/src/lib/assessment-i18n/content/${locale}.ts\`).`);
  push('> Re-run the script after any change so this document can never describe');
  push('> wording the app no longer renders.');
  push();
  push('## How to review');
  push();
  push(`You are reviewing the **${meta.name}** column only. The **Key** and **Answer code**`);
  push('columns are internal identifiers — they are stored in the database and read');
  push('by the clinical engine, and they are deliberately identical in every');
  push(`language. Changing them would change clinical meaning; changing the ${meta.name}`);
  push('changes only what the patient reads.');
  push();
  push(`If a ${meta.name} phrase is clinically wrong or hard for a patient to follow,`);
  push('write the correction in the margin and we will apply it to the content pack.');
  push();
  push(`**Voice rules applied:** respectful second person (\`${meta.pronoun}\`);`);
  push(`patient-friendly ${meta.name} over literal translation; familiar`);
  push('Indian-English clinical terms retained where they read better; brand names');
  push('never translated (Dr. FACT, HairOS).');
  push();
  if (locale === 'mr') {
    push('> **Note for the Marathi reviewer:** this is a translation from English,');
    push('> not a transliteration of the Hindi pack. Marathi vocabulary is used');
    push('> throughout — केस not बाल, गळणे not झड़ना, डोक्याची त्वचा for scalp. Flag anything');
    push('> that reads as Hindi-influenced.');
    push();
  }

  let qCount = 0;
  let oCount = 0;

  for (const section of schema.sections) {
    const [enTitle, enBody] = SECTION_TITLES_EN[section.sectionId] ?? [section.title, section.description];
    const localisedSection = pack.sections[section.sectionId];

    push('---');
    push();
    push(`## ${section.sectionId} — ${enTitle}`);
    push();
    push('### Chapter card');
    push();
    push(`| Key | English | ${meta.name} |`);
    push('| --- | --- | --- |');
    push(`| \`${section.sectionId}.title\` | ${esc(enTitle)} | ${esc(localisedSection?.title)} |`);
    push(`| \`${section.sectionId}.body\` | ${esc(enBody)} | ${esc(localisedSection?.body)} |`);
    push();

    for (const question of section.questions) {
      qCount += 1;
      const content = pack.questions[question.id];
      push(`### \`${question.id}\` — ${question.type}${question.required ? ' · required' : ''}`);
      push();
      push(`**Clinical intent:** ${INTENT[question.id] ?? '—'}`);
      push();
      push(`| Key | English | ${meta.name} |`);
      push('| --- | --- | --- |');
      push(`| \`${question.id}.title\` | ${esc(question.label)} | ${esc(content?.title)} |`);
      if (question.subtitle) {
        push(`| \`${question.id}.subtitle\` | ${esc(question.subtitle)} | ${esc(content?.subtitle ?? '(inherits English)')} |`);
      }
      if (question.validation?.placeholder) {
        push(`| \`${question.id}.placeholder\` | ${esc(question.validation.placeholder)} | ${esc(content?.placeholder)} |`);
      }
      if (question.mutualExclusivityRules?.toastMessage) {
        push(`| \`${question.id}.exclusivityToast\` | ${esc(question.mutualExclusivityRules.toastMessage)} | ${esc(content?.exclusivityToast)} |`);
      }
      push();

      if (question.options?.length) {
        push(`| Answer code (stored, never translated) | English label | ${meta.name} label |`);
        push('| --- | --- | --- |');
        for (const option of question.options) {
          oCount += 1;
          const localisedLabel = content?.options?.[option.value];
          push(`| \`${esc(option.value)}\` | ${esc(option.label)} | ${esc(localisedLabel)} |`);
        }
        push();
      }
    }
  }

  push('---');
  push();
  push('## Coverage');
  push();
  push(`- Questions: ${qCount} / ${qCount}`);
  push(`- Answer options: ${oCount} / ${oCount}`);
  push(`- Chapter cards: ${schema.sections.length} / ${schema.sections.length}`);
  push();
  push('Enforced by `tests/localisation/assessment-locales.test.ts`, which fails');
  push(`the build if any question, option or section loses its ${meta.name} entry,`);
  push('or if the pack retains a key the protocol no longer defines.');
  push();
  push('---');
  push();
  push('## TRANSLATION_REVIEW_REQUIRED');
  push();
  push('Items where the **English source** is unclear or wrong. Per the localisation');
  push(`brief these were not silently rewritten — the ${meta.name} renders the`);
  push('clinically intended meaning, and the English needs a separate decision.');
  push();
  push('### 1. `hormonal` option `PCOS / PCOD only`');
  push();
  push('- **Original English label:** `PMOS / PCOS`');
  push('- **Problem:** `PMOS` is a typo. The stored answer code is `PCOS / PCOD only`,');
  push('  so the label and the code disagree, and `PMOS` is not a clinical entity.');
  push('- **Suggested improved English:** `PCOS / PCOD`');
  push('- **Hindi shipped:** `पीसीओएस / पीसीओडी` (renders the code\'s meaning, not the typo)');
  push('- **Action:** English label fix is a protocol edit; out of scope for a');
  push('  localisation change. Answer code must NOT change — it is in production data.');
  push();
  push('### 2. `scalp` option `Dandruff / white flakes`');
  push();
  push('- **Original English label:** `Dandruff`');
  push('- **Problem:** Label is narrower than the answer code, and sits next to');
  push('  `Dandruff + Itching + White flakes`, so "Dandruff" alone reads as the same');
  push('  thing minus symptoms. Patients cannot tell the two apart.');
  push('- **Suggested improved English:** `Dandruff / white flakes (no itching)`');
  push(`- **Shipped:** \`${pack.questions.scalp.options['Dandruff / white flakes']}\``);
  push('- **Action:** needs clinical sign-off before either language changes.');
  push();
  push('### 3. `count` / `hairtype` / `gut` option codes contain literal newlines');
  push();
  push('- **Problem:** several answer codes embed `\\n` (e.g. `~20–50 strands\\n(Normal range)`)');
  push('  because the original HTML questionnaire baked line breaks into the value.');
  push('- **Impact on localisation:** none — the Hindi pack keys match byte-for-byte and');
  push('  the test suite enforces it. Flagged so a future cleanup does not assume the');
  push('  codes are newline-free.');
  push('- **Action:** do not "tidy" these codes; they are in production data.');
  push();


  const outPath = resolve(root, `docs/localisation/assessment-${locale}-review.md`);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, lines.join('\n'), 'utf8');
  console.log(`Wrote ${outPath} — ${qCount} questions, ${oCount} options.`);
}

function esc(value) {
  if (value == null) return '**— MISSING —**';
  return String(value).replace(/\|/g, '\\|').replace(/\n/g, '␊');
}

for (const locale of targets) {
  await buildDoc(locale);
}
