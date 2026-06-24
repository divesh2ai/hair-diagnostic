/*
 * Mint a /review/[token] URL for an assessment so it can be shared with
 * the reviewing doctor before any auth is in place.
 *
 *   npx tsx scripts/generate-review-token.ts <assessmentId> [--ttlDays 14]
 *
 * Reads REVIEW_TOKEN_SECRET and NEXT_PUBLIC_APP_URL from env (.env.local).
 * Outputs the token and the full review URL.
 *
 * NOTE: This script mirrors the signer in
 * apps/patient-portal/src/lib/reviewToken.ts. They must stay in sync —
 * if you change the token format there, change it here too.
 */

import { createHmac } from "node:crypto";
import { config as loadEnv } from "dotenv";
import path from "node:path";

loadEnv({ path: path.resolve(process.cwd(), "apps/patient-portal/.env.local") });
loadEnv(); // fall through to repo-root .env if present

function b64url(input: string | Buffer): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf.toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function signReviewToken(assessmentId: string, ttlMs: number): string {
  const secret = process.env.REVIEW_TOKEN_SECRET;
  if (!secret) {
    throw new Error(
      "REVIEW_TOKEN_SECRET is missing. Add it to apps/patient-portal/.env.local first.",
    );
  }
  const payload = { a: assessmentId, e: Date.now() + ttlMs };
  const body = b64url(JSON.stringify(payload));
  const mac = createHmac("sha256", secret).update(body).digest("hex");
  return `${body}.${b64url(mac)}`;
}

function main() {
  const args = process.argv.slice(2);
  const assessmentId = args[0];
  if (!assessmentId) {
    console.error("Usage: tsx scripts/generate-review-token.ts <assessmentId> [--ttlDays N]");
    process.exit(1);
  }

  const ttlIdx = args.indexOf("--ttlDays");
  const ttlDays = ttlIdx >= 0 ? Number(args[ttlIdx + 1]) : 14;
  if (!Number.isFinite(ttlDays) || ttlDays <= 0) {
    console.error("--ttlDays must be a positive number");
    process.exit(1);
  }

  const token = signReviewToken(assessmentId, ttlDays * 24 * 60 * 60 * 1000);
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:4000";

  console.log("");
  console.log(`Token:        ${token}`);
  console.log(`Expires in:   ${ttlDays} day(s)`);
  console.log(`Review URL:   ${base}/review/${token}`);
  console.log("");
}

main();
