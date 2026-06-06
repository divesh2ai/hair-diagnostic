import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const assessmentId = "cmppd7mst0004892rfqqipxsx";
  
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
  });

  const logs = await prisma.orchestrationLog.findMany({
    where: { assessmentId },
  });

  const events = await prisma.assessmentEvent.findMany({
    where: { assessmentId },
  });

  const audits = await prisma.auditLog.findMany({
    where: { assessmentId },
  });

  console.log(`Assessment: ${assessmentId}`);
  console.log(`Status: ${assessment?.status}`);
  console.log(`Last Error: ${assessment?.lastError}`);
  console.log(`Orchestration Meta:`, JSON.stringify(assessment?.orchestrationMeta, null, 2));

  console.log("\nOrchestration Logs count:", logs.length);
  for (const log of logs) {
    console.log(JSON.stringify(log, null, 2));
  }

  console.log("\nAssessment Events count:", events.length);
  for (const event of events) {
    console.log(JSON.stringify(event, null, 2));
  }

  console.log("\nAudit Logs count:", audits.length);
  for (const audit of audits) {
    console.log(JSON.stringify(audit, null, 2));
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
