import { copyFile, mkdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const packagePath = require.resolve("maplibre-gl/package.json");
const { version } = JSON.parse(await readFile(packagePath, "utf8"));
const target = path.join(path.dirname(fileURLToPath(import.meta.url)), "../public/vendor/maplibre", version);
await mkdir(target, { recursive: true });
// v6.6's module worker imports this sibling. Copying only the entry still
// produces a grey map, even when the worker entry request returns 200.
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  await copyFile(path.join(path.dirname(packagePath), "dist", file), path.join(target, file));
}
console.log(`MapLibre ${version}: same-origin worker assets prepared`);
