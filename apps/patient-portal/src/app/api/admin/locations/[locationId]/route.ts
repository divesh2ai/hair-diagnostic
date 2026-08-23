import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertSuperAdmin, handleAuthError } from "@/lib/auth";
import {
  geoStatusForCoordinates,
  isDuplicatePrimaryLocation,
  updateLocationSchema,
} from "@/lib/clinic/location";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";

export const dynamic = "force-dynamic";

// A single physical branch. Super Admin only — branch geography is platform
// operations data, and its blast radius (the national map, QR routing) is wider
// than one clinic's own workspace.

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

// PATCH /api/admin/locations/[locationId]
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ locationId: string }> },
) {
  try {
    const ctx = await assertSuperAdmin();
    const { locationId } = await params;

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }

    const parsed = updateLocationSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const existing = await prisma.clinicLocation.findFirst({
      where: { id: locationId, deletedAt: null },
      select: { id: true, clinicId: true, latitude: true, longitude: true, isPrimary: true },
    });
    if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });

    // Only fields the caller actually sent are written. Parsed output alone
    // can't tell "cleared to null" from "not mentioned", and conflating those
    // would wipe an address on a request that only moved a pin.
    const sent = (key: string) =>
      typeof raw === "object" && raw !== null && Object.hasOwn(raw, key);

    const data: Prisma.ClinicLocationUpdateInput = {};
    const v = parsed.data;

    if (sent("branchName") && v.branchName !== undefined) data.branchName = v.branchName;
    if (sent("addressLine1")) data.addressLine1 = v.addressLine1 ?? null;
    if (sent("addressLine2")) data.addressLine2 = v.addressLine2 ?? null;
    if (sent("city")) data.city = v.city ?? null;
    if (sent("district")) data.district = v.district ?? null;
    if (sent("state")) data.state = v.state ?? null;
    if (sent("pincode")) data.pincode = v.pincode ?? null;
    if (sent("country") && v.country !== undefined) data.country = v.country;
    if (sent("phone")) data.phone = v.phone ?? null;
    if (sent("status") && v.status !== undefined) data.status = v.status;

    // Coordinates move as a pair, and moving them re-derives provenance. A pin
    // that is cleared returns to UNSET rather than keeping a stale PINNED claim
    // over nothing.
    const movingPin = sent("latitude") || sent("longitude");
    if (movingPin) {
      const latitude = v.latitude ?? null;
      const longitude = v.longitude ?? null;
      data.latitude = latitude;
      data.longitude = longitude;
      data.geoStatus = geoStatusForCoordinates(latitude, longitude);
      data.geocodedAt = null;
    }

    const shouldPromote = sent("isPrimary") && v.isPrimary === true;
    const shouldDemote = sent("isPrimary") && v.isPrimary === false;

    if (shouldDemote && existing.isPrimary) {
      // Refusing rather than silently leaving the clinic without a default
      // branch. Promoting another branch is the supported way to move it.
      return NextResponse.json(
        { error: "primary_required", message: "Promote another branch instead." },
        { status: 409 },
      );
    }

    const location = await prisma.$transaction(async (tx) => {
      if (shouldPromote) {
        await tx.clinicLocation.updateMany({
          where: {
            clinicId: existing.clinicId,
            deletedAt: null,
            isPrimary: true,
            id: { not: locationId },
          },
          data: { isPrimary: false },
        });
        data.isPrimary = true;
      }

      const updated = await tx.clinicLocation.update({
        where: { id: locationId },
        data,
        select: LOCATION_SELECT,
      });

      await writeAuditLog({
        action: "CLINIC_LOCATION_UPDATED",
        entityType: "ClinicLocation",
        entityId: locationId,
        actorId: ctx.userId,
        actorRole: ctx.role,
        actorType: "admin",
        metadata: {
          clinicId: updated.clinicId,
          fieldsChanged: Object.keys(data).sort(),
          // Provenance matters on the map: a human re-pin and a geocoder run
          // are different claims about how trustworthy the coordinate is.
          geoStatus: updated.geoStatus,
          isPrimary: updated.isPrimary,
        },
        prismaClient: tx,
      });

      return updated;
    });

    return NextResponse.json({ location });
  } catch (err) {
    const resp = handleAuthError(err);
    if (resp) return resp;
    if (isDuplicatePrimaryLocation(err)) {
      return NextResponse.json(
        {
          error: "primary_conflict",
          message:
            "Another branch was promoted to primary at the same time. Reload and try again.",
        },
        { status: 409 },
      );
    }
    console.error("[ADMIN LOCATION UPDATE]", err);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}

// DELETE /api/admin/locations/[locationId] — soft delete.
//
// Branches carry operational history (QR scans, assessments taken on site), so
// rows are retired, never dropped.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ locationId: string }> },
) {
  try {
    const ctx = await assertSuperAdmin();
    const { locationId } = await params;

    const existing = await prisma.clinicLocation.findFirst({
      where: { id: locationId, deletedAt: null },
      select: { id: true, clinicId: true, isPrimary: true },
    });
    if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const siblings = await prisma.clinicLocation.count({
      where: { clinicId: existing.clinicId, deletedAt: null, id: { not: locationId } },
    });

    if (existing.isPrimary && siblings > 0) {
      return NextResponse.json(
        {
          error: "primary_required",
          message: "Promote another branch to primary before retiring this one.",
        },
        { status: 409 },
      );
    }

    await prisma.clinicLocation.update({
      where: { id: locationId },
      data: { deletedAt: new Date(), status: "CLOSED", isPrimary: false },
    });

    // Retiring a branch removes it from the map and from QR routing. Record
    // whether it was the clinic's last remaining branch — that is the case
    // that silently drops a whole clinic off the national map.
    await writeAuditLog({
      action: "CLINIC_LOCATION_DELETED",
      entityType: "ClinicLocation",
      entityId: locationId,
      actorId: ctx.userId,
      actorRole: ctx.role,
      actorType: "admin",
      metadata: {
        clinicId: existing.clinicId,
        wasPrimary: existing.isPrimary,
        remainingBranches: siblings,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const resp = handleAuthError(err);
    if (resp) return resp;
    console.error("[ADMIN LOCATION DELETE]", err);
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
