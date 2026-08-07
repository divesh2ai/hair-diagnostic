import { NextResponse } from 'next/server';
import { loadFixtureMetadataList } from '@/lib/server/loadFixtures';

const SANDBOX_DISABLED = process.env.NODE_ENV === "production";

export async function GET() {
  if (SANDBOX_DISABLED) {
    return new NextResponse(null, { status: 404 });
  }
  try {
    const fixtures = loadFixtureMetadataList();
    return NextResponse.json({ fixtures, count: fixtures.length });
  } catch (error) {
    console.error('[fixtures API]', error);
    return NextResponse.json(
      { error: 'Failed to list fixtures', fixtures: [], count: 0 },
      { status: 500 }
    );
  }
}
