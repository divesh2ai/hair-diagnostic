const required = ["DATABASE_URL"] as const;

export function validateEnv(): { valid: boolean; missing: string[] } {
  const missing = required.filter((k) => !process.env[k]);
  return { valid: missing.length === 0, missing };
}

export const env = {
  databaseUrl: process.env.DATABASE_URL ?? "",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  whatsappPhoneId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? "",
  whatsappToken: process.env.WHATSAPP_ACCESS_TOKEN ?? "",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:4000",
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB ?? 10),
};
