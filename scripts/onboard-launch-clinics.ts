/**
 * Onboard the confirmed Hair FACT launch doctors, clinics and branches.
 *
 * ── What this creates ───────────────────────────────────────────────────────
 *   12 Doctor rows        one identity each, including exactly ONE for
 *                         Dr. Sonia Tekchandani
 *   12 Clinic rows        including ONE Tender Skin International
 *   15 ClinicLocation     11 single-branch clinics + Tender Skin's four
 *
 * The shape for Tender Skin uses the schema exactly as it already stands —
 * Clinic ──< Doctor[] and Clinic ──< ClinicLocation[] — so one doctor holds one
 * clinic which holds four branches. No parallel model, no duplicated doctor,
 * and authentication stays on the Doctor (email is the OTP identity), never per
 * branch. Nothing hangs off ClinicLocation but its Clinic foreign key, so
 * retiring one branch cannot touch the doctor, her login, assessments,
 * consultations, patients, orders, audit history or the other three branches.
 *
 * ── Every coordinate is left UNSET, deliberately ────────────────────────────
 * This script never writes a latitude or a longitude. There is no geocoding
 * provider in this repository, and a coordinate is a claim about where a real
 * medical practice stands — deriving one from a city, an area or a PIN code
 * would put a clinic on the national map at a place nobody verified. Each
 * branch is pinned afterwards by a human in the map picker at
 * /admin/clinics/<id>/edit, which records geoStatus = PINNED because a person
 * confirmed it. That is the whole provenance contract, and this script stays on
 * the honest side of it.
 *
 * ── Login contacts are not in this file ─────────────────────────────────────
 * Doctor.email IS the OTP login identity, so an address written here would be
 * a credential written into source. Confirmed PERSONAL contacts are read from
 * a separate JSON file that is not committed:
 *
 *   scripts/launch-doctors.contacts.json
 *   { "Dr. Rav Sharan Singh": { "email": "...", "phone": "+9198..." }, ... }
 *
 * That file is OPTIONAL, and so is any doctor within it. A clinician nobody
 * has reached yet is provisioned in full — profile, clinic, branches — with
 * email and phone left NULL and provisioningStatus = CONTACT_REQUIRED. No
 * placeholder address is ever invented, and no publicly listed clinic
 * reception line is ever promoted to a personal login: the branch numbers in
 * the dataset below are written to ClinicLocation.phone and nowhere else.
 *
 * This script sends nothing. Provisioning and inviting are separate acts.
 *
 * ── Usage ───────────────────────────────────────────────────────────────────
 *   npx tsx scripts/onboard-launch-clinics.ts             # dry run, the default
 *   npx tsx scripts/onboard-launch-clinics.ts --apply     # write
 *   npx tsx scripts/onboard-launch-clinics.ts --verify    # read back and report
 *
 * Idempotent. Clinics match on slug, doctors on (clinic, exact name) with a
 * confirmed email as a fallback, branches on (clinicId, branchName), so a
 * second run converges instead of duplicating. It never clears a coordinate a
 * human has pinned, never blanks a login already in use, never demotes a live
 * account, and refuses outright to move an existing doctor between clinics.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient, type Prisma, type DoctorProvisioningStatus } from "@prisma/client";
import { createLocationSchema } from "../apps/patient-portal/src/lib/clinic/location";

const prisma = new PrismaClient();

type Branch = {
  branchName: string;
  addressLine1: string;
  city: string;
  state: string;
  pincode?: string;
  phone?: string;
  /** Branch-level note carried into the report, not into the database. */
  caution?: string;
};

type LaunchClinic = {
  doctor: string;
  clinicName: string;
  slug: string;
  branches: Branch[];
};

/**
 * The launch dataset, exactly as supplied.
 *
 * No address is normalised, expanded or "corrected" here. Where a source gave
 * no PIN code none is invented — Andheri West and Vanasthalipuram genuinely
 * arrived without one, and a fabricated PIN is a wrong fact that looks like a
 * complete record.
 */
