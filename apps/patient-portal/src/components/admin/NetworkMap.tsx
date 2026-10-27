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
import { INDIA_BOUNDS, osmRasterStyle } from "@/lib/admin/network/basemap";
import { loadMapLibre } from "@/lib/admin/network/mapRuntime";

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
    let loadTimer: ReturnType<typeof setTimeout> | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let ready = false;

    void (async () => {
      try {
        // maplibre-gl v6 is a namespace, not a default export — `.default`
        // is undefined at runtime and a type error at build.
        const maplibre = await loadMapLibre();
        // The stylesheet ships with the package; importing it here keeps the
        // dependency self-contained rather than editing a global CSS file.
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
          if (cancelled) return;
          ready = true;
          if (loadTimer) {
            clearTimeout(loadTimer);
            loadTimer = null;
          }
          setStatus("ready");
          // A map constructed before its flex/grid container has settled on a
          // size paints into a zero/stale box and reads as blank even though
          // the basemap loaded fine. Forcing a resize on load — and on every
          // container resize below — makes the canvas match the box it is in.
          map.resize();
        });
        // A tile host that is blocked or offline must not leave the panel
        // pretending to load forever. Log the first error for Chrome-console
        // diagnosis (tile host, style, or worker), without per-tile spam.
        let errorLogged = false;
        map.on("error", (e) => {
          if (!errorLogged) {
            errorLogged = true;
            console.warn(
              "[NetworkMap] MapLibre error",
              (e as { error?: unknown })?.error ?? e,
            );
          }
          if (!cancelled) setStatus("failed");
        });

        // Keep the canvas matched to its container as the layout changes
        // (detail panel open/close, viewport resize) without rebuilding the map.
        if (typeof ResizeObserver !== "undefined" && container.current) {
          resizeObserver = new ResizeObserver(() => map.resize());
          resizeObserver.observe(container.current);
        }

        // Bounded load timeout. MapLibre 6 is ESM-only and spawns a separate
        // worker chunk; if that worker fails to initialise under the bundler,
        // neither "load" nor "error" fires and the panel would otherwise sit on
        // "Loading map…" forever — exactly the "blank canvas" symptom. After the
        // timeout we degrade to the honest "Basemap unavailable" state (the
        // clinic list below is unaffected) and log a diagnostic. On a healthy
        // map "load" fires in well under a second, so this never trips.
        loadTimer = setTimeout(() => {
          if (cancelled || ready) return;
          console.warn(
            "[NetworkMap] basemap did not finish loading within 15s — likely a " +
              "MapLibre worker/style initialisation failure. Check the console for " +
              "worker errors and the network tab for tile.openstreetmap.org requests.",
          );
          setStatus((s) => (s === "ready" ? s : "failed"));
        }, 15_000);

        created = map;
        mapRef.current = map;
      } catch (err) {
        console.warn("[NetworkMap] map initialisation threw", err);
        if (!cancelled) setStatus("failed");
      }
    })();

    return () => {
      cancelled = true;
      if (loadTimer) clearTimeout(loadTimer);
      resizeObserver?.disconnect();
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
        <div role="status" className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-muted-foreground">
          Loading map…
        </div>
      )}
      {status === "failed" && (
        // Honest degradation: the page still lists every clinic below, so a
        // blocked tile host costs the picture, not the information.
        <div role="status" className="pointer-events-none absolute inset-0 grid place-items-center bg-background/90 p-6 text-center">
          <div>
            <p className="text-sm font-medium">Basemap unavailable</p>
            <p className="mt-1 text-xs text-muted-foreground">
              The map could not finish loading. Clinic locations are listed below and are
              unaffected.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
