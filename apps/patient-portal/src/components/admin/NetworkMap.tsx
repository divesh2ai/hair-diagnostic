"use client";

// The national clinic map.
//
// ── Why the library loads at runtime, not at import ─────────────────────────
// maplibre-gl reaches for `window` at module scope, so a top-level import
// breaks the server render of any page that includes it. It is pulled in
// inside an effect instead, which also keeps ~250KB of map engine out of the
// initial bundle for a page most admins open occasionally.
//
// ── Why a raster basemap ────────────────────────────────────────────────────
// The default style is built inline from OSM raster tiles rather than fetched
// from a style server, so the page has no API key and no vendor account to
// keep alive. A deployment that wants its own tiles sets
// NEXT_PUBLIC_MAP_STYLE_URL and this component uses that instead.
//
// ── What is drawn ──────────────────────────────────────────────────────────
// Only branches that carry a real coordinate. Nothing here approximates a
// position from a city or state name — clinics without a pin are listed
// beside the map by the page, not scattered onto it.

import { useEffect, useRef, useState } from "react";
import type { NetworkClinic } from "@/lib/admin/network/snapshot";

export type NetworkMapProps = {
  clinics: NetworkClinic[];
  styleUrl: string | null;
  selectedClinicId: string | null;
  onSelect: (clinicId: string) => void;
};

/** Semantic marker colours — same meanings the admin console uses elsewhere. */
const ATTENTION_COLOR: Record<string, string> = {
  action: "#b91c1c",
  watch: "#b45309",
  none: "#117a79",
};

/** Continental India, so the first paint is the network rather than the globe. */
const INDIA_BOUNDS: [[number, number], [number, number]] = [
  [67.0, 6.5],
  [98.5, 36.5],
];

function osmRasterStyle() {
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

export default function NetworkMap({
  clinics,
  styleUrl,
  selectedClinicId,
  onSelect,
}: NetworkMapProps) {
  const container = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<unknown>(null);
  const markersRef = useRef<Array<{ remove: () => void }>>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");

  // Create the map once. Markers are managed by the second effect so a data
  // refresh never tears down and rebuilds the canvas under the user.
  useEffect(() => {
    let cancelled = false;
    let created: import("maplibre-gl").Map | null = null;

    void (async () => {
      try {
        // maplibre-gl v6 is a namespace, not a default export — `.default`
        // is undefined at runtime and a type error at build.
        const maplibre = await import("maplibre-gl");
        // The stylesheet ships with the package; importing it here keeps the
        // dependency self-contained rather than editing a global CSS file.
        await import("maplibre-gl/dist/maplibre-gl.css");
        if (cancelled || !container.current) return;

        // Held in a local const so TypeScript keeps the non-null narrowing
        // inside the callbacks below.
        const map = new maplibre.Map({
          container: container.current,
          style: styleUrl ?? osmRasterStyle(),
          bounds: INDIA_BOUNDS,
          fitBoundsOptions: { padding: 40 },
          attributionControl: { compact: true },
        });
        map.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
        map.on("load", () => {
          if (!cancelled) setStatus("ready");
        });
        // A tile host that is blocked or offline must not leave the panel
        // pretending to load forever.
        map.on("error", () => {
          if (!cancelled) setStatus((s) => (s === "ready" ? s : "failed"));
        });
        created = map;
        mapRef.current = map;
      } catch {
        if (!cancelled) setStatus("failed");
      }
    })();

    return () => {
      cancelled = true;
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      created?.remove();
      mapRef.current = null;
    };
  }, [styleUrl]);

  // Markers, rebuilt when the data or the selection changes.
  useEffect(() => {
    const map = mapRef.current as import("maplibre-gl").Map | null;
    if (!map || status !== "ready") return;

    let cancelled = false;
    void (async () => {
      const maplibre = await import("maplibre-gl");
      if (cancelled) return;

      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      const volumes = clinics.map((c) => c.intentsInWindow);
      const peak = Math.max(1, ...volumes);

      for (const clinic of clinics) {
        for (const branch of clinic.branches) {
          // Radius carries order-intent volume; colour carries attention.
          // Area is proportional to volume rather than radius, so a clinic
          // with twice the intents does not look four times as large.
          const scale = Math.sqrt(clinic.intentsInWindow / peak);
          const size = 14 + Math.round(scale * 22);
          const selected = clinic.clinicId === selectedClinicId;

          const el = document.createElement("button");
          el.type = "button";
          el.setAttribute(
            "aria-label",
            `${clinic.name} — ${branch.branchName}, ${clinic.intentsInWindow} order intents`,
          );
          el.style.cssText = [
            `width:${size}px`,
            `height:${size}px`,
            "border-radius:9999px",
            "cursor:pointer",
            "padding:0",
            `background:${ATTENTION_COLOR[clinic.attention.level] ?? ATTENTION_COLOR.none}`,
            `border:${selected ? "3px solid #0e2a47" : "2px solid rgba(255,255,255,0.9)"}`,
            `box-shadow:0 1px 6px rgba(15,23,42,${selected ? "0.55" : "0.35"})`,
            // A geocoded pin is a derived position; a human-placed one is not.
            // Dashing the former keeps that distinction visible on the map.
            branch.geoStatus === "GEOCODED" ? "border-style:dashed" : "",
          ].join(";");
          el.addEventListener("click", () => onSelect(clinic.clinicId));

          const marker = new maplibre.Marker({ element: el })
            .setLngLat([branch.longitude, branch.latitude])
            .setPopup(
              new maplibre.Popup({ offset: 14, closeButton: false }).setText(
                `${clinic.name} — ${branch.branchName}` +
                  (branch.city ? `, ${branch.city}` : "") +
                  ` · ${clinic.intentsInWindow} intents`,
              ),
            )
            .addTo(map);
          markersRef.current.push(marker);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clinics, selectedClinicId, status, onSelect]);

  return (
    <div className="relative h-[520px] w-full overflow-hidden rounded-xl border border-border bg-muted">
      <div ref={container} className="absolute inset-0" />
      {status === "loading" && (
        <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">
          Loading map…
        </div>
      )}
      {status === "failed" && (
        // Honest degradation: the page still lists every clinic below, so a
        // blocked tile host costs the picture, not the information.
        <div className="absolute inset-0 grid place-items-center p-6 text-center">
          <div>
            <p className="text-sm font-medium">Basemap unavailable</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Tiles could not be reached. Clinic locations are listed below and are
              unaffected.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