const LAUNCH: LaunchClinic[] = [
  {
    doctor: "Dr. Rav Sharan Singh",
    clinicName: "GH Derma Center",
    slug: "gh-derma-center",
    branches: [
      {
        branchName: "Tripuri Town",
        addressLine1: "39-43 Shopping Complex, Tripuri Town",
        city: "Patiala",
        state: "Punjab",
        pincode: "147001",
      },
    ],
  },
  {
    doctor: "Dr. Raghu Ram Reddy D.",
    clinicName: "Radiance Skin Hair Cosmetic Center",
    slug: "radiance-skin-hair-cosmetic-center",
    branches: [
      {
        branchName: "Vanasthalipuram",
        addressLine1: "5-5-303/P25/A, Prashant Nagar, Vanasthalipuram",
        city: "Hyderabad",
        state: "Telangana",
        // No PIN code in the source. Left absent rather than guessed.
      },
    ],
  },
  {
    doctor: "Dr. Manas S. N.",
    clinicName: "Reniu Clinic",
    slug: "reniu-clinic",
    branches: [
      {
        branchName: "Vani Vilas Mohalla",
        addressLine1: "2714/D1, Kalidasa Road, 8th Cross Road, Vani Vilas Mohalla",
        city: "Mysuru",
        state: "Karnataka",
        pincode: "570002",
      },
    ],
  },
  {
    doctor: "Dr. Govind S. Mittal",
    clinicName: "Therapeia Skin Hair & ENT Centre",
    slug: "therapeia-skin-hair-ent-centre",
    branches: [
      {
        branchName: "Basavanagudi",
        addressLine1:
          "12 & 13, South End Road, near Surana College, Gupta Layout, Basavanagudi",
        city: "Bengaluru",
        state: "Karnataka",
        pincode: "560004",
      },
    ],
  },
  {
    doctor: "Dr. Aseem Sharma",
    clinicName: "Skin Saga Centre for Dermatology",
    slug: "skin-saga-centre-for-dermatology",
    branches: [
      {
        branchName: "Andheri West",
        addressLine1:
          "104, Sai Iconic, opposite Kokilaben Hospital, Four Bungalows, Andheri West",
        city: "Mumbai",
        state: "Maharashtra",
        pincode: "400053",
      },
    ],
  },
  {
    doctor: "Dr. Madhuri Agarwal",
    clinicName: "Yavana Skin & Hair Clinic",
    slug: "yavana-skin-hair-clinic",
    branches: [
      {
        branchName: "Khar West",
        addressLine1: "356, Ram Janaki, Linking Road, Khar West",
        city: "Mumbai",
        state: "Maharashtra",
        pincode: "400052",
      },
    ],
  },
  {
    doctor: "Dr. Sukesh M. S.",
    clinicName: "SKYE - Skin & Hair Sciences Clinics",
    slug: "skye-skin-hair-sciences-clinics",
    branches: [
      {
        branchName: "HSR Layout",
        addressLine1: "1st Floor, 116, 13th Main Road, Sector 5 / HSR Layout",
        city: "Bengaluru",
        state: "Karnataka",
        pincode: "560102",
      },
    ],
  },
  {
    doctor: "Dr. Neeraj Pandey",
    clinicName: "Derma Klinic",
    slug: "derma-klinic",
    branches: [
      {
        branchName: "Hazratganj",
        addressLine1:
          "Creation Square, 29/29 KA 3A, Rana Pratap Marg, opposite National PG College, Hazratganj",
        city: "Lucknow",
        state: "Uttar Pradesh",
        pincode: "226001",
      },
    ],
  },
  {
    doctor: "Dr. S. Karthikraja",
    clinicName: "Aesthetiq Clinic",
    slug: "aesthetiq-clinic",
    branches: [
      {
        branchName: "Sholinganallur",
        addressLine1: "No. 16, MGR Road, near OMR Road, Sholinganallur",
        city: "Chennai",
        state: "Tamil Nadu",
        pincode: "600119",
      },
    ],
  },
  {
    // Dr. Dhanraj GITTE. There is a separate, unrelated Dr. Dhanraj Chavan;
    // the two must never be conflated. The clinic slug carries the surname so
    // a future match cannot drift onto the wrong person.
    doctor: "Dr. Dhanraj Vishwasrao Gitte",
    clinicName: "Dr. Gitte's Dermaworld Clinic",
    slug: "dr-gitte-dermaworld-clinic",
    branches: [
      {
        branchName: "Jalna Road",
        addressLine1:
          "Office 207, 2nd Floor, Freedom Tower, beside Asian Hospital, Jawahar Colony / Jalna Road area",
        city: "Chhatrapati Sambhajinagar",
        state: "Maharashtra",
        pincode: "431001",
      },
    ],
  },
  {
    // Dr. Gitanjali NANDINI — not Dr. Geetanjali Shetty, who is not part of
    // this launch set and must not be substituted by a fuzzy name match.
    doctor: "Dr. Gitanjali Nandini",
    clinicName: "Skin Nirvana Cosmetic Clinic",
    slug: "skin-nirvana-cosmetic-clinic",
    branches: [
      {
        branchName: "Santacruz West",
        addressLine1:
          "202, Suryodaya Building, Above SBI Bank, Next to P H Medical, Juhu Road, Santacruz West",
        city: "Mumbai",
        state: "Maharashtra",
        pincode: "400054",
      },
    ],
  },
  {
    // One doctor, one clinic, four branches.
    doctor: "Dr. Sonia Tekchandani",
    clinicName: "Tender Skin International",
    slug: "tender-skin-international",
    branches: [
      {
        branchName: "Malad West",
        addressLine1:
          "Shop No. 425, Lobby 3, Auris Galleria, New Link Road, opposite Landmark Restaurant, Malad West",
        city: "Mumbai",
        state: "Maharashtra",
        pincode: "400064",
        phone: "97680 44525",
        caution:
          "Older public listings show a different Malad address near Linkway Estate / Inorbit Mall. Confirm the active branch on the ground before pinning.",
      },
      {
        branchName: "Khar Road West",
        addressLine1:
          "201, Second Floor, Cupid Apartments, Linking Road, opposite Raymond Store, Khar West",
        city: "Mumbai",
        state: "Maharashtra",
        pincode: "400052",
        phone: "70390 44525",
      },
      {
        branchName: "Andheri West",
        addressLine1: "102, Shanti Tower, 1, Jankidevi School Road, SV Patel Nagar, Andheri West",
        city: "Mumbai",
        state: "Maharashtra",
        // Source gives no PIN code for this branch. Not invented.
        phone: "98209 44525",
      },
      {
        branchName: "Goregaon East",
        addressLine1:
          "1st Floor, DGS Sheetal Ekta, 106, opposite Oberoi Mall, near Carnival Cinemas, Goregaon East",
        city: "Mumbai",
        state: "Maharashtra",
        pincode: "400097",
        phone: "93723 44525",
        caution:
          "Some official descriptions use Shivdham Complex / BMC Colony / Dindoshi wording. Resolve the actual current branch before pinning.",
      },
    ],
  },
];

