import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// GET /api/avatar/<object path> — serve a clinician profile photo out
// of the PRIVATE `doctor-avatars` bucket.
//
// ── Why this route exists ───────────────────────────────────────────────────
// Every storage bucket is private, including this one. A clinician headshot is
// not patient data — it is deliberately shown to patients on the cart and the
// clinic pages — but the bucket still must not be world-listable, and a stored
// signed URL would expire and rot the Doctor row. So the Doctor row holds a
// stable path to THIS route, and the signing happens per request.
//
// ── Why it is unauthenticated ───────────────────────────────────────────────
// On purpose, and narrowly. The patient cart shows the approving doctor's photo
// to a patient who holds a cart token, not a session. Requiring auth here would
// break that by design. What keeps it safe:
//
//   • It can only ever read `doctor-avatars` — the bucket is hardcoded. It is
//     not a general proxy into storage.
//   • Path traversal is rejected below, so it cannot be walked into another
//     bucket or a parent prefix.
//   • The objects are professional headshots the clinic publishes about itself.
//
// Do NOT copy this pattern for `clinical-reports` or `clinical-images`. Those
// hold patient data and must stay behind the authenticated/token-gated routes.

export const dynamic = "force-dynamic";

const BUCKET = "doctor-avatars";
const SIGNED_TTL_SECONDS = 300;

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await ctx.params;
  const objectPath = (segments ?? []).map(decodeURIComponent).join("/");

  // Reject anything that could climb out of the bucket prefix. Supabase would
  // very likely refuse these anyway; refusing here means we never depend on
  // that being true.
  if (
    !objectPath ||
    objectPath.includes("..") ||
    objectPath.startsWith("/") ||
    objectPath.includes("\\")
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(objectPath, SIGNED_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    // A missing object and a missing bucket both answer 404 — neither tells
    // the caller anything about what else might be in storage.
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const upstream = await fetch(data.signedUrl);
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const headers = new Headers();
  headers.set(
    "Content-Type",
    upstream.headers.get("content-type") ?? "image/jpeg",
  );
  // Avatars change rarely and the URL is stable, so let the browser hold it.
  // Public rather than private: this is not patient data, and clinic pages are
  // frequently served through a shared cache.
  headers.set("Cache-Control", "public, max-age=3600");

  return new NextResponse(upstream.body, { status: 200, headers });
}
