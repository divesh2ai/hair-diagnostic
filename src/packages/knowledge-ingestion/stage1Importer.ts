import { createHash } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import { PILOT_KITS, PILOT_SOURCE, normalizeLookup } from "../assistant-core/pilotData";
import { PILOT_CHUNKS } from "../assistant-core/pilotKnowledge";

export type Stage1ImportSummary = {
  ingestionRunId: string;
  skipped: boolean;
  kits: number;
  products: number;
  components: number;
  chunks: number;
};

const checksum = createHash("sha256").update(JSON.stringify(PILOT_KITS)).digest("hex");
const configVersion = "DrFACT_RAG_Stage1_Config_v0.1";
const sourceId = "SRC_CLINICAL_KIT_OVERVIEWS_V0_1";
const sectionTypes = ["INDICATION", "OBJECTIVE", "STRATEGY", "FORMULATION_RATIONALE", "EXPECTED_RESPONSE", "CLINICAL_NOTE", "CONCLUSION"] as const;

export async function importStage1Pilot(prisma: PrismaClient, input: { clinicId?: string; createdBy?: string } = {}): Promise<Stage1ImportSummary> {
  const clinicId = input.clinicId ?? null;
  const existing = await prisma.ingestionRun.findFirst({ where: { clinicId, checksum, configVersion, status: "COMPLETED" } });
  if (existing) return { ingestionRunId: existing.id, skipped: true, kits: 5, products: 23, components: 42, chunks: 35 };

  const priorRun = await prisma.ingestionRun.findFirst({ where: { clinicId, checksum, configVersion } });
  let run;
  if (priorRun) {
    run = await prisma.ingestionRun.update({ where: { id: priorRun.id }, data: { status: "RUNNING", startedAt: new Date(), errors: undefined } });
  } else {
    try {
      run = await prisma.ingestionRun.create({ data: { clinicId, checksum, configVersion, sourceFile: PILOT_SOURCE.file, status: "RUNNING", startedAt: new Date(), createdBy: input.createdBy } });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
      const raced = await prisma.ingestionRun.findFirst({ where: { clinicId, checksum, configVersion } });
      if (!raced) throw error;
      if (raced.status === "COMPLETED") return { ingestionRunId: raced.id, skipped: true, kits: 5, products: 23, components: 42, chunks: 35 };
      run = raced;
    }
  }

  try {
    const document = await prisma.knowledgeDocument.upsert({
      where: { sourceId },
      create: { sourceId, clinicId, title: "DrFACT pilot kit explanations", sourceType: "DOCX_XLSX_PACK", authorityScore: 70, status: "DRAFT" },
      update: { title: "DrFACT pilot kit explanations", authorityScore: 70, status: "DRAFT" },
    });
    const documentVersion = await prisma.knowledgeDocumentVersion.upsert({
      where: { documentId_checksum: { documentId: document.id, checksum } },
      create: { documentId: document.id, version: 1, checksum, sourceFile: PILOT_SOURCE.file, status: "MEDICAL_REVIEW" },
      update: { sourceFile: PILOT_SOURCE.file, status: "MEDICAL_REVIEW" },
    });

    for (const kitData of PILOT_KITS) {
      const kit = await prisma.kit.upsert({
        where: { canonicalId: kitData.id },
        create: { canonicalId: kitData.id, canonicalName: kitData.name, clinicId, family: kitData.name.startsWith("Meta B") ? "META_B" : null, status: "PROVISIONAL", currentVersion: 1 },
        update: { canonicalName: kitData.name, status: "PROVISIONAL", currentVersion: 1 },
      });
      for (const alias of [kitData.name, ...kitData.aliases]) {
        const normalizedAlias = normalizeLookup(alias);
        await prisma.kitAlias.upsert({
          where: { kitId_normalizedAlias: { kitId: kit.id, normalizedAlias } },
          create: { kitId: kit.id, clinicId, alias, normalizedAlias }, update: { alias },
        });
      }
      const kitVersion = await prisma.kitVersion.upsert({
        where: { kitId_version: { kitId: kit.id, version: 1 } },
        create: { kitId: kit.id, version: 1, checksum: createHash("sha256").update(JSON.stringify(kitData.components)).digest("hex"), sourceId: PILOT_SOURCE.file, status: "PROVISIONAL" },
        update: { status: "PROVISIONAL", sourceId: PILOT_SOURCE.file },
      });
      const priorPrice = await prisma.kitPrice.findFirst({ where: { kitId: kit.id, clinicId, version: 1 } });
      if (priorPrice) await prisma.kitPrice.update({ where: { id: priorPrice.id }, data: { mrp: kitData.mrp, status: "PROVISIONAL" } });
      else {
        try {
          await prisma.kitPrice.create({ data: { kitId: kit.id, clinicId, version: 1, mrp: kitData.mrp, currency: "INR", sourceFile: PILOT_SOURCE.file, sourceSheet: PILOT_SOURCE.kitSheet, status: "PROVISIONAL" } });
        } catch (error) {
          if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
          const racedPrice = await prisma.kitPrice.findFirst({ where: { kitId: kit.id, clinicId, version: 1 } });
          if (!racedPrice) throw error;
          await prisma.kitPrice.update({ where: { id: racedPrice.id }, data: { mrp: kitData.mrp, status: "PROVISIONAL" } });
        }
      }
      for (const [index, item] of kitData.components.entries()) {
        const product = await prisma.product.upsert({
          where: { canonicalId: item.productId },
          create: { canonicalId: item.productId, canonicalName: item.productName, clinicId, status: "PROVISIONAL" },
          update: { canonicalName: item.productName, status: "PROVISIONAL" },
        });
        const normalizedAlias = normalizeLookup(item.productName);
        await prisma.productAlias.upsert({
          where: { productId_normalizedAlias: { productId: product.id, normalizedAlias } },
          create: { productId: product.id, clinicId, alias: item.productName, normalizedAlias }, update: { alias: item.productName },
        });
        await prisma.kitProduct.upsert({
          where: { kitVersionId_componentOrder: { kitVersionId: kitVersion.id, componentOrder: index + 1 } },
          create: { kitId: kit.id, productId: product.id, kitVersionId: kitVersion.id, componentOrder: index + 1, sourceRow: item.sourceRow, status: "PROVISIONAL" },
          update: { productId: product.id, sourceRow: item.sourceRow, status: "PROVISIONAL" },
        });
        await prisma.kitSchedule.upsert({
          where: { kitVersionId_componentOrder: { kitVersionId: kitVersion.id, componentOrder: index + 1 } },
          create: { kitId: kit.id, productId: product.id, kitVersionId: kitVersion.id, componentOrder: index + 1, scheduleText: item.schedule, sourceRow: item.sourceRow, status: "PROVISIONAL" },
          update: { productId: product.id, scheduleText: item.schedule, sourceRow: item.sourceRow, status: "PROVISIONAL" },
        });
      }
      for (const chunk of PILOT_CHUNKS.filter((item) => item.kitId === kitData.id)) {
        await prisma.knowledgeChunk.upsert({
          where: { id: chunk.id },
          create: { id: chunk.id, documentVersionId: documentVersion.id, clinicId, entityType: "KIT", entityId: kitData.id, domain: "HAIR_NUTRACEUTICAL", knowledgeSystem: "INTEGRATIVE", audience: "PATIENT_AND_DOCTOR", language: "en", sectionType: chunk.sectionType, content: chunk.content, approvalStatus: "MEDICAL_REVIEW", authorityScore: 70, metadata: { sourceFile: PILOT_SOURCE.file, sourceSheet: "Clinical Chunks", sourceDocument: "All Kits Info(3).docx" } },
          update: { content: chunk.content, approvalStatus: "MEDICAL_REVIEW", metadata: { sourceFile: PILOT_SOURCE.file, sourceSheet: "Clinical Chunks", sourceDocument: "All Kits Info(3).docx" } },
        });
      }
    }
    const summary = { ingestionRunId: run.id, skipped: false, kits: PILOT_KITS.length, products: new Set(PILOT_KITS.flatMap((kit) => kit.components.map((item) => item.productId))).size, components: PILOT_KITS.reduce((sum, kit) => sum + kit.components.length, 0), chunks: PILOT_CHUNKS.length };
    await prisma.ingestionRun.update({ where: { id: run.id }, data: { status: "COMPLETED", completedAt: new Date(), counts: summary } });
    return summary;
  } catch (error) {
    await prisma.ingestionRun.update({ where: { id: run.id }, data: { status: "FAILED", completedAt: new Date(), errors: { message: error instanceof Error ? error.message : String(error) } } });
    throw error;
  }
}