/**
 * Batch label written to every row this script touches, so a Doctor row can be
 * traced back to the dataset above and the run that created it.
 */
const PROVISIONING_SOURCE = "launch-cohort-2026-09";

const CONTACTS_FILE = join(__dirname, "launch-doctors.contacts.json");

type Contact = { email?: string; phone?: string };

/**
 * Confirmed PERSONAL login contacts, keyed by the doctor name exactly as it
 * appears in LAUNCH above.
 *
 *   scripts/launch-doctors.contacts.json   (never committed)
 *   { "Dr. Aseem Sharma": { "email": "...", "phone": "+9198...." }, ... }
 *
 * ── Absent is a valid answer ────────────────────────────────────────────────
 * The file is optional, and so is any doctor within it. A clinician with no
 * entry is provisioned with a real profile, a real clinic and real branches,
 * and NO login identity — provisioningStatus stays CONTACT_REQUIRED and
 * Doctor.email stays null. That is the honest record of what we know.
 *
 * The alternative — a placeholder address — is not a smaller version of the
 * same thing. Doctor.email IS the OTP identity, so a fabricated one is a
 * fabricated credential sitting in the credential field, and every screen that
 * reads it will report a clinician who is ready to sign in.
 *
 * ── What must never go in this file ─────────────────────────────────────────
 * A clinic's public reception number or its listed enquiry address. Those
 * belong to the premises, are answered by whoever is on the desk, and are
 * already recorded where they belong (ClinicLocation.phone, Clinic.email).
 * Copying one here would hand a stranger clinic-wide access to patient
 * records. The addresses in this file are the ones the clinician personally
 * confirmed, and nothing else.
 */
