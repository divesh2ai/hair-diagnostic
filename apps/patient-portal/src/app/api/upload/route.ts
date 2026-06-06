import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Setup Supabase Client (Service Role for backend operations)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mock.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-service-key';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req: Request) {
  try {
    const { fileName, contentType, assessmentId } = await req.json();

    if (!fileName || !contentType || !assessmentId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Server-side MIME validation (Reject Executables/PDFs/etc)
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(contentType)) {
      return NextResponse.json({ error: 'Invalid file type. Only images are allowed.' }, { status: 400 });
    }

    // Construct secure storage path: /assessments/{assessmentId}/scalp/{timestamp}-{fileName}
    const securePath = `assessments/${assessmentId}/scalp/${Date.now()}-${fileName}`;

    // Generate Signed Upload URL
    // Gives the frontend temporary, restricted permission to upload directly to bucket
    const { data, error } = await supabase.storage
      .from('clinical-images')
      .createSignedUploadUrl(securePath);

    if (error) {
      console.error('Supabase Signed URL Error:', error);
      throw new Error('Storage initialization failed');
    }

    return NextResponse.json({
      success: true,
      signedUrl: data.signedUrl,
      path: securePath,
      publicUrl: `${supabaseUrl}/storage/v1/object/public/clinical-images/${securePath}`
    });

  } catch (err) {
    console.error('Upload API Error:', err);
    return NextResponse.json({ error: 'Failed to generate secure upload credentials' }, { status: 500 });
  }
}
