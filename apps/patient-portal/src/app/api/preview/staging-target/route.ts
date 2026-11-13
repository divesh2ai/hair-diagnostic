import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractSupabaseRef, STAGING_SUPABASE_REF } from "@shared/env/databaseTarget";

export async function GET() {
  if (process.env.VERCEL_ENV !== "preview") {
    return new NextResponse(null, { status: 404 });
  }

  const auth = extractSupabaseRef(process.env.NEXT_PUBLIC_SUPABASE_URL) === STAGING_SUPABASE_REF;
  const database = extractSupabaseRef(process.env.DATABASE_URL) === STAGING_SUPABASE_REF;
  const direct = extractSupabaseRef(process.env.DIRECT_URL) === STAGING_SUPABASE_REF;
  if (!auth || !database || !direct) {
    return NextResponse.json({ auth, database, direct }, { status: 503 });
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ auth, database, direct, connected: true });
  } catch {
    return NextResponse.json({ auth, database, direct, connected: false }, { status: 503 });
  }
}
