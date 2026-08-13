import { z } from "zod";
import { LocationGeoStatus, Prisma } from "@prisma/client";

// Clinic location domain rules.
//
// One idea governs this module: a coordinate is a claim about where a real
// clinic stands, and the platform must never make that claim on a human's
// behalf. Everything here either records what someone verified, or records
// honestly that nobody has yet.

/** Indian PIN codes are six digits and never start with 0. */
const PINCODE_IN = /^[1-9][0-9]{5}$/;

const trimmedOptional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((s) => (s === "" ? null : s))
    .nullish();

// Coordinates travel as a pair or not at all. A lone latitude is not a
// half-known location, it is a corrupt one — it would pass a null check and
// then silently vanish from every bounding-box query.
const coordinates = z
  .object({
    latitude: z.number().min(-90).max(90).nullish(),
    longitude: z.number().min(-180).max(180).nullish(),
  })
  .refine(
    (v) =>
      (v.latitude === null || v.latitude === undefined) ===
      (v.longitude === null || v.longitude === undefined),
    { message: "latitude and longitude must be provided together" },
  );

const addressFields = z.object({
  addressLine1: trimmedOptional(200),
  addressLine2: trimmedOptional(200),
  city: trimmedOptional(80),
  district: trimmedOptional(80),
  state: trimmedOptional(80),
  pincode: trimmedOptional(16),
  phone: trimmedOptional(32),
});

// Country carries a default on create only. On update it must stay a plain
// optional: a default here would silently rewrite a non-IN branch back to "IN"
// on any PATCH that didn't mention country.
const countryField = z.string().trim().length(2).toUpperCase();

export const createLocationSchema = addressFields
  .extend({
    country: countryField.default("IN"),
    branchName: z.string().trim().min(2).max(120),
    isPrimary: z.boolean().default(false),
    status: z
      .enum(["ONBOARDING", "ACTIVE", "INACTIVE", "CLOSED"])
      .default("ONBOARDING"),
  })
  .and(coordinates)
  .refine(
    (v) => v.country !== "IN" || !v.pincode || PINCODE_IN.test(v.pincode),
    { message: "Indian PIN codes are six digits and cannot start with 0" },
  );

export const updateLocationSchema = addressFields
  .partial()
  .extend({
    country: countryField.optional(),
    branchName: z.string().trim().min(2).max(120).optional(),
    isPrimary: z.boolean().optional(),
    status: z.enum(["ONBOARDING", "ACTIVE", "INACTIVE", "CLOSED"]).optional(),
  })
  .and(coordinates)
  .refine(
    (v) => !v.pincode || v.country === undefined || v.country !== "IN" || PINCODE_IN.test(v.pincode),
    { message: "Indian PIN codes are six digits and cannot start with 0" },
  );

export type CreateLocationInput = z.infer<typeof createLocationSchema>;
export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;

/**
 * Provenance for a coordinate pair.
 *
 * Only ever called with coordinates a person supplied through the admin UI, so
 * the answer is PINNED. GEOCODED is reserved for a future batch geocoder
 * running over *complete* structured addresses — it is not something this
 * function can conjure from a form submission.
 */
export function geoStatusForCoordinates(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): LocationGeoStatus {
  return latitude == null || longitude == null
    ? LocationGeoStatus.UNSET
    : LocationGeoStatus.PINNED;
}

/**
 * Did this write lose the race for "the clinic's one primary branch"?
 *
 * Both write paths demote the incumbent and promote the new branch inside a
 * transaction, which is correct in isolation. It is not enough on its own: under
 * READ COMMITTED two concurrent promotions can each read a world where the
 * other's demotion has not landed, and both commit `isPrimary = true`. Two
 * admins on the same clinic, or one double-click, is all it takes.
 *
 * The partial unique index in migrations/20260812_clinic_locations is the
 * actual guarantee — it turns the loser into P2002. This maps that to something
 * the admin UI can act on (409 + "reload and try again") instead of a 500 that
 * reads as a platform fault.
 */
export function isDuplicatePrimaryLocation(err: unknown): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2002") {
    return false;
  }
  // Prisma reports the offending target differently across versions and
  // drivers — sometimes the index name, sometimes the column list. Match either
  // rather than pinning to one shape and silently regressing to a 500 on an
  // upgrade. ClinicLocation carries exactly one unique constraint, so there is
  // nothing else a P2002 on this table could mean.
  const meta = JSON.stringify(err.meta ?? {});
  return (
    meta.includes("ClinicLocation_clinicId_primary_key") || meta.includes("clinicId")
  );
}

/** How far through location setup a clinic is. Drives the Super Admin worklist. */
export type LocationSetupState =
  /** No branch recorded at all. Every pre-S2 clinic starts here. */
  | "NONE"
  /** Branches exist, but none can be plotted — address and/or pin missing. */
  | "INCOMPLETE"
  /** At least one branch is plottable on the national map. */
  | "COMPLETE";

export function locationSetupState(
  locations: ReadonlyArray<{ geoStatus: LocationGeoStatus }>,
): LocationSetupState {
  if (locations.length === 0) return "NONE";
  return locations.some((l) => l.geoStatus !== LocationGeoStatus.UNSET)
    ? "COMPLETE"
    : "INCOMPLETE";
}

/**
 * Is this location complete enough to appear on the national map?
 *
 * Coordinates are the only hard requirement — a pin with a partial address is
 * still a truthful pin. CLOSED branches are excluded: they are history, and
 * plotting them would inflate the national clinic count.
 */
export function isMappable(location: {
  latitude: number | null;
  longitude: number | null;
  status: string;
  deletedAt?: Date | null;
}): boolean {
  return (
    location.latitude != null &&
    location.longitude != null &&
    location.status !== "CLOSED" &&
    !location.deletedAt
  );
}

/**
 * Seed values for a first location, taken from the clinic's legacy free-text
 * address. The text is carried across verbatim into addressLine1 — it is NOT
 * parsed into city/state/pincode, because splitting an Indian address on
 * commas produces plausible-looking wrong answers. A human structures it.
 */
export function seedFromLegacyClinic(clinic: {
  name: string;
  address: string | null;
  phone: string | null;
}): {
  branchName: string;
  addressLine1: string | null;
  phone: string | null;
  country: string;
} {
  return {
    branchName: "Main branch",
    addressLine1: clinic.address?.trim() || null,
    phone: clinic.phone?.trim() || null,
    country: "IN",
  };
}
