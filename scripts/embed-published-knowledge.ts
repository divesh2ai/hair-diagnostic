import { PrismaClient } from "@prisma/client";
import { OpenAIEmbeddingProvider } from "../src/packages/assistant-core/hybridRetrieval";
import { embedPublishedPatientKnowledge } from "../src/packages/knowledge-ingestion/knowledgeEmbeddingJob";

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is required");
  const prisma = new PrismaClient();
  try {
    const result = await embedPublishedPatientKnowledge(prisma, new OpenAIEmbeddingProvider(apiKey));
    console.log(JSON.stringify(result, null, 2));
  } finally { await prisma.$disconnect(); }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });