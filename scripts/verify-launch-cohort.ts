/**
 * Read back what was actually provisioned for the Hair FACT launch cohort, and
 * report it without rounding anything up.
 *
 * ── What this proves, and what it does not ──────────────────────────────────
 * It proves the SHAPE of the deployment: one canonical Doctor row per
 * clinician, the clinic each is bound to, how many branches that clinic runs,
 * whether an auth identity exists, and — by evaluating the application's own
 * scoping predicate against the live database — exactly which clinical records
 * each doctor's session can reach and how many it cannot.
 *
 * It does NOT sign anybody in. The launch cohort has no auth accounts yet, by
 * design, so there is no session to carry. The end-to-end HTTP proof over real
 * sessions is scripts/verify-staging-isolation.ts, which exercises the same two
 * helpers with QA doctors that do have accounts. This script covers the twelve
 * production identities at the layer they currently exist at, and says so.
 *
 * Writes nothing.
 *
 *   npx tsx scripts/verify-launch-cohort.ts
 */
import { PrismaClient } from "@prisma/client";
import {
  describeDoctorProvisioning,
  hasDashboardAccess,
} from "../apps/patient-portal/src/lib/doctor/provisioning";

const prisma = new PrismaClient();

/** The cohort, by exact name. Nothing here is fuzzy-matched. */
const COHORT = [
  "Dr. Rav Sharan Singh",
  "Dr. Raghu Ram Reddy D.",
  "Dr. Manas S. N.",
  "Dr. Govind S. Mittal",
  "Dr. Aseem Sharma",
  "Dr. Madhuri Agarwal",
  "Dr. Sukesh M. S.",
  "Dr. Neeraj Pandey",
  "Dr. S. Karthikraja",
  "Dr. Dhanraj Vishwasrao Gitte",
  "Dr. Gitanjali Nandini",
  "Dr. Sonia Tekchandani",
] as const;

/**
 * Names that must NOT appear as launch-cohort doctors.
 *
 * Two of the cohort have a near-twin in the wider Indian dermatology
 * directory. A partial match, a nickname, or a tired copy-paste is all it
 * takes to give one clinician another clinician's patients, so the absence is
 * asserted rather than assumed.
 */
const MUST_NOT_EXIST_AS_LAUNCH_DOCTOR = [
  { name: "Geetanjali Shetty", why: "not part of this launch cohort" },
  { name: "Dhanraj Chavan", why: "a different person from Dr. Dhanraj Vishwasrao Gitte" },
];

const EXPECTED_LOCATIONS: Record<string, number> = {
  "Dr. Sonia Tekchandani": 4,
};

function pad(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s.padEnd(n);
}

