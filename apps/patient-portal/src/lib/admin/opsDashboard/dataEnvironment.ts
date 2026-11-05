import { extractSupabaseRef, PRODUCTION_SUPABASE_REF, STAGING_SUPABASE_REF } from "@shared/env/databaseTarget";

export function opsDataEnvironment(databaseUrl: string | undefined) {
  const ref = extractSupabaseRef(databaseUrl);
  if (ref === STAGING_SUPABASE_REF) return "STAGING";
  if (ref === PRODUCTION_SUPABASE_REF) return "PRODUCTION";
  return "UNVERIFIED";
}
