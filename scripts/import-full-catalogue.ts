import { PrismaClient } from "@prisma/client";
import { importFullCatalogue } from "../src/packages/knowledge-ingestion/fullCatalogueImporter";

async function main() {
  const prisma = new PrismaClient();
  try {
    const result = await importFullCatalogue(prisma, process.env.ASSISTANT_IMPORT_CREATED_BY);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});