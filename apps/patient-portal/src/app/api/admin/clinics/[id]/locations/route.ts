import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertClinicAccess, assertSuperAdmin, handleAuthError } from "@/lib/auth";
import {
  createLocationSchema,
  geoStatusForCoordinates,
  isDuplicatePrimaryLocation,
  locationSetupState,
  seedFromLegacyClinic,
} from "@/lib/clinic/location";

export const dynamic = "force-dynamic";

// Physical branches of one clinic.
//
// Locations are premises, not patients. Nothing patient-level is readable or
// writable through these endpoints — no counts, no assessments, no queue depth.
// Operational activity per clinic belongs on the admin metrics endpoints, where
// it is already scoped and audited.

const LOCATION_SELECT = {
  id: true,
  clinicId: true,
  branchName: true,
  isPrimary: true,
  addressLine1: true,
  addressLine2: true,
  city: true,
  district: true,
  state: true,
  pincode: true,
  country: true,
  latitude: true,
  longitude: true,
  geoStatus: true,
  geocodedAt: true,
  status: true,
  phone: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ClinicLocationSelect;

// GET /api/admin/clinics/[id]/locations
//
// Readable by Super Admin (any clinic) and by members of the clinic itself —
// a clinic admin needs to see their own branches. Writes stay Super Admin only.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: clinicId } = await params;
    await assertClinicAccess(clinicId);

    const clinic = await prisma.clinic.findFirst({
      where: { id: clinicId, deletedAt: null },
      select: { id: true, name: true, address: true, phone: true },
    });
    if (!clinic) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const locations = await prisma.clinicLocation.findMany({
      where: { clinicId, deletedAt: null },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      select: LOCATION_SELECT,
    });

    return NextResponse.json({
      locations,
      // Drives the Super Admin worklist: which clinics still can't be plotted.
      locationSetup: locationSetupState(locations),
      // Pre-fill for the first branch, carried verbatim from the clinic's
      // legacy free-text address. Never auto-applied — it is a suggestion for a
      // human to structure, which is why it is returned separately from
      // `locations` rather than as a phantom row.
      seed: locations.length === 0 ? seedFromLegacyClinic(clinic) : null,
    });
  } catch (err) {
    const resp = handleAuthError(err);
    if (resp) return resp;
    console.error("[ADMIN CLINIC LOCATIONS LIST]", err);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

// POST /api/admin/clinics/[id]/locations
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await assertSuperAdmin();
    const { id: clinicId } = await params;

    const clinic = await prisma.clinic.findFirst({
      where: { id: clinicId, deletedAt: null },
      select: { id: true },
    });
    if (!clinic) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const parsed = createLocationSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const data = parsed.data;

    const latitude = data.latitude ?? null;
    const longitude = data.longitude ?? null;

    const location = await prisma.$transaction(async (tx) => {
      const existingCount = await tx.clinicLocation.count({
        where: { clinicId, deletedAt: null },
      });
      // The first branch is the primary one whether or not the caller said so —
      // a clinic with branches but no default has no answer for "where does the
      // clinic-level QR send someone?".
      const isPrimary = existingCount === 0 ? true : data.isPrimary;

      if (isPrimary) {
        await tx.clinicLocation.updateMany({
          where: { clinicId, deletedAt: null, isPrimary: true },
          data: { isPrimary: false },
        });
      }

      return tx.clinicLocation.create({
        data: {
          clinicId,
          branchName: data.branchName,
          isPrimary,
          addressLine1: data.addressLine1 ?? null,
          addressLine2: data.addressLine2 ?? null,
          city: data.city ?? null,
          district: data.district ?? null,
          state: data.state ?? null,
          pincode: data.pincode ?? null,
          country: data.country,
          latitude,
          longitude,
          // Provenance is derived, never accepted from the client. A caller
          // cannot claim a coordinate was GEOCODED to make it look verified.
          geoStatus: geoStatusForCoordinates(latitude, longitude),
          // Stamped only by an actual geocoder run. A human pin is PINNED and
          // its timing is already on updatedAt.
          geocodedAt: null,
          status: data.status,
          phone: data.phone ?? null,
        },
        select: LOCATION_SELECT,
      });
    });

    return NextResponse.json({ location }, { status: 201 });
  } catch (err) {
    const resp = handleAuthError(err);
    if (resp) return resp;
    if (isDuplicatePrimaryLocation(err)) {
      // Two branches promoted concurrently. The database refused the second;
      // say so rather than reporting a platform fault for a race the admin can
      // simply retry.
      return NextResponse.json(
        {
          error: "primary_conflict",
          message:
            "Another branch was promoted to primary at the same time. Reload and try again.",
        },
        { status: 409 },
      );
    }
    console.error("[ADMIN CLINIC LOCATION CREATE]", err);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
