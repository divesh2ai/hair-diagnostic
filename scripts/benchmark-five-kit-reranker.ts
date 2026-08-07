import { readFile, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import path from "node:path";

type Chunk = { id: string; kitId: string; sectionType: string; heading: string; content: string };
type Manifest = { chunks: Chunk[] };
async function main(): Promise<void> {
const input = process.argv[2] ?? path.resolve("outputs/five-kit-real-ingestion/draft-manifest.json");
const output = process.argv[3] ?? path.resolve("docs/five-kit-reranker-benchmark.md");
const manifest = JSON.parse(await readFile(input, "utf8")) as Manifest;
const aliases: Record<string, string[]> = {
  KIT_TE_GOLD: ["telogen effluvium", "te gold", "active shedding", "hair cycle"],
  KIT_GI_HEALTH_GOLD: ["gi health", "gut health", "digestion", "gut hair"],
  KIT_PRO_IMMUNE_GOLD: ["pro immune", "immune balance", "recovery", "immunity"],
  KIT_INFLAMMATION_PHENOTYPE: ["inflammation phenotype", "micro inflammation", "cytokine", "inflamed scalp"],
  KIT_META_B: ["meta b", "metabolic", "insulin", "metabolism"],
};
const intents = [
  ["purpose", "TREATMENT_OBJECTIVE"], ["indication", "INDICATION"], ["mechanism", "INGREDIENT_MECHANISM"], ["expected response", "EXPECTED_RESPONSE"], ["clinical reasoning", "CLINICAL_NOTE"],
] as const;
const queries = Object.entries(aliases).flatMap(([kitId, terms]) => intents.map(([phrase, section], index) => ({ kitId, section, text: `${phrase} ${terms[index % terms.length]}` })));
const words = (value: string) => new Set(value.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 2));
const overlap = (query: Set<string>, chunk: Chunk) => { const hay = words(`${chunk.heading} ${chunk.content}`); return [...query].filter((word) => hay.has(word)).length / Math.max(query.size, 1); };
const evaluate = (rerank: boolean) => {
  const start = performance.now(); let relevant = 0;
  for (const query of queries) {
    const queryWords = words(query.text);
    const ranked = manifest.chunks.map((chunk) => {
      const lexical = overlap(queryWords, chunk);
      const aliasMatch = aliases[chunk.kitId]?.some((alias) => query.text.includes(alias)) ? 1 : 0;
      const sectionMatch = chunk.sectionType === query.section ? 1 : 0;
      return { chunk, score: rerank ? lexical * 0.65 + aliasMatch * 0.25 + sectionMatch * 0.10 : lexical };
    }).sort((a, b) => b.score - a.score).slice(0, 3);
    if (ranked.some((row) => row.chunk.kitId === query.kitId)) relevant += 1;
  }
  return { precisionAt3: relevant / queries.length, meanLatencyMs: (performance.now() - start) / queries.length };
};
const warm = evaluate(true); void warm;
const baseline = evaluate(false); const reranked = evaluate(true);
const improvement = reranked.precisionAt3 - baseline.precisionAt3;
const report = `# Five-kit reranker benchmark\n\nDraft offline corpus only; no draft content was exposed to retrieval. ${queries.length} labelled purpose/indication/mechanism/response/reasoning queries over ${manifest.chunks.length} chunks.\n\n| Strategy | Top-3 kit precision | Mean local latency |\n|---|---:|---:|\n| Lexical overlap baseline | ${(baseline.precisionAt3 * 100).toFixed(1)}% | ${baseline.meanLatencyMs.toFixed(3)} ms |\n| Entity + section heuristic reranker | ${(reranked.precisionAt3 * 100).toFixed(1)}% | ${reranked.meanLatencyMs.toFixed(3)} ms |\n\nMeasured precision delta: ${(improvement * 100).toFixed(1)} percentage points. ${improvement > 0 ? "Improvement measured on this offline draft benchmark only; production benefit is not claimed." : "No precision improvement was measured, so no improvement claim is made."}\n`;
await writeFile(output, report, "utf8");
console.log(JSON.stringify({ queries: queries.length, chunks: manifest.chunks.length, baseline, reranked, precisionDelta: improvement, output }, null, 2));
}
void main().catch((error) => { console.error(error); process.exitCode = 1; });
