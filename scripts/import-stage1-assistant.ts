import { PrismaClient } from "@prisma/client";
import { importStage1Pilot } from "../src/packages/knowledge-ingestion/stage1Importer";

const prisma = new PrismaClient();
importStage1Pilot(prisma, { createdBy: process.env.STAGE1_IMPORT_USER ?? "stage1-import" })
  .then((result) => console.log(JSON.stringify(result, null, 2)))
  .finally(() => prisma.$disconnect());
