import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mock.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-service-key';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function uploadReportToSupabase(buffer: Buffer, assessmentId: string, filename: string): Promise<string> {
  const path = `reports/${assessmentId}/${filename}`;
  
  const { error } = await supabase.storage
    .from('clinical-reports')
    .upload(path, buffer, {
      contentType: 'application/pdf',
      upsert: true
    });

  if (error) {
    console.error(`[PDF Storage] Supabase upload failed for ${filename}:`, error);
    throw new Error(`Failed to store PDF artifact: ${error.message}`);
  }

  return `${supabaseUrl}/storage/v1/object/public/clinical-reports/${path}`;
}
