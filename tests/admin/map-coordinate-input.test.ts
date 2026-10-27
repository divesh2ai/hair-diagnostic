import { describe, expect, it } from "vitest";
import { parseCoordinateInput } from "@/lib/admin/network/basemap";

describe("branch pin input", () => {
  it.each(["", "  "])("leaves %j unpinned", input => expect(parseCoordinateInput(input)).toBeNull());
  it.each([",", "19.05,", ",72.82", " , ", "91,72", "19,181", "example coordinates", "NaN,72"])("refuses %j rather than saving a fabricated pin", input => expect(parseCoordinateInput(input)).toBe("invalid"));
  it("retains an explicitly entered coordinate, including valid zero", () => {
    expect(parseCoordinateInput("19.0596, 72.8295")).toEqual({ latitude: 19.0596, longitude: 72.8295 });
    expect(parseCoordinateInput("0,0")).toEqual({ latitude: 0, longitude: 0 });
  });
});
