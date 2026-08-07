import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import questionnaireSchema from "../../../src/packages/ai-engine/questionnaire-engine/schema/questionnaire.schema.json";
import {
  CLINICAL_OPTION_ASSETS,
  clinicalOptionCodeForLabel,
  resolveClinicalOptionAsset,
} from "../src/lib/reports/one-page/clinicalOptionAssets";

const appRoot = path.basename(process.cwd()) === "patient-portal"
  ? process.cwd()
  : path.resolve(process.cwd(), "apps/patient-portal");
const publicRoot = path.join(appRoot, "public");
const outputPath = path.join(appRoot, "outputs/one-page-report/clinical-icon-validation.json");

function optionLabels(value: unknown): string[] {
  const labels: string[] = [];
  const visit = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== "object") return;
    const candidate = node as { id?: unknown; options?: unknown };
    if (typeof candidate.id === "string" && Array.isArray(candidate.options)) {
      for (const option of candidate.options as Array<{ label?: unknown }>) {
        if (typeof option.label === "string") labels.push(option.label.trim());
      }
    }
    Object.values(node as Record<string, unknown>).forEach(visit);
  };
  visit(value);
  return [...new Set(labels)];
}

function publicFile(assetPath: string): string {
  return path.join(publicRoot, assetPath.replace(/^\//, "").replaceAll("/", path.sep));
}

async function main() {
const labels = optionLabels(questionnaireSchema);
const resolutions = labels.map((label) => resolveClinicalOptionAsset({ optionCode: clinicalOptionCodeForLabel(label), label }));
const exactEntries = Object.values(CLINICAL_OPTION_ASSETS).filter((entry) => entry.status === "exact");
const replacementEntries = Object.values(CLINICAL_OPTION_ASSETS).filter((entry) => entry.status === "needs_replacement");
const duplicatePaths = Object.entries(
  Object.values(CLINICAL_OPTION_ASSETS).reduce<Record<string, string[]>>((all, entry) => {
    (all[entry.assetPath] ??= []).push(entry.optionCode);
    return all;
  }, {}),
).filter(([, codes]) => codes.length > 1);

const invalidPaths: string[] = [];
for (const entry of Object.values(CLINICAL_OPTION_ASSETS)) {
  for (const assetPath of [entry.assetPath, entry.domainFallbackPath]) {
    try { await access(publicFile(assetPath)); } catch { invalidPaths.push(assetPath); }
  }
}
for (const resolved of resolutions) {
  try { await access(publicFile(resolved.asset.src)); } catch { invalidPaths.push(resolved.asset.src); }
}

const hashes = new Map<string, string[]>();
for (const entry of exactEntries) {
  const hash = createHash("sha256").update(await readFile(publicFile(entry.assetPath))).digest("hex");
  (hashes.get(hash) ?? hashes.set(hash, []).get(hash)!).push(entry.optionCode);
}
const suspiciouslyIdenticalAssets = [...hashes.values()].filter((codes) => codes.length > 1);
const verySmallSourceCrops = Object.values(CLINICAL_OPTION_ASSETS)
  .filter((entry) => entry.sourceCrop && Math.min(entry.sourceCrop.width, entry.sourceCrop.height) < 96)
  .map((entry) => entry.optionCode);

const unrelatedDomainMappings = resolutions.flatMap((resolved) => {
  if (resolved.status === "exact") return [];
  const text = resolved.label.toLowerCase();
  const src = resolved.asset.src.toLowerCase();
  const expected =
    /norwood|ludwig|pattern/.test(text) ? null :
    /iron|vitamin|diet|vegan|vegetarian|nutrition|gut|digest/.test(text) ? "nutritional" :
    /thyroid|pcos|hormone|pregnan|menopause|hysterectomy/.test(text) ? "hormonal" :
    /dandruff|scalp|itch|oily|dry|burning|pimple/.test(text) ? "scalp" :
    /diabet|obes|weight|sedentary/.test(text) ? "metabolic" : null;
  if (!expected) return [];
  return src.includes(expected) ? [] : [{ optionCode: resolved.optionCode, label: resolved.label, expected, assetPath: resolved.asset.src }];
});

const neutralPath = "/report-assets/clinical-options/neutral_clinical_context.svg";
const report = {
  generatedAt: new Date().toISOString(),
  questionnaireOptionCount: labels.length,
  exactCropCount: exactEntries.length,
  questionnaireExactResolutionCount: resolutions.filter((item) => item.status === "exact").length,
  fallbackCount: resolutions.filter((item) => item.status === "fallback").length,
  replacementNeeded: replacementEntries.map((entry) => ({ optionCode: entry.optionCode, label: entry.label, reason: "Source illustration is semantically ambiguous" })),
  missingOptions: resolutions.filter((item) => item.asset.src === neutralPath).map((item) => ({ optionCode: item.optionCode, label: item.label })),
  duplicateCrops: duplicatePaths,
  suspiciouslyIdenticalAssets,
  invalidPaths: [...new Set(invalidPaths)],
  verySmallSourceCrops,
  unrelatedDomainMappings,
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify(report, null, 2), "utf8");
console.log(JSON.stringify({ outputPath, ...report }, null, 2));

if (report.duplicateCrops.length || report.suspiciouslyIdenticalAssets.length || report.invalidPaths.length || report.verySmallSourceCrops.length || report.unrelatedDomainMappings.length) {
  process.exitCode = 1;
}
}

void main();
