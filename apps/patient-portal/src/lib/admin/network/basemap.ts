// The basemap every admin map shares.
//
// Extracted from components/admin/NetworkMap when the clinic location picker
// became a second consumer. It is deliberately the whole definition rather
// than a colour or two: two maps in one product that disagree about their
// basemap is a drift bug waiting to happen, and the national map and the
// picker must show a clinic against exactly the same ground.
//
// No API key and no vendor account — the style is built inline from OSM raster
// tiles. A deployment that wants its own tiles sets NEXT_PUBLIC_MAP_STYLE_URL,
// which is a URL and never a credential.

/** Continental India, so a fresh map opens on the network, not the globe. */
export const INDIA_BOUNDS: [[number, number], [number, number]] = [
  [67.0, 6.5],
  [98.5, 36.5],
];

/**
 * Inline OSM raster style. Typed loosely on purpose: maplibre's StyleSpecification
 * is only available once the library has been dynamically imported, and this
 * module must stay importable from the server.
 */
export function osmRasterStyle() {
  return {
    version: 8 as const,
    sources: {
      osm: {
        type: "raster" as const,
        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        attribution: "© OpenStreetMap contributors",
      },
    },
    layers: [{ id: "osm", type: "raster" as const, source: "osm" }],
  };
}

/**
 * Is this a coordinate pair we are willing to draw?
 *
 * The server validates the same ranges through the zod schema in
 * lib/clinic/location; this is the client-side guard so a bad row that predates
 * that validation — or arrives from anywhere else — is dropped rather than
 * handed to maplibre, which silently places NaN somewhere off the map.
 */
export function isDrawableCoordinate(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): latitude is number {
  return (
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}
