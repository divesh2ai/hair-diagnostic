import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { requireDoctorContext } from "@/lib/auth";

// POST /api/doctor/me/avatar — upload the signed-in doctor's profile photo.
// Multipart body with a single `file` field. Server-side upload via the
// service role so the browser never sees storage credentials.

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 5 * 1024 * 1024;

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
    return NextResponse.json({ error: "Only JPEG, PNG, WebP images are allowed" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image exceeds 5MB limit" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 500 });
  }
  const supabase = createClient(supabaseUrl, serviceKey);

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `doctor-avatars/${doctor.id}-${Date.now()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: uploadErr } = await supabase.storage
    .from("doctor-avatars")
    .upload(path, bytes, { contentType: file.type, upsert: true });

  if (uploadErr) {
    console.error("[doctor avatar] upload failed:", uploadErr);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  const { data: pub } = supabase.storage.from("doctor-avatars").getPublicUrl(path);
  const avatarUrl = pub.publicUrl;

  await prisma.doctor.update({
    where: { id: doctor.id },
    data: { avatarUrl, photoUrl: avatarUrl },
  });

  return NextResponse.json({ avatarUrl });
}
