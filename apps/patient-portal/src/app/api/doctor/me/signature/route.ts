import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { requireDoctorContext } from "@/lib/auth";

// POST   /api/doctor/me/signature — upload the signed-in doctor's signature.
// DELETE /api/doctor/me/signature — clear it.
//
// Mirrors /api/doctor/me/avatar: multipart `file`, server-side upload via the
// service role into the PRIVATE `doctor-avatars` bucket, and the Doctor row
// stores the stable /api/avatar/<path> URL (never a signed URL, which would
// expire). A signature is a clinic-published, non-patient asset in the same
// trust tier as the headshot — it already prints on approved reports — so it
// shares the bucket and its serving route.

const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(req: Request) {
  const authResult = await requireDoctorContext();
  if (authResult instanceof NextResponse) return authResult;
  const { doctor } = authResult;

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json(
      { error: "Only PNG, JPEG or WebP images are allowed" },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image exceeds 4MB limit" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 500 });
  }
  const supabase = createClient(supabaseUrl, serviceKey);

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `doctor-signatures/${doctor.id}-${Date.now()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: uploadErr } = await supabase.storage
    .from("doctor-avatars")
    .upload(path, bytes, { contentType: file.type, upsert: true });

  if (uploadErr) {
    console.error("[doctor signature] upload failed:", uploadErr);
    const isMissingBucket = /bucket not found/i.test(uploadErr.message);
    return NextResponse.json(
      {
        error: isMissingBucket
          ? "Signature storage is not set up for this environment yet. Please contact an administrator."
          : "Upload failed",
      },
      { status: isMissingBucket ? 503 : 500 },
    );
  }

  const signatureUrl = `/api/avatar/${encodeURIComponent(path)}`;
  await prisma.doctor.update({
    where: { id: doctor.id },
    data: { signatureUrl },
  });

  return NextResponse.json({ signatureUrl });
}

export async function DELETE() {
  const authResult = await requireDoctorContext();
  if (authResult instanceof NextResponse) return authResult;
  const { doctor } = authResult;

  await prisma.doctor.update({
    where: { id: doctor.id },
    data: { signatureUrl: null },
  });
  return NextResponse.json({ signatureUrl: null });
}
