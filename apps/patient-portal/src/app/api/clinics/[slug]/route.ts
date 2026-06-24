import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  if (!slug || typeof slug !== 'string') {
    return NextResponse.json({ success: false, error: 'Invalid clinic slug' }, { status: 400 });
  }

  try {
    const clinic = await prisma.clinic.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        region: true,
        language: true,
        address: true,
        logoUrl: true,
        tagline: true,
        isActive: true,
        // Lead clinician = isPrimary first, else oldest active doctor.
        // Same selection logic is duplicated in two places: keep them in
        // sync if you change the heuristic.
        doctors: {
          where: { isActive: true, deletedAt: null },
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
          take: 1,
          select: {
            id: true,
            name: true,
            specialization: true,
            credentials: true,
            photoUrl: true,
            bio: true,
          },
        },
      },
    });

    if (!clinic) {
      return NextResponse.json({ success: false, error: 'Clinic not found' }, { status: 404 });
    }

    if (!clinic.isActive) {
      return NextResponse.json({ success: false, error: 'Clinic is not active' }, { status: 403 });
    }

    const { doctors, ...rest } = clinic;
    return NextResponse.json({
      success: true,
      clinic: { ...rest, leadDoctor: doctors[0] ?? null },
    });
  } catch (err) {
    console.error('[CLINICS API] ERROR', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
