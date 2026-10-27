// One entry point for both admin maps. MapLibre 6's inferred worker URL
// points into the bundler chunk directory, where its sibling is not shipped.
// Serve the installed version's worker AND shared module from the same origin.
export async function loadMapLibre() {
  const maplibre = await import("maplibre-gl");
  maplibre.setWorkerUrl(`/vendor/maplibre/${maplibre.getVersion()}/maplibre-gl-worker.mjs`);
  await import("maplibre-gl/dist/maplibre-gl.css");
  return maplibre;
}
