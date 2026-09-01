"use client";

// Place a clinic on the map.
//
// ── Why this exists ─────────────────────────────────────────────────────────
// The locations panel already collected an address and then asked the admin to
// paste "latitude, longitude" copied out of Google Maps. That works, but it
// makes the least human part of the record the primary interface, and it gives
// the admin no way to check that the number they pasted is actually where the
// clinic stands. This is the confirmation step: look at the map, click the
// building, confirm.
//
// ── What it will not do ─────────────────────────────────────────────────────
// It does not geocode. There is no geocoding provider in this repository, and
// adding one is a paid external dependency and a decision about sending clinic
// addresses to a third party — not something to slip in behind a form field.
// So the coordinate here is always PINNED: a human looked at the map and said
// "there". Nothing infers a position from a city, a PIN code or a state, which
// is the one rule the whole location model is built around.
//
// The map centres on India, or on the existing pin when there is one. It never
// centres on "the city the address mentions", because doing that would put a
// marker under the admin's cursor at a place the platform guessed.

import { useCallback, useEffect, useRef, useState } from "react";
import { MapPin, Trash2 } from "lucide-react";
import { INDIA_BOUNDS, osmRasterStyle } from "@/lib/admin/network/basemap";

export type PickerValue = { latitude: number; longitude: number } | null;

/** Five decimal places is about a metre — far finer than a clinic frontage. */
function fmt(n: number): string {
  return n.toFixed(5);
}

export default function LocationPicker({
  value,
  onChange,
  styleUrl,
}: {
  value: PickerValue;
  onChange: (next: PickerValue) => void;
  styleUrl?: string | null;
}) {
  const container = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<unknown>(null);
  const markerRef = useRef<{ setLngLat: (c: [number, number]) => unknown; remove: () => void } | null>(
    null,
  );
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");

  // onChange arrives fresh on every parent render; holding it in a ref keeps it
  // out of the map's dependency array, so a keystroke elsewhere in the form
  // cannot tear the map down and rebuild it under the admin.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // The pin the map was built with. Later changes are pushed to the marker by
  // the second effect rather than by recreating the map.
  const initial = useRef(value);

  useEffect(() => {
    let cancelled = false;
    let created: import("maplibre-gl").Map | null = null;

    void (async () => {
      try {
        // maplibre-gl touches `window` at module scope, so it is imported here
        // rather than at the top of the file.
        const maplibre = await import("maplibre-gl");
        await import("maplibre-gl/dist/maplibre-gl.css");
        if (cancelled || !container.current) return;

        const start = initial.current;
        const map = new maplibre.Map({
          container: container.current,
          style: styleUrl ?? osmRasterStyle(),
          ...(start
            ? { center: [start.longitude, start.latitude] as [number, number], zoom: 15 }
            : { bounds: INDIA_BOUNDS, fitBoundsOptions: { padding: 24 } }),
          attributionControl: { compact: true },
        });
        map.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");

        // Click to place. Pan and zoom keep working normally — this is a
        // picker, not a drawing tool.
        map.on("click", (e) => {
          const next = { latitude: e.lngLat.lat, longitude: e.lngLat.lng };
          onChangeRef.current(next);
        });
        map.on("load", () => {
          if (!cancelled) setStatus("ready");
        });
        map.on("error", () => {
          // A blocked tile host must not leave this pretending to load. The
          // numeric fields below stay usable, so the branch is still savable.
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
      markerRef.current?.remove();
      markerRef.current = null;
      created?.remove();
      mapRef.current = null;
    };
  }, [styleUrl]);

  // Marker follows `value`, wherever the change came from — a map click, the
  // numeric fields, or the parent loading a branch to edit.
  useEffect(() => {
    const map = mapRef.current as import("maplibre-gl").Map | null;
    if (!map || status !== "ready") return;

    let cancelled = false;
    void (async () => {
      const maplibre = await import("maplibre-gl");
      if (cancelled) return;

      if (!value) {
        markerRef.current?.remove();
        markerRef.current = null;
        return;
      }
      const at: [number, number] = [value.longitude, value.latitude];
      if (markerRef.current) {
        markerRef.current.setLngLat(at);
      } else {
        // Draggable, so a click that lands a few metres off can be nudged
        // without hunting for the exact pixel.
        const marker = new maplibre.Marker({ color: "#0e2a47", draggable: true })
          .setLngLat(at)
          .addTo(map);
        marker.on("dragend", () => {
          const p = marker.getLngLat();
          onChangeRef.current({ latitude: p.lat, longitude: p.lng });
        });
        markerRef.current = marker;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [value, status]);

  // maplibre sizes its canvas once, at creation, and does not watch its
  // container. Without this the map keeps its original width when the layout
  // changes around it — rotating a phone, or opening the form on a wide screen
  // and then narrowing it — and the visible map is cropped rather than refit.
  // The container clips, so this never overflowed the page; it just quietly
  // showed the wrong part of India.
  useEffect(() => {
    const el = container.current;
    if (!el || status !== "ready") return;
    const observer = new ResizeObserver(() => {
      (mapRef.current as import("maplibre-gl").Map | null)?.resize();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [status]);

  const recentre = useCallback(() => {
    const map = mapRef.current as import("maplibre-gl").Map | null;
    if (!map || !value) return;
    map.flyTo({ center: [value.longitude, value.latitude], zoom: 15 });
  }, [value]);

  return (
    <div className="space-y-2">
      <div className="relative h-[280px] overflow-hidden rounded-lg border border-border bg-muted">
        <div ref={container} className="absolute inset-0" />
        {status === "loading" && (
          <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">
            Loading map…
          </div>
        )}
        {status === "failed" && (
          <div className="absolute inset-0 grid place-items-center px-4 text-center">
            <div>
              <p className="text-sm font-medium">Basemap unavailable</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Tiles could not be reached. You can still enter coordinates below
                and save the branch.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* The map is the primary interface. The typed "latitude, longitude"
          field lives in the panel beside this and writes the same state, so
          there is one value and two ways to reach it — never two editors that
          can disagree. */}
      {value && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={recentre}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-sm hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <MapPin className="size-3.5" aria-hidden />
            Centre on pin
          </button>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-sm hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <Trash2 className="size-3.5" aria-hidden />
            Remove pin
          </button>
        </div>
      )}

      {/* The state of the pin, in words. A marker somewhere on a map is not by
          itself an answer to "is this branch located yet?". */}
      <p aria-live="polite" className="text-xs text-muted-foreground">
        {value ? (
          <>
            Pinned at{" "}
            <span className="font-mono">
              {fmt(value.latitude)}, {fmt(value.longitude)}
            </span>
            . Saving records this as confirmed by you, not derived from the
            address.
          </>
        ) : (
          <>
            No pin yet. Click the map where the clinic stands, or type the
            coordinates. Leave it empty to save the address without putting this
            branch on the national map.
          </>
        )}
      </p>
    </div>
  );
}