function loadContacts(): Map<string, Contact> {
  const map = new Map<string, Contact>();
  let raw: string;
  try {
    raw = readFileSync(CONTACTS_FILE, "utf8");
  } catch {
    console.log(
      `No ${CONTACTS_FILE} — every doctor will be provisioned CONTACT_REQUIRED.`,
    );
    return map;
  }

  const parsed = JSON.parse(raw) as Record<string, Contact | string>;
  const known = new Set(LAUNCH.map((c) => c.doctor));
  for (const [name, value] of Object.entries(parsed)) {
    if (!known.has(name)) {
      throw new Error(
        `${CONTACTS_FILE} names "${name}", who is not in the launch cohort. ` +
          `A near-miss on a name is how one clinician's login lands on another ` +
          `clinician's record, so this is fatal rather than skipped.`,
      );
    }
    // A bare string is read as an email, which is the common shape.
    const contact: Contact =
      typeof value === "string" ? { email: value } : { ...value };
    const email = contact.email?.trim().toLowerCase();
    const phone = contact.phone?.trim();
    if (!email && !phone) continue;
    map.set(name, { email: email || undefined, phone: phone || undefined });
  }

  // A shared address silently merges two clinicians into one login.
  const seenEmail = new Map<string, string>();
  const seenPhone = new Map<string, string>();
  for (const [doctor, c] of map) {
    if (c.email) {
      const owner = seenEmail.get(c.email);
      if (owner) throw new Error(`${doctor} and ${owner} share the email ${c.email}`);
      seenEmail.set(c.email, doctor);
    }
    if (c.phone) {
      const owner = seenPhone.get(c.phone);
      if (owner) throw new Error(`${doctor} and ${owner} share the mobile ${c.phone}`);
      seenPhone.set(c.phone, doctor);
    }
  }
  return map;
}

/**
 * Validate a branch through the SAME schema the admin API uses.
 *
 * A script that writes rows the product's own endpoint would reject is how two
 * sources of truth start. If this throws, the data is wrong, not the schema.
 */
