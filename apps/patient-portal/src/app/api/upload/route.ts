import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { getClinicContext, handleAuthError } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/auth/roles";

// POST /api/upload — mints a Supabase signed upload URL for a clinical image.
//
// Locked down (previously accepted anonymous requests and shipped a mock
// service key in dev fallbacks — either was enough to leak a signed URL for
// any patient's scalp image bucket).
//
// Contract:
//   1. Authenticated caller (getClinicContext).
//   2. Assessment exists AND caller belongs to that assessment's clinic (or
//      SUPER_ADMIN).
//   3. contentType is a supported image MIME.
//   4. fileName is sanitized to prevent path traversal / control characters.
//   5. Storage path uses the DB-owned assessmentId (never the client's raw
//      input) and a server timestamp.
//   6. Fails closed on missing Supabase service-role credentials — no mock
//      fallback ever ships to production.

import { ALLOWED_MIME, sanitizeFileName } from "./validation";

export async function POST(req: Request) {
  let auth;
  try {
    auth = await getClinicContext();
  } catch (err) {
    const resp = handleAuthError(err);
    if (resp) return resp;
    throw err;
  }

  const body = (await req.json().catch(() => ({}))) as {
    fileName?: unknown;
    contentType?: unknown;
    assessmentId?: unknown;
  };

  const fileNameRaw = typeof body.fileName === "string" ? body.fileName : "";
  const contentType = typeof body.contentType === "string" ? body.contentType : "";
  const assessmentId = typeof body.assessmentId === "string" ? body.assessmentId : "";

  if (!fileNameRaw || !contentType || !assessmentId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!ALLOWED_MIME.has(contentType)) {
    return NextResponse.json(
      { error: "Invalid file type. Only image/jpeg, image/png, image/webp are allowed." },
      { status: 400 },
    );
  }

  const safeName = sanitizeFileName(fileNameRaw);
  if (!safeName) {
    return NextResponse.json({ error: "Invalid file name" }, { status: 400 });
  }

  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: { id: true, clinicId: true },
  });
  if (!assessment) {
    return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
  }
  if (!isSuperAdmin(auth.role) && assessment.clinicId !== auth.clinicId) {
    return NextResponse.json({ error: "Cross-clinic upload denied" }, { status: 403 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error("[api/upload] Supabase service credentials missing — refusing to mint URL");
    return NextResponse.json({ error: "Storage not configured" }, { status: 500 });
  }
  const supabase = createClient(supabaseUrl, serviceKey);

  // Path uses the DB-owned assessment id, never the client's raw input.
  const securePath = `assessments/${assessment.id}/scalp/${Date.now()}-${safeName}`;

  const { data, error } = await supabase.storage
    .from("clinical-images")
    .createSignedUploadUrl(securePath);

  if (error) {
    console.error("[api/upload] Signed URL error:", error);
    return NextResponse.json({ error: "Failed to generate upload URL" }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    signedUrl: data.signedUrl,
    path: securePath,
  });
}
