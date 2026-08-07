import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';
import {
  ALLOWED_MIME,
  isUploadSizeAllowed,
  isValidUploadSessionId,
  sanitizeFileName,
} from '../validation';

const BUCKET = 'clinical-images';
const ALLOWED_QUESTIONS = new Set([
  'acne_photos', 'prescription_upload', 'PIG_13_PRESCRIPTION',
  'PIG_14_FRONT', 'PIG_14_LEFT', 'PIG_14_RIGHT', 'PIG_14_BODY',
]);

function storageClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

async function activeClinic(clinicSlug: string) {
  if (!clinicSlug) return null;
  return prisma.clinic.findFirst({
    where: { slug: clinicSlug, isActive: true },
    select: { id: true },
  });
}

function sessionPrefix(clinicId: string, sessionId: string) {
  return `sessions/${clinicId}/${sessionId}/`;
}

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') ?? 'local';
  if (!rateLimit(`questionnaire-upload:${ip}`, 40, 60_000).ok) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const clinicSlug = typeof body.clinicSlug === 'string' ? body.clinicSlug.trim() : '';
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId : '';
  const questionId = typeof body.questionId === 'string' ? body.questionId : '';
  const fileName = typeof body.fileName === 'string' ? sanitizeFileName(body.fileName) : null;
  const contentType = typeof body.contentType === 'string' ? body.contentType : '';
  const fileSize = typeof body.fileSize === 'number' ? body.fileSize : Number.NaN;

  if (!isValidUploadSessionId(sessionId) || !ALLOWED_QUESTIONS.has(questionId)) {
    return NextResponse.json({ error: 'Invalid upload session' }, { status: 400 });
  }
  const prescriptionUpload = questionId === 'PIG_13_PRESCRIPTION';
  const mimeAllowed = ALLOWED_MIME.has(contentType) || (prescriptionUpload && contentType === 'application/pdf');
  if (!fileName || !mimeAllowed) {
    return NextResponse.json({ error: prescriptionUpload ? 'Only PDF, JPEG, PNG, and WebP files are allowed' : 'Only JPEG, PNG, and WebP images are allowed' }, { status: 400 });
  }
  if (!isUploadSizeAllowed(fileSize)) {
    return NextResponse.json({ error: 'File must be between 1 byte and 4 MB' }, { status: 400 });
  }

  const clinic = await activeClinic(clinicSlug);
  if (!clinic) return NextResponse.json({ error: 'Clinic not found' }, { status: 404 });
  const supabase = storageClient();
  if (!supabase) return NextResponse.json({ error: 'Storage not configured' }, { status: 503 });

  const path = `${sessionPrefix(clinic.id, sessionId)}${questionId}/${Date.now()}-${fileName}`;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    console.error('[questionnaire-upload] signed URL error', error);
    return NextResponse.json({ error: 'Could not start upload' }, { status: 502 });
  }

  return NextResponse.json({
    success: true,
    bucket: BUCKET,
    path,
    signedUrl: data.signedUrl,
    token: data.token,
  });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const clinicSlug = url.searchParams.get('clinicSlug')?.trim() ?? '';
  const sessionId = url.searchParams.get('sessionId') ?? '';
  const path = url.searchParams.get('path') ?? '';
  if (!isValidUploadSessionId(sessionId)) {
    return NextResponse.json({ error: 'Invalid upload session' }, { status: 400 });
  }
  const clinic = await activeClinic(clinicSlug);
  if (!clinic || !path.startsWith(sessionPrefix(clinic.id, sessionId))) {
    return NextResponse.json({ error: 'Upload not found' }, { status: 404 });
  }
  const supabase = storageClient();
  if (!supabase) return NextResponse.json({ error: 'Storage not configured' }, { status: 503 });
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
  if (error || !data) return NextResponse.json({ error: 'Preview unavailable' }, { status: 404 });
  return NextResponse.json({ success: true, signedUrl: data.signedUrl });
}

export async function DELETE(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const clinicSlug = typeof body.clinicSlug === 'string' ? body.clinicSlug.trim() : '';
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId : '';
  const path = typeof body.path === 'string' ? body.path : '';
  if (!isValidUploadSessionId(sessionId)) {
    return NextResponse.json({ error: 'Invalid upload session' }, { status: 400 });
  }
  const clinic = await activeClinic(clinicSlug);
  if (!clinic || !path.startsWith(sessionPrefix(clinic.id, sessionId))) {
    return NextResponse.json({ error: 'Upload not found' }, { status: 404 });
  }
  const supabase = storageClient();
  if (!supabase) return NextResponse.json({ error: 'Storage not configured' }, { status: 503 });
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) return NextResponse.json({ error: 'Could not remove upload' }, { status: 502 });
  return NextResponse.json({ success: true });
}