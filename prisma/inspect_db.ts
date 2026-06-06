import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL,
    },
  },
})

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('  HairOS Supabase — Live Database Inspection')
  console.log('═══════════════════════════════════════════════════════════\n')

  // ── 1. Table inventory ──────────────────────────────────────────────────
  const tables = await prisma.$queryRaw<
    { table_name: string; row_count: bigint }[]
  >`
    SELECT
      t.table_name,
      COALESCE(s.n_live_tup, 0) AS row_count
    FROM information_schema.tables t
    LEFT JOIN pg_stat_user_tables s ON s.relname = t.table_name
    WHERE t.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
    ORDER BY t.table_name;
  `

  console.log('── TABLES ──────────────────────────────────────────────────')
  const maxLen = Math.max(...tables.map(t => t.table_name.length))
  for (const t of tables) {
    const rows = Number(t.row_count)
    const indicator = rows > 0 ? '✓' : '○'
    console.log(
      `  ${indicator}  ${t.table_name.padEnd(maxLen + 2)} ${rows} row${rows !== 1 ? 's' : ''}`
    )
  }

  // ── 2. Missing expected tables ───────────────────────────────────────────
  const expected = [
    'Organization', 'OrganizationMember',
    'Clinic', 'Doctor', 'Patient', 'PatientIdentifier',
    'Assessment', 'AssessmentResponse',
    'AIArtifact', 'OrchestrationLog',
    'AnalyticsEvent', 'WhatsappDelivery', 'AuditLog',
    'User', 'Session', 'WhatsappSession', 'Message', 'Diagnosis', 'Recommendation',
    '_prisma_migrations',
  ]
  const actual = tables.map(t => t.table_name)
  const missing = expected.filter(e => !actual.includes(e))
  if (missing.length > 0) {
    console.log('\n── MISSING TABLES ──────────────────────────────────────────')
    missing.forEach(m => console.log(`  ✗  ${m}`))
  } else {
    console.log('\n  ✅  All expected tables are present.')
  }

  // ── 3. Seed data check ──────────────────────────────────────────────────
  console.log('\n── SEED DATA ───────────────────────────────────────────────')
  try {
    const orgs = await prisma.organization.findMany({ select: { id: true, name: true, slug: true } })
    if (orgs.length > 0) {
      orgs.forEach(o => console.log(`  ✓  Organization: ${o.name}  (${o.id})`))
    } else {
      console.log('  ✗  No Organizations found')
    }

    const clinics = await prisma.clinic.findMany({
      select: { id: true, name: true, slug: true, organizationId: true },
    })
    if (clinics.length > 0) {
      clinics.forEach(c =>
        console.log(`  ✓  Clinic: ${c.name}  (${c.id})  org→${c.organizationId ?? 'none'}`)
      )
    } else {
      console.log('  ✗  No Clinics found')
    }

    const doctors = await prisma.doctor.findMany({
      select: { id: true, name: true, email: true, clinicId: true, supabaseUserId: true },
    })
    if (doctors.length > 0) {
      doctors.forEach(d =>
        console.log(
          `  ✓  Doctor: ${d.name}  (${d.id})\n       email: ${d.email}  supabaseId: ${d.supabaseUserId ?? '⚠ not set'}`
        )
      )
    } else {
      console.log('  ○  No Doctors seeded yet')
      console.log('     → Create a user in Supabase Auth, then:')
      console.log('       SEED_DOCTOR_SUPABASE_ID="<uuid>" npm run db:seed')
    }

    const patientCount = await prisma.patient.count()
    const assessmentCount = await prisma.assessment.count()
    console.log(`  ○  Patients:    ${patientCount}`)
    console.log(`  ○  Assessments: ${assessmentCount}`)
  } catch (e: any) {
    console.log(`  ✗  Seed data query failed: ${e.message}`)
  }

  // ── 4. Remaining auth cross-schema FKs ──────────────────────────────────
  console.log('\n── CROSS-SCHEMA FK CHECK (public → auth) ───────────────────')
  const authFks = await prisma.$queryRaw<{ table_name: string; constraint_name: string }[]>`
    SELECT
      tc.table_name,
      tc.constraint_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.referential_constraints AS rc
      ON tc.constraint_name = rc.constraint_name AND tc.table_schema = rc.constraint_schema
    JOIN information_schema.table_constraints AS tc2
      ON rc.unique_constraint_name = tc2.constraint_name AND rc.unique_constraint_schema = tc2.table_schema
    WHERE tc.table_schema = 'public'
      AND tc2.table_schema = 'auth';
  `
  if (authFks.length === 0) {
    console.log('  ✅  No cross-schema auth FK constraints — clean.')
  } else {
    authFks.forEach(fk =>
      console.log(`  ⚠  ${fk.table_name}.${fk.constraint_name} → auth schema`)
    )
  }

  // ── 5. Index inventory on core tables ───────────────────────────────────
  console.log('\n── INDEXES (core tables) ───────────────────────────────────')
  const indexes = await prisma.$queryRaw<{ table_name: string; index_name: string; index_def: string }[]>`
    SELECT
      t.relname AS table_name,
      i.relname AS index_name,
      pg_get_indexdef(ix.indexrelid) AS index_def
    FROM pg_class t
    JOIN pg_index ix ON t.oid = ix.indrelid
    JOIN pg_class i ON i.oid = ix.indexrelid
    WHERE t.relkind = 'r'
      AND t.relname IN (
        'Assessment', 'Patient', 'Doctor', 'Clinic',
        'Organization', 'AIArtifact', 'OrchestrationLog'
      )
    ORDER BY t.relname, i.relname;
  `
  const byTable: Record<string, string[]> = {}
  for (const idx of indexes) {
    if (!byTable[idx.table_name]) byTable[idx.table_name] = []
    byTable[idx.table_name].push(idx.index_name)
  }
  for (const [tbl, idxList] of Object.entries(byTable)) {
    console.log(`  ${tbl}`)
    idxList.forEach(ix => console.log(`    · ${ix}`))
  }

  console.log('\n═══════════════════════════════════════════════════════════\n')
}

main()
  .catch(e => { console.error('\n✗ Inspection failed:', e.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
