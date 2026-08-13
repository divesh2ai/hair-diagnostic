import { GeneralConversationStore } from "../src/packages/assistant-core/conversationContext";
import { runGeneralAssistant } from "../src/packages/assistant-core/generalEngine";
import { ManifestGeneralCatalogue } from "../src/packages/assistant-core/generalCatalogue";
import { InflammationPhenotypeIndexedRetriever } from "../src/packages/assistant-core/hybridRetrieval";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const questions = [
  "What is Inflammation Phenotype?",
  "Why is NAC included?",
  "What other ingredients support oxidative stress control?",
  "What pathways does this kit target?",
  "Patient smokes heavily — is that relevant to this phenotype?",
  "What clinical factors should I assess?",
  "Explain the kit in 5 bullets.",
  "Give me the complete formulation rationale.",
  "What source are you using?",
  "What is the current price?",
];

async function main() {
 const catalogue = new ManifestGeneralCatalogue();
 const knowledge = new InflammationPhenotypeIndexedRetriever();
 const store = new GeneralConversationStore();
 const conversationId = crypto.randomUUID();
 const report = [];

 for (const [index, question] of questions.entries()) {
  const context = store.get(conversationId);
  const response = await runGeneralAssistant({ query: question, context }, catalogue, knowledge);
  store.set(conversationId, {
    ...context,
    activeProductFamily: response.resolvedEntity ?? context.activeProductFamily,
    activeIngredient: response.resolvedIngredient ?? context.activeIngredient,
    activeLifestyleFactor: response.resolvedLifestyleFactor ?? context.activeLifestyleFactor,
    previousSources: response.intent === "SOURCE_INSPECTION" ? context.previousSources : response.sources,
    updatedAt: Date.now(),
  });
   report.push({
    turn: index + 1,
    question,
    detectedIntent: response.intent,
    inheritedContext: response.inheritedContext,
    resolvedEntity: response.resolvedEntity,
    ingredient: response.resolvedIngredient,
    factor: response.resolvedLifestyleFactor,
    retrievalMode: response.retrieval?.strategy ?? "NO_RETRIEVAL",
    metadataFilters: response.retrieval?.metadataFilters ?? {},
    sourcesRetrieved: response.retrieval?.sourcesRetrieved ?? response.sources.map((source) => source.sourceId),
    finalAnswer: response.answer,
    status: response.action === "ANSWER" || (response.intent === "CATALOGUE_PRICE" && response.action === "ABSTAIN") ? "PASS" : "FAIL",
   });
 }

 const result = { generatedAt: new Date().toISOString(), completionStatus: "PHENOTYPE RAG READY FOR USER TEST", conversationId, report };
 const outputDir = resolve("outputs", "phenotype-rag-validation");
 await mkdir(outputDir, { recursive: true });
 await writeFile(resolve(outputDir, "required-conversation.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
 console.log(JSON.stringify(result, null, 2));
}

void main();
