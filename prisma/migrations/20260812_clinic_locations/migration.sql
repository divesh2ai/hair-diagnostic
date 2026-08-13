-- Clinic locations (S2).
--
-- Introduces the physical-branch model the national operations map is built
-- on: one Clinic organisation -> one or more ClinicLocations.
--
-- Kept as an independent migration unit from 20260812_patient_mobile_identity.
-- The two changes share no tables and must be reviewable, appliable and
-- revertible on their own.
--
-- ── Backfill: deliberately none ──────────────────────────────────────────────
-- Existing clinics hold a single free-text `Clinic.address` and a `region`
-- column that is defaulted to the literal 'IN'. There is no city, district,
-- state or pincode anywhere in the current schema, so there is no reliable
-- structured value to promote into a location row, and no coordinate that
-- could be derived without inventing one.
--
-- Parsing free-text Indian addresses into components is guesswork, and a
-- guessed pincode or a geocode of an incomplete address puts a clinic on the
-- national map in the wrong place — worse than an absent pin, because it looks
-- authoritative.
--
-- So: no INSERT here. Existing clinics start with zero locations and surface
-- as `locationSetup: "NONE"` in the admin API — a Super Admin worklist. The
-- legacy free-text address is preserved untouched on Clinic and is pre-filled
-- into the location form for a human to structure and pin.

CREATE TYPE "ClinicLocationStatus" AS ENUM ('ONBOARDING', 'ACTIVE', 'INACTIVE', 'CLOSED');
CREATE TYPE "LocationGeoStatus" AS ENUM ('UNSET', 'PINNED', 'GEOCODED');

CREATE TABLE "ClinicLocation" (
    "id"           TEXT NOT NULL,
    "clinicId"     TEXT NOT NULL,
    "branchName"   TEXT NOT NULL,
    "isPrimary"    BOOLEAN NOT NULL DEFAULT false,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city"         TEXT,
    "district"     TEXT,
    "state"        TEXT,
    "pincode"      TEXT,
    "country"      TEXT NOT NULL DEFAULT 'IN',
    "latitude"     DOUBLE PRECISION,
    "longitude"    DOUBLE PRECISION,
    "geoStatus"    "LocationGeoStatus" NOT NULL DEFAULT 'UNSET',
    "geocodedAt"   TIMESTAMP(3),
    "status"       "ClinicLocationStatus" NOT NULL DEFAULT 'ONBOARDING',
    "phone"        TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    "deletedAt"    TIMESTAMP(3),

    CONSTRAINT "ClinicLocation_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ClinicLocation"
    ADD CONSTRAINT "ClinicLocation_clinicId_fkey"
    FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- A coordinate pair is all-or-nothing. Half a pin is not a location, and a
-- lone latitude would silently drop a clinic out of every bounding-box query.
ALTER TABLE "ClinicLocation"
    ADD CONSTRAINT "ClinicLocation_coordinates_paired"
    CHECK (("latitude" IS NULL) = ("longitude" IS NULL));

-- Coordinates must be real coordinates. Cheap insurance against a swapped
-- lat/lng pair or a transposed digit reaching the map.
ALTER TABLE "ClinicLocation"
    ADD CONSTRAINT "ClinicLocation_coordinates_in_range"
    CHECK (
        ("latitude" IS NULL OR ("latitude" >= -90 AND "latitude" <= 90))
        AND ("longitude" IS NULL OR ("longitude" >= -180 AND "longitude" <= 180))
    );

-- geoStatus is a claim about provenance; it must not outrun the data. UNSET
-- means no coordinates, and PINNED/GEOCODED both require them.
ALTER TABLE "ClinicLocation"
    ADD CONSTRAINT "ClinicLocation_geostatus_matches_coordinates"
    CHECK (
        ("geoStatus" = 'UNSET' AND "latitude" IS NULL)
        OR ("geoStatus" <> 'UNSET' AND "latitude" IS NOT NULL)
    );

-- ── One primary branch per clinic, guaranteed by the database ───────────────
-- The API demotes-then-promotes inside a transaction, but on READ COMMITTED two
-- concurrent promotions can each read a world where the other's demotion has
-- not landed, and both commit `isPrimary = true`. Nothing about that is exotic:
-- two Super Admins on the same clinic, or one double-clicking, is enough.
--
-- The result would be a clinic with two default branches and a QR that routes
-- non-deterministically. A partial unique index makes the second write fail
-- (23505 -> Prisma P2002) instead, which the routes translate to a 409.
--
-- Predicate notes:
--   * `deletedAt IS NULL` — retired branches keep their rows for operational
--     history and must not hold the primary slot hostage. (DELETE also clears
--     isPrimary, so this is belt and braces.)
--   * status is deliberately NOT in the predicate. A CLOSED-but-not-deleted
--     branch that is still flagged primary is exactly the state that should
--     block a second primary: the clinic has one default branch and it happens
--     to be shut. Promoting another demotes it first, so the ordinary path is
--     unaffected.
--
-- No pre-check for existing violations: this migration creates the table.
CREATE UNIQUE INDEX "ClinicLocation_clinicId_primary_key"
    ON "ClinicLocation" ("clinicId")
    WHERE "isPrimary" = true AND "deletedAt" IS NULL;

CREATE INDEX "ClinicLocation_clinicId_idx"            ON "ClinicLocation"("clinicId");
CREATE INDEX "ClinicLocation_clinicId_status_idx"     ON "ClinicLocation"("clinicId", "status");
CREATE INDEX "ClinicLocation_country_state_city_idx"  ON "ClinicLocation"("country", "state", "city");
CREATE INDEX "ClinicLocation_latitude_longitude_idx"  ON "ClinicLocation"("latitude", "longitude");
CREATE INDEX "ClinicLocation_geoStatus_idx"           ON "ClinicLocation"("geoStatus");
