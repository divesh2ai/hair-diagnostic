// Clinic location rules — the ones that decide whether a marker may exist.
//
// The whole location model rests on a single claim: a coordinate says where a
// real clinic stands, and the platform never makes that claim on a human's
// behalf. These cases pin the parts of that claim which are enforceable in
// code — range validation, the pair rule, provenance, and which branches the
// national map is allowed to draw.
//
// Runner: JEST. `npm test` is vitest and will mis-report this file.
//   npx jest tests/admin/clinic-location.test.ts

import { describe, it, expect } from "@jest/globals";
import {
  createLocationSchema,
  updateLocationSchema,
  geoStatusForCoordinates,
  locationSetupState,
  isMappable,
} from "@/lib/clinic/location";
import { isDrawableCoordinate } from "@/lib/admin/network/basemap";

const base = { branchName: "Bandra West" };

describe("coordinate validation — server side", () => {
  it("accepts a coordinate inside India", () => {
    const r = createLocationSchema.safeParse({
      ...base,
      latitude: 19.0596,
      longitude: 72.8295,
    });
    expect(r.success).toBe(true);
  });

  it.each([
    ["latitude above 90", { latitude: 91, longitude: 72 }],
    ["latitude below -90", { latitude: -90.1, longitude: 72 }],
    ["longitude above 180", { latitude: 19, longitude: 180.5 }],
    ["longitude below -180", { latitude: 19, longitude: -181 }],
  ])("rejects %s", (_label, coords) => {
    expect(createLocationSchema.safeParse({ ...base, ...coords }).success).toBe(false);
  });

  it("rejects a lone latitude", () => {
    // Not a half-known location — a corrupt one. It would pass a null check and
    // then vanish from every bounding-box query without ever erroring.
    expect(
      createLocationSchema.safeParse({ ...base, latitude: 19.0596 }).success,
    ).toBe(false);
  });

  it("rejects a lone longitude", () => {
    expect(
      createLocationSchema.safeParse({ ...base, longitude: 72.8295 }).success,
    ).toBe(false);
  });

  it("accepts a branch with no coordinate at all", () => {
    // Saving an address without a pin is the normal path, not an error state.
    expect(createLocationSchema.safeParse(base).success).toBe(true);
  });

  it("applies the same range rules on update", () => {
    expect(updateLocationSchema.safeParse({ latitude: 91, longitude: 0 }).success).toBe(
      false,
    );
    expect(
      updateLocationSchema.safeParse({ latitude: 19.07, longitude: 72.87 }).success,
    ).toBe(true);
  });

  it("rejects a malformed Indian PIN code", () => {
    expect(
      createLocationSchema.safeParse({ ...base, country: "IN", pincode: "012345" })
        .success,
    ).toBe(false);
    expect(
      createLocationSchema.safeParse({ ...base, country: "IN", pincode: "400050" })
        .success,
    ).toBe(true);
  });
});

describe("provenance — a pin is never inferred", () => {
  it("marks an admin-supplied coordinate PINNED", () => {
    expect(geoStatusForCoordinates(19.0596, 72.8295)).toBe("PINNED");
  });

  it("marks a missing coordinate UNSET, never GEOCODED", () => {
    // GEOCODED is reserved for a resolver over complete structured addresses.
    // Nothing in the form path may produce it, because nothing in the form path
    // resolves an address — it would be a claim with no source.
    expect(geoStatusForCoordinates(null, null)).toBe("UNSET");
    expect(geoStatusForCoordinates(19.0596, null)).toBe("UNSET");
    expect(geoStatusForCoordinates(null, 72.8295)).toBe("UNSET");
  });
});

describe("which branches the map may draw", () => {
  const at = { latitude: 19.0596, longitude: 72.8295, status: "ACTIVE", deletedAt: null };

  it("draws a branch with coordinates", () => {
    expect(isMappable(at)).toBe(true);
  });

  it("refuses a branch with no coordinates, however complete its address", () => {
    expect(isMappable({ ...at, latitude: null, longitude: null })).toBe(false);
  });

  it("refuses a closed branch", () => {
    // History. Plotting it would inflate the national clinic count.
    expect(isMappable({ ...at, status: "CLOSED" })).toBe(false);
  });

  it("refuses a soft-deleted branch", () => {
    expect(isMappable({ ...at, deletedAt: new Date() })).toBe(false);
  });
});

describe("client-side coordinate guard", () => {
  it("accepts a valid pair", () => {
    expect(isDrawableCoordinate(19.0596, 72.8295)).toBe(true);
  });

  it.each([
    ["nulls", null, null],
    ["NaN", NaN, 72.8295],
    ["Infinity", 19.0596, Infinity],
    ["latitude out of range", 91, 72.8295],
    ["longitude out of range", 19.0596, 181],
  ])("refuses %s rather than handing it to the map engine", (_l, lat, lng) => {
    // maplibre places NaN silently rather than throwing, so a bad row predating
    // the schema would otherwise appear as a marker somewhere meaningless.
    expect(isDrawableCoordinate(lat as number, lng as number)).toBe(false);
  });
});

describe("location setup state — drives the worklist and the badges", () => {
  it("reports NONE when a clinic has no branch at all", () => {
    expect(locationSetupState([])).toBe("NONE");
  });

  it("reports INCOMPLETE when branches exist but none is located", () => {
    // The live staging shape on 2026-09-01: full addresses, no pins.
    expect(
      locationSetupState([{ geoStatus: "UNSET" }, { geoStatus: "UNSET" }] as never),
    ).toBe("INCOMPLETE");
  });

  it("reports COMPLETE as soon as one branch is located", () => {
    expect(
      locationSetupState([{ geoStatus: "UNSET" }, { geoStatus: "PINNED" }] as never),
    ).toBe("COMPLETE");
  });

  it("counts a geocoded branch as located too", () => {
    expect(locationSetupState([{ geoStatus: "GEOCODED" }] as never)).toBe("COMPLETE");
  });
});
