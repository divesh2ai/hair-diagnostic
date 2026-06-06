import * as dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mock.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-service-key';
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("Using Supabase URL:", supabaseUrl);
  console.log("Creating Supabase storage bucket 'clinical-reports'...");
  const { data, error } = await supabase.storage.createBucket('clinical-reports', {
    public: true,
  });
  if (error) {
    console.error("Failed to create bucket:", error);
  } else {
    console.log("Bucket created successfully:", data);
  }
}

main().catch(console.error);
