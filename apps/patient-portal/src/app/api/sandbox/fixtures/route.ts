import { NextResponse } from 'next/server';
import { loadFixtureMetadataList } from '@/lib/server/loadFixtures';

export async function GET() {
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
