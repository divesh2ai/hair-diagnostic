import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const tables = await prisma.$queryRaw<{ table_name: string }[]>`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN ('Consultation', 'ConsultationVersion', 'ConsultationEvent')
    ORDER BY table_name
  `;
  console.log("=== Tables ===");
  tables.forEach((t) => console.log("  ✓", t.table_name));

  const enums = await prisma.$queryRaw<{ typname: string }[]>`
    SELECT typname FROM pg_type
    WHERE typtype = 'e'
    AND typname IN ('ConsultationStatus', 'ConsultationEventType', 'ConsultationEventStatus', 'ConsultationApprovalStatus')
    ORDER BY typname
  `;
  console.log("\n=== Enums ===");
  enums.forEach((e) => console.log("  ✓", e.typname));

  const indexes = await prisma.$queryRaw<{ indexname: string }[]>`
    SELECT indexname FROM pg_indexes
    WHERE schemaname = 'public'
    AND tablename IN ('Consultation', 'ConsultationVersion', 'ConsultationEvent')
    ORDER BY indexname
  `;
  console.log("\n=== Indexes ===");
  indexes.forEach((i) => console.log("  ✓", i.indexname));

  const fks = await prisma.$queryRaw<{ constraint_name: string }[]>`
    SELECT constraint_name FROM information_schema.table_constraints
    WHERE constraint_type = 'FOREIGN KEY'
    AND table_schema = 'public'
    AND table_name IN ('Consultation', 'ConsultationVersion', 'ConsultationEvent')
    ORDER BY constraint_name
  `;
  console.log("\n=== Foreign Keys ===");
  fks.forEach((f) => console.log("  ✓", f.constraint_name));

  const migRows = await prisma.$queryRaw<
    { migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }[]
  >`
    SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations
    WHERE migration_name IN ('20260626_platform_foundation','20260626_phase3_admin','20260629_consultation_aggregate')
    ORDER BY migration_name
  `;
  console.log("\n=== Migration Records ===");
  migRows.forEach((m) =>
    console.log(
      `  ${m.rolled_back_at ? "✗" : "✓"} ${m.migration_name} — finished: ${m.finished_at?.toISOString() ?? "NULL"}, rolled_back: ${m.rolled_back_at?.toISOString() ?? "NULL"}`,
    ),
  );

  // Sanity check counts
  if (tables.length !== 3) throw new Error(`Expected 3 tables, got ${tables.length}`);
  if (enums.length !== 4) throw new Error(`Expected 4 enums, got ${enums.length}`);
  if (indexes.length < 8)
    throw new Error(`Expected >= 8 indexes, got ${indexes.length}`);
  if (fks.length < 4) throw new Error(`Expected >= 4 FK constraints, got ${fks.length}`);

  console.log("\n✅ Remote DB verification passed.");
}

main()
  .catch((e) => {
    console.error("✗ Verification failed:", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