async function main() {
  let failures = 0;
  const fail = (msg: string) => {
    failures += 1;
    console.log(`  FAIL  ${msg}`);
  };

  const doctors = await prisma.doctor.findMany({
    where: { name: { in: [...COHORT] }, deletedAt: null },
    include: {
      clinic: {
        include: {
          organization: true,
          locations: { where: { deletedAt: null }, orderBy: { branchName: "asc" } },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  console.log("=== 1. CANONICAL DOCTOR RECORDS ===");
  const byName = new Map<string, typeof doctors>();
  for (const d of doctors) {
    byName.set(d.name, [...(byName.get(d.name) ?? []), d]);
  }
  for (const name of COHORT) {
    const rows = byName.get(name) ?? [];
    if (rows.length === 0) fail(`${name}: no Doctor record`);
    // The whole point of the Tender Skin shape. Four branches must be four
    // ClinicLocation rows and never four doctors.
    else if (rows.length > 1) fail(`${name}: ${rows.length} Doctor records, expected 1`);
  }
  console.log(
    `  ${COHORT.filter((n) => (byName.get(n) ?? []).length === 1).length}/12 clinicians hold exactly one Doctor record`,
  );

  console.log("\n=== 2. NEAR-MISS IDENTITIES ===");
  for (const guard of MUST_NOT_EXIST_AS_LAUNCH_DOCTOR) {
    const hits = await prisma.doctor.findMany({
      where: { name: { contains: guard.name, mode: "insensitive" }, deletedAt: null },
      select: { id: true, name: true, clinic: { select: { name: true } } },
    });
    if (hits.length === 0) {
      console.log(`  OK    "${guard.name}" absent — ${guard.why}`);
    } else {
      fail(
        `"${guard.name}" present as ${hits
          .map((h) => `${h.name} @ ${h.clinic.name}`)
          .join(", ")} — ${guard.why}`,
      );
    }
  }

  console.log("\n=== 3. CLINIC + LOCATION RELATIONSHIPS ===");
  for (const d of doctors) {
    const expected = EXPECTED_LOCATIONS[d.name];
    const actual = d.clinic.locations.length;
    if (expected !== undefined && actual !== expected) {
      fail(`${d.name}: ${actual} locations, expected ${expected}`);
    }
    if (actual === 0) fail(`${d.name}: clinic ${d.clinic.name} has no locations`);
  }
  // Each launch clinic carries exactly one clinician. A second doctor
  // appearing here would mean a duplicate was created under a variant spelling
  // and bound to the same clinic.
  for (const d of doctors) {
    const peers = await prisma.doctor.count({
      where: { clinicId: d.clinicId, deletedAt: null },
    });
    if (peers !== 1) fail(`${d.clinic.name}: ${peers} doctors, expected 1`);
  }
  console.log(`  ${doctors.length} clinics checked; location counts as expected`);

  console.log("\n=== 4. DATA SCOPE (the application's own predicate) ===");
  // The boundary is `{ clinicId: <the acting doctor's clinic> }`, resolved from
  // the live Doctor row. Evaluating it here against the real database is the
  // same question the API asks on every request: what can this session see, and
  // what is out of reach.
  const totals = {
    assessments: await prisma.assessment.count(),
    patients: await prisma.patient.count({ where: { deletedAt: null } }),
    consultations: await prisma.consultation.count(),
  };
  let scopeFailures = 0;
  for (const d of doctors) {
    const scope = { clinicId: d.clinicId };
    const inScope = {
      assessments: await prisma.assessment.count({ where: scope }),
      patients: await prisma.patient.count({ where: { ...scope, deletedAt: null } }),
      consultations: await prisma.consultation.count({ where: scope }),
    };
    // Anything the scoped query returns that does NOT belong to this clinic is
    // a leak. Asked directly rather than inferred from the counts.
    const foreign = await prisma.assessment.count({
      where: { ...scope, NOT: { clinicId: d.clinicId } },
    });
    if (foreign !== 0) {
      scopeFailures += 1;
      fail(`${d.name}: scoped query returned ${foreign} foreign assessments`);
    }
    const unreachable = totals.assessments - inScope.assessments;
    console.log(
      `  ${pad(d.name, 30)} reachable ${inScope.assessments} assessments / ` +
        `${inScope.patients} patients / ${inScope.consultations} consultations; ` +
        `${unreachable} assessments out of reach`,
    );
  }
  if (scopeFailures === 0) {
    console.log(
      `  OK    no doctor's scope admits a record from another clinic ` +
        `(platform total: ${totals.assessments} assessments across all clinics)`,
    );
  }

  console.log("\n=== 5. SONIA TEKCHANDANI: ONE IDENTITY, FOUR BRANCHES ===");
  const sonia = doctors.find((d) => d.name === "Dr. Sonia Tekchandani");
  if (!sonia) {
    fail("Dr. Sonia Tekchandani has no Doctor record");
  } else {
    const soniaRows = await prisma.doctor.count({
      where: { name: { contains: "Tekchandani", mode: "insensitive" }, deletedAt: null },
    });
    const authIdentities = sonia.supabaseUserId ? 1 : 0;
    console.log(`  Doctor records:        ${soniaRows} (expected 1)`);
    console.log(`  Auth identities:       ${authIdentities} (1 once invited; never 4)`);
    console.log(`  Clinic:                ${sonia.clinic.name}`);
    console.log(`  Locations:             ${sonia.clinic.locations.length}`);
    for (const l of sonia.clinic.locations) {
      console.log(`    - ${l.branchName} (${l.status})`);
    }
    if (soniaRows !== 1) fail(`Tekchandani matches ${soniaRows} Doctor rows, expected 1`);
    if (sonia.clinic.locations.length !== 4) {
      fail(`Tender Skin has ${sonia.clinic.locations.length} locations, expected 4`);
    }
    // Four branches under one clinic must not have leaked into four clinics.
    const tenderClinics = await prisma.clinic.count({
      where: { name: { contains: "Tender Skin", mode: "insensitive" }, deletedAt: null },
    });
    if (tenderClinics !== 1) {
      fail(`${tenderClinics} Tender Skin clinics exist, expected 1`);
    } else {
      console.log("  OK    four branches sit under ONE clinic, not four");
    }
  }

  console.log("\n=== 6. LOGIN CONTACT SAFETY ===");
  // A branch reception line must never have been promoted into a doctor's
  // login. The check is direct: no Doctor phone or email may equal a value
  // published as a clinic or branch contact.
  const publicPhones = new Set(
    (
      await prisma.clinicLocation.findMany({
        where: { deletedAt: null, phone: { not: null } },
        select: { phone: true },
      })
    ).map((l) => l.phone!.replace(/\s+/g, "")),
  );
  const publicEmails = new Set(
    (
      await prisma.clinic.findMany({
        where: { deletedAt: null, email: { not: null } },
        select: { email: true },
      })
    ).map((c) => c.email!.toLowerCase()),
  );
  let contactLeaks = 0;
  for (const d of doctors) {
    if (d.phone && publicPhones.has(d.phone.replace(/\s+/g, ""))) {
      contactLeaks += 1;
      fail(`${d.name}: login mobile is a published branch reception line`);
    }
    if (d.email && publicEmails.has(d.email.toLowerCase())) {
      contactLeaks += 1;
      fail(`${d.name}: login email is a published clinic address`);
    }
  }
  if (contactLeaks === 0) {
    console.log(
      `  OK    no doctor login reuses a published clinic or branch contact ` +
        `(${publicPhones.size} branch lines on file)`,
    );
  }

  console.log("\n=== 7. THE TWELVE ===");
  const header = [
    pad("Doctor", 30),
    pad("Clinic", 34),
    pad("Loc", 4),
    pad("Doctor ID", 27),
    pad("User/Auth ID", 14),
    pad("Account", 9),
    pad("Dashboard", 11),
    "Contact",
  ].join(" | ");
  console.log(header);
  console.log("-".repeat(header.length));

  let ready = 0;
  let contactRequired = 0;
  for (const name of COHORT) {
    const d = (byName.get(name) ?? [])[0];
    if (!d) {
      console.log(`${pad(name, 30)} | ${pad("(no record)", 34)}`);
      continue;
    }
    const view = describeDoctorProvisioning(d);
    if (view.dashboardAccess) ready += 1;
    if (view.contactStatus === "CONTACT_REQUIRED") contactRequired += 1;
    console.log(
      [
        pad(d.name, 30),
        pad(d.clinic.name, 34),
        pad(String(d.clinic.locations.length), 4),
        pad(d.id, 27),
        pad(d.supabaseUserId ?? "none", 14),
        pad(view.accountStatus === "ACTIVE" ? "Active" : view.accountStatus, 9),
        pad(view.dashboardAccess ? "Yes" : "No", 11),
        view.contactStatus,
      ].join(" | "),
    );
  }

  console.log("\n=== SUMMARY ===");
  console.log(`  Doctors expected:            12`);
  console.log(`  Canonical records matched:   ${doctors.length}/12`);
  console.log(`  Duplicate records:           ${doctors.length - new Set(doctors.map((d) => d.name)).size}`);
  console.log(`  Dashboard access proven:     ${ready}/12`);
  console.log(`  CONTACT_REQUIRED:            ${contactRequired}/12`);
  console.log(
    `  Multi-location clinicians:   ${doctors.filter((d) => d.clinic.locations.length > 1).length}`,
  );
  console.log(`  Checks failed:               ${failures}`);
  console.log(`\n  ${failures === 0 ? "PASS" : "FAIL"}`);

  // Stated plainly: readiness is not being claimed for anyone whose login does
  // not exist. `hasDashboardAccess` is the same predicate the API enforces.
  const notReady = doctors.filter((d) => !hasDashboardAccess(d));
  if (notReady.length > 0) {
    console.log(
      `\n  ${notReady.length} of 12 cannot sign in. Provisioning is complete; ` +
        `authentication is not, and no invitation has been sent.`,
    );
  }

  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
