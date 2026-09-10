/**
 * Provision the Supabase Storage buckets the application requires.
 *
 * Replaces `scripts/create_bucket.ts`, which created `clinical-reports` with
 * `public: true` — that would have made every patient's clinical PDF readable
 * by anyone who guessed or was forwarded the URL. Every bucket here is
 * PRIVATE. Client read access is granted per-object with short-lived signed
 * URLs, which the reading code already does (`createSignedUrl`).
 *
 * Idempotent: existing buckets are UPDATED to the declared configuration
 * rather than recreated, so running this twice is safe and running it against
 * an environment that is half-provisioned converges it. Objects are never
 * touched — this script only ever changes bucket metadata.
 *
 * Usage:
 *   npx tsx scripts/provision-storage.ts            # apply
 *   npx tsx scripts/provision-storage.ts --dry-run  # report only
 *
 * Targets whatever NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY point
 * at. It refuses to run without an explicit --allow-production flag when the
 * target is not a known non-production project, so a stray `.env` cannot
 * silently reconfigure production storage.
 */
import * as dotenv from "dotenv";
dotenv.config();

import { createClient } from "@supabase/supabase-js";

interface BucketSpec {
  name: string;
  /** Always false. Kept explicit so the intent is visible at the call site. */
  public: false;
  /** Bytes. A backstop behind the per-route limits, not a replacement. */
  fileSizeLimit: number;
  allowedMimeTypes: string[];
  purpose: string;
}

const BUCKETS: BucketSpec[] = [
  {
    name: "clinical-reports",
    public: false,
    // Patient clinical PDFs. Render output is a few hundred KB; 25 MB is
    // headroom for image-heavy dossier templates without allowing an
    // arbitrary upload to sit in a clinical bucket.
    fileSizeLimit: 25 * 1024 * 1024,
    allowedMimeTypes: ["application/pdf"],
    purpose: "Generated patient clinical report PDFs",
  },
  {
    name: "clinical-images",
    public: false,
    // Patient scalp/face photographs and uploaded prescriptions — the most
    // sensitive objects in the system. The questionnaire clients already cap
    // uploads at 4 MB; 10 MB here is the server-side backstop.
    fileSizeLimit: 10 * 1024 * 1024,
    allowedMimeTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ],
    purpose: "Patient clinical photographs and prescription uploads",
  },
  {
    name: "doctor-avatars",
    public: false,
    // Matches the 5 MB cap enforced in /api/doctor/me/avatar.
    fileSizeLimit: 5 * 1024 * 1024,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    purpose: "Clinician profile photographs",
  },
  {
    name: "one-pagers",
    public: false,
    // The immutable JSON record of the sheet an approval released — every
    // word, number and asset reference the one-pager renders from. Written by
    // lib/reports/one-page/snapshot at approval, and read by the render
    // pipeline as its source of truth. A view model is tens of kilobytes.
    fileSizeLimit: 2 * 1024 * 1024,
    allowedMimeTypes: ["application/json"],
    purpose: "Approved one-pager snapshots (the clinical record of what was released)",
  },
  {
    name: "report-assets",
    public: false,
    // The RENDERED artefacts produced from those snapshots — today the
    // one-pager PNG a patient receives on WhatsApp. Capped at the transport's
    // own 5 MB media ceiling, because storing something that could never be
    // delivered helps nobody.
    fileSizeLimit: 5 * 1024 * 1024,
    allowedMimeTypes: ["image/png", "application/pdf"],
    purpose: "Rendered patient report artefacts (one-pager PNG)",
  },
];

// Project refs this script is allowed to touch without an explicit override.
const NON_PRODUCTION_REFS = new Set(["vbkoupvduadmcxggtnsb"]); // hairos-staging

function projectRef(url: string): string {
  return url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1] ?? "unknown";
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const allowProduction = process.argv.includes("--allow-production");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.",
    );
  }

  const ref = projectRef(url);
  console.log(`[provision-storage] target project: ${ref}`);
  console.log(`[provision-storage] mode: ${dryRun ? "DRY RUN" : "APPLY"}`);

  if (!NON_PRODUCTION_REFS.has(ref) && !allowProduction) {
    throw new Error(
      `Refusing to run against project '${ref}' — it is not a known non-production project.\n` +
        `Re-run with --allow-production if this is deliberate.`,
    );
  }

  const supabase = createClient(url, serviceKey);

  const { data: existing, error: listErr } = await supabase.storage.listBuckets();
  if (listErr) throw new Error(`Could not list buckets: ${listErr.message}`);
  const byName = new Map((existing ?? []).map((b) => [b.name, b]));
  console.log(
    `[provision-storage] existing buckets: ${
      existing?.length ? existing.map((b) => b.name).join(", ") : "(none)"
    }`,
  );

  let created = 0;
  let updated = 0;

  for (const spec of BUCKETS) {
    const options = {
      public: spec.public,
      fileSizeLimit: spec.fileSizeLimit,
      allowedMimeTypes: spec.allowedMimeTypes,
    };
    const present = byName.get(spec.name);

    if (!present) {
      if (dryRun) {
        console.log(`  WOULD CREATE  ${spec.name} (private)`);
        continue;
      }
      const { error } = await supabase.storage.createBucket(spec.name, options);
      // A concurrent run can win the race between listBuckets and createBucket.
      // Treat "already exists" as success and fall through to the update, so
      // the script stays idempotent under parallel invocation.
      if (error && !/already exists/i.test(error.message)) {
        throw new Error(`Failed to create '${spec.name}': ${error.message}`);
      }
      if (error) {
        console.log(`  EXISTS(race)  ${spec.name} — updating instead`);
      } else {
        console.log(`  CREATED       ${spec.name} (private)`);
        created++;
        continue;
      }
    }

    if (dryRun) {
      const drift =
        present?.public !== spec.public ? ` [public=${present?.public} -> false]` : "";
      console.log(`  WOULD UPDATE  ${spec.name}${drift}`);
      continue;
    }

    // Converge configuration even when the bucket already existed — this is
    // what repairs a bucket that was created public by the old script.
    const { error: updErr } = await supabase.storage.updateBucket(spec.name, options);
    if (updErr) {
      throw new Error(`Failed to update '${spec.name}': ${updErr.message}`);
    }
    console.log(`  UPDATED       ${spec.name} -> private, ${spec.allowedMimeTypes.length} mime types`);
    updated++;
  }

  // Verify by reading back, rather than trusting the write calls.
  const { data: after, error: afterErr } = await supabase.storage.listBuckets();
  if (afterErr) throw new Error(`Verification failed: ${afterErr.message}`);

  console.log("\n[provision-storage] final state:");
  let bad = 0;
  for (const spec of BUCKETS) {
    const b = after?.find((x) => x.name === spec.name);
    if (!b) {
      console.log(`  MISSING  ${spec.name}`);
      bad++;
      continue;
    }
    const priv = b.public === false;
    if (!priv) bad++;
    console.log(
      `  ${priv ? "OK" : "PUBLIC!"}  ${b.name}  public=${b.public}  ` +
        `limit=${b.file_size_limit ?? "unset"}  mime=${
          Array.isArray(b.allowed_mime_types) ? b.allowed_mime_types.join("|") : "unset"
        }`,
    );
  }

  console.log(
    `\n[provision-storage] created=${created} updated=${updated} problems=${bad}`,
  );
  if (bad > 0 && !dryRun) process.exitCode = 1;
}

main().catch((err) => {
  console.error("[provision-storage] FAILED:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
