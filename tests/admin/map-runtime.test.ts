import { describe, expect, it, vi } from "vitest";
vi.mock("maplibre-gl/dist/maplibre-gl.css", () => ({}));
import { loadMapLibre } from "@/lib/admin/network/mapRuntime";

describe("shared admin map runtime", () => {
  it("configures the same-origin installed-version worker before returning the map library", async () => {
    const library = await loadMapLibre();
    expect(library.getWorkerUrl()).toBe(`/vendor/maplibre/${library.getVersion()}/maplibre-gl-worker.mjs`);
    expect(library.getVersion()).toBe("6.6.0");
  });
});