function validateBranch(b: Branch, isPrimary: boolean) {
  const parsed = createLocationSchema.safeParse({
    branchName: b.branchName,
    addressLine1: b.addressLine1,
    city: b.city,
    state: b.state,
    pincode: b.pincode,
    phone: b.phone,
    country: "IN",
    isPrimary,
    status: "ONBOARDING",
    // Never a coordinate. See the header.
    latitude: null,
    longitude: null,
  });
  if (!parsed.success) {
    throw new Error(
      `${b.branchName}: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
    );
  }
  return parsed.data;
}

/**
 * Find the Doctor row this launch entry refers to, or null.
 *
 * ── Why the clinic is the key, not the name ─────────────────────────────────
 * Email used to be the key and can no longer be: it is null for every
 * un-contacted clinician, and NULL = NULL is never true. Name alone is worse —
 * this cohort contains Dr. Dhanraj Vishwasrao GITTE while an unrelated
 * Dr. Dhanraj CHAVAN exists in the wider directory, and Dr. Gitanjali NANDINI
 * while Dr. Geetanjali SHETTY does not belong to this launch at all. A fuzzy
 * or partial name match is precisely how one of those becomes the other.
 *
 * So the lookup is anchored on the clinic, which has a unique slug carrying
 * the surname, and the name must then match EXACTLY. Each launch clinic has
 * exactly one clinician, so this cannot be ambiguous.
 */
async function findExistingDoctor(
  tx: Prisma.TransactionClient,
  clinicId: string,
  name: string,
  email?: string,
) {
  const byClinic = await tx.doctor.findFirst({
    where: { clinicId, name, deletedAt: null },
  });
  if (byClinic) return byClinic;
  if (!email) return null;
  // A confirmed address already on file identifies the person even if the row
  // predates this cohort under a differently-spelled name.
  return tx.doctor.findFirst({ where: { email, deletedAt: null } });
}

async function main() {
  const apply = process.argv.includes("--apply");
  const verifyOnly = process.argv.includes("--verify");

  const expectedLocations = LAUNCH.reduce((n, c) => n + c.branches.length, 0);
  console.log(
    `Launch set: ${LAUNCH.length} doctors, ${LAUNCH.length} clinics, ${expectedLocations} locations`,
  );

  if (!verifyOnly) {
    // Validate everything before writing anything.
    for (const c of LAUNCH) {
      // A single-branch clinic's only branch is its primary. Tender Skin's four
      // are all non-primary until someone decides which one is.
      for (const b of c.branches) validateBranch(b, c.branches.length === 1);
    }
    console.log(
      `All ${expectedLocations} branch payloads pass the admin API's own schema.`,
    );

    const contacts = loadContacts();

    if (!apply) {
      console.log("\nDRY RUN — nothing written. Re-run with --apply.\n");
      for (const c of LAUNCH) {
        const contact = contacts.get(c.doctor);
        const state = contact ? "READY_TO_INVITE" : "CONTACT_REQUIRED";
        console.log(`  ${c.doctor}  [${state}]`);
        console.log(
          `    login: ${contact?.email ?? "(none)"}  mobile: ${contact?.phone ?? "(none)"}`,
        );
        console.log(`    ${c.clinicName} (${c.slug})`);
        for (const b of c.branches) {
          console.log(
            `      · ${b.branchName} — ${b.city}, ${b.state}${b.pincode ? " " + b.pincode : " (no PIN in source)"} — coordinates UNSET`,
          );
          if (b.caution) console.log(`        ! ${b.caution}`);
        }
      }
    } else {
      for (const c of LAUNCH) {
        await prisma.$transaction(async (tx) => {
          const clinic = await tx.clinic.upsert({
            where: { slug: c.slug },
            update: { name: c.clinicName },
            create: {
              name: c.clinicName,
              slug: c.slug,
              region: `${c.branches[0]!.city}, IN`,
            },
          });

          const contact = contacts.get(c.doctor);
          const existing = await findExistingDoctor(
            tx,
            clinic.id,
            c.doctor,
            contact?.email,
          );

          if (existing && existing.clinicId !== clinic.id) {
            // Reassigning a doctor between clinics moves every patient,
            // assessment and order they can reach. That is a clinical decision
            // and never a side effect of an onboarding re-run.
            throw new Error(
              `${c.doctor} already exists as ${existing.id} in clinic ${existing.clinicId}, ` +
                `not ${clinic.id}. Refusing to move an existing doctor between clinics.`,
            );
          }

          // Only ever ADD a confirmed contact. A row that already carries an
          // address keeps it: the file is a source of new confirmations, not
          // an authority that can blank a login somebody is already using.
          const contactData = {
            ...(contact?.email ? { email: contact.email } : {}),
            ...(contact?.phone ? { phone: contact.phone } : {}),
          };

          // A doctor who can already sign in stays ACTIVE — re-running this
          // script must never demote a live login to CONTACT_REQUIRED.
          const nextStatus = (
            existing?.supabaseUserId
              ? "ACTIVE"
              : existing?.email || existing?.phone || contact
                ? "READY_TO_INVITE"
                : "CONTACT_REQUIRED"
          ) as DoctorProvisioningStatus;

          if (existing) {
            await tx.doctor.update({
              where: { id: existing.id },
              data: {
                name: c.doctor,
                ...contactData,
                provisioningStatus: nextStatus,
                provisioningSource: existing.provisioningSource ?? PROVISIONING_SOURCE,
                provisionedAt: existing.provisionedAt ?? new Date(),
              },
            });
          } else {
            await tx.doctor.create({
              data: {
                name: c.doctor,
                clinicId: clinic.id,
                // Null unless a confirmed personal address exists. See
                // loadContacts for why a placeholder is not an option.
                email: contact?.email ?? null,
                phone: contact?.phone ?? null,
                provisioningStatus: nextStatus,
                provisioningSource: PROVISIONING_SOURCE,
                provisionedAt: new Date(),
              },
            });
          }

          for (const b of c.branches) {
            const existingBranch = await tx.clinicLocation.findFirst({
              where: { clinicId: clinic.id, branchName: b.branchName, deletedAt: null },
            });
            const data = {
              addressLine1: b.addressLine1,
              city: b.city,
              state: b.state,
              pincode: b.pincode ?? null,
              // Branch reception line. Never copied onto the Doctor row.
              phone: b.phone ?? null,
              country: "IN",
              // Exactly one primary for a single-branch clinic. Tender Skin's
              // four are all left non-primary: the partial unique index permits
              // zero, and picking one arbitrarily would invent a business fact.
              isPrimary: c.branches.length === 1,
            };
            if (existingBranch) {
              // Never clears a coordinate a human has since pinned.
              await tx.clinicLocation.update({ where: { id: existingBranch.id }, data });
            } else {
              await tx.clinicLocation.create({
                data: { ...data, clinicId: clinic.id, branchName: b.branchName },
              });
            }
          }
        });
        console.log(`  ✓ ${c.clinicName}`);
      }
    }
  }

  // Read back from the database and report what is actually stored.
  console.log(
    "\nDoctor | Clinic | Branch | City | State | Lat | Lng | GeoStatus | Mappable",
  );
  let mappable = 0;
  let rows = 0;
  for (const c of LAUNCH) {
    const clinic = await prisma.clinic.findUnique({
      where: { slug: c.slug },
      include: {
        doctors: { where: { deletedAt: null } },
        locations: { where: { deletedAt: null }, orderBy: { branchName: "asc" } },
      },
    });
    if (!clinic) {
      console.log(`  (absent) ${c.clinicName}`);
      continue;
    }
    for (const l of clinic.locations) {
      rows += 1;
      const ok = l.latitude != null && l.longitude != null && l.status !== "CLOSED";
      if (ok) mappable += 1;
      console.log(
        `  ${clinic.doctors.map((d) => d.name).join("/") || "(no doctor)"} | ${clinic.name} | ${l.branchName} | ${l.city} | ${l.state} | ${l.latitude ?? "null"} | ${l.longitude ?? "null"} | ${l.geoStatus} | ${ok ? "YES" : "NO"}`,
      );
    }
  }
  console.log(
    `\nRows: ${rows}/${expectedLocations}   Map-eligible: ${mappable}/${expectedLocations}`,
  );

  const sonia = await prisma.doctor.findMany({
    where: { name: { contains: "Tekchandani", mode: "insensitive" }, deletedAt: null },
    include: { clinic: { include: { locations: { where: { deletedAt: null } } } } },
  });
  console.log(
    `Sonia Tekchandani doctor rows: ${sonia.length} (expected 1); Tender Skin locations linked: ${sonia[0]?.clinic.locations.length ?? 0} (expected 4)`,
  );
  console.log(
    "\nFull provisioning + authorization report: npx tsx scripts/verify-launch-cohort.ts",
  );
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
