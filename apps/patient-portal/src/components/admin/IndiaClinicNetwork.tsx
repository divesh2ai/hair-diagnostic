"use client";

// The India clinic network, on the Dashboard.
//
// ── Reuses the existing map, it does not replace it ─────────────────────────
// The canvas is components/admin/NetworkMap — the maplibre component built for
// /admin/network — and the data is the same /api/admin/network snapshot. There
// is one map implementation in this codebase and this is a second consumer of
// it, not a second copy. /admin/network survives as the full-page deep dive.
//
// ── What this can and cannot draw ───────────────────────────────────────────
// A pin requires a coordinate, and the schema never infers one: a coordinate
// is written only when a human pins a branch or a geocoder resolves a complete
// address. State PRESENCE is a weaker and separate fact that comes off the
// address, so the state list works whether or not anything has been pinned.
//
// That distinction is the whole design here. Today every clinic in the network
// has an address and none has a coordinate, so the honest picture is a state
// list that is fully populated beside a map that is empty — and a clear route
// to the screen where that gets fixed. Scattering pins at city centroids would
// make the page look finished and its central claim false.

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { MapPin, AlertTriangle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { NetworkClinic } from "@/lib/admin/network/snapshot";

// maplibre-gl touches `window` at module scope, so it cannot be server
// rendered; ssr:false also keeps the map engine out of the Dashboard's initial
// bundle, which matters more here than on a dedicated map page.
const NetworkMap = dynamic(() => import("@/components/admin/NetworkMap"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full min-h-[360px] w-full place-items-center rounded-xl border border-border bg-muted/40 text-sm text-muted-foreground">
      Loading map…
    </div>
  ),
});

type StateRow = {
  state: string;
  clinics: number;
  branches: number;
  branchesOnMap: number;
  intentsInWindow: number;
  attention: "none" | "watch" | "action";
};

type Payload = {
  windowDays: number;
  totals: {
    clinics: number;
    clinicsOnMap: number;
    clinicsOffMap: number;
    branchesOnMap: number;
    intentsInWindow: number;
    pinnedBranches: number;
    geocodedBranches: number;
  };
  states: StateRow[];
  clinicsWithoutState: number;
  onMap: NetworkClinic[];
  offMap: NetworkClinic[];
  styleUrl: string | null;
};

/**
 * Attention, in words as well as colour.
 *
 * The label is what carries the meaning; the dot is a shorthand for people who
 * already know the palette. A status communicated only by hue is unreadable to
 * anyone who cannot separate the hues.
 */
const ATTENTION: Record<string, { label: string; dot: string; text: string }> = {
  action: { label: "Needs action", dot: "bg-rose-500", text: "text-rose-700" },
  watch: { label: "Watch", dot: "bg-amber-500", text: "text-amber-700" },
  none: { label: "No issues", dot: "bg-emerald-500", text: "text-muted-foreground" },
};

export function IndiaClinicNetwork() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [selectedClinicId, setSelectedClinicId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/network", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j) => {
        if (!cancelled) setData(j);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const allClinics = useMemo(
    () => [...(data?.onMap ?? []), ...(data?.offMap ?? [])],
    [data],
  );

  const clinicsInState = useMemo(
    () =>
      selectedState
        ? allClinics.filter((c) => c.statesPresent.includes(selectedState))
        : [],
    [allClinics, selectedState],
  );

  const selectedClinic = useMemo(
    () => allClinics.find((c) => c.clinicId === selectedClinicId) ?? null,
    [allClinics, selectedClinicId],
  );

  // Selecting a clinic from the map must also move the panel to its state, or
  // the two halves of the section end up describing different things.
  const selectClinic = useCallback(
    (clinicId: string) => {
      setSelectedClinicId(clinicId);
      const clinic = allClinics.find((c) => c.clinicId === clinicId);
      if (clinic?.statesPresent[0]) setSelectedState(clinic.statesPresent[0]);
    },
    [allClinics],
  );

  const reset = useCallback(() => {
    setSelectedState(null);
    setSelectedClinicId(null);
  }, []);

  if (error) {
    return (
      <Section>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong className="font-medium">Couldn&apos;t load the clinic network.</strong>{" "}
          {error}. This is a loading failure, not an empty network.
        </div>
      </Section>
    );
  }

  if (!data) {
    return (
      <Section>
        <div className="h-[360px] rounded-xl border border-border bg-muted/30" />
      </Section>
    );
  }

  const t = data.totals;

  return (
    <Section
      trailing={
        (selectedState || selectedClinicId) && (
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            Reset to India
          </button>
        )
      }
    >
      {/* Roughly two-thirds map, one-third context, but expressed as grid
          fractions rather than fixed widths so it reflows rather than breaks. */}
      <div className="grid gap-4 lg:grid-cols-[1.9fr_1fr]">
        <div className="min-w-0">
          {t.branchesOnMap > 0 ? (
            <div className="h-[420px] overflow-hidden rounded-xl">
              <NetworkMap
                clinics={data.onMap}
                styleUrl={data.styleUrl}
                selectedClinicId={selectedClinicId}
                onSelect={selectClinic}
              />
            </div>
          ) : (
            <NothingPinned
              clinics={t.clinics}
              states={data.states.length}
            />
          )}
        </div>

        {/* One panel, three states: network → state → clinic. */}
        <aside
          aria-label="Clinic network detail"
          className="min-w-0 rounded-xl border border-border bg-card"
        >
          {selectedClinic ? (
            <ClinicPanel
              clinic={selectedClinic}
              windowDays={data.windowDays}
              onBack={() => setSelectedClinicId(null)}
            />
          ) : selectedState ? (
            <StatePanel
              state={selectedState}
              clinics={clinicsInState}
              onSelectClinic={selectClinic}
            />
          ) : (
            <NetworkPanel
              data={data}
              onSelectState={(s) => setSelectedState(s)}
            />
          )}
        </aside>
      </div>
    </Section>
  );
}

function Section({
  children,
  trailing,
}: {
  children: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <section aria-labelledby="network-map-heading">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2
          id="network-map-heading"
          className="text-sm font-semibold tracking-tight"
        >
          India clinic network
        </h2>
        <div className="flex items-center gap-2">
          {trailing}
          <Link
            href="/admin/network"
            className="rounded-sm text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            Full map
          </Link>
        </div>
      </div>
      {children}
    </section>
  );
}

/**
 * What the map shows when no branch has a coordinate.
 *
 * Not a generic empty state: it says which fact is missing, confirms the
 * network data itself is intact, and links to the screen where a pin is added.
 */
function NothingPinned({ clinics, states }: { clinics: number; states: number }) {
  return (
    <div className="flex h-[420px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 text-center">
      <div
        aria-hidden
        className="mb-3 flex size-9 items-center justify-center rounded-md border border-border bg-card text-muted-foreground"
      >
        <MapPin className="size-4" />
      </div>
      <p className="text-sm font-medium">No clinic has been pinned yet</p>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        {clinics} {clinics === 1 ? "clinic is" : "clinics are"} on the platform
        across {states} {states === 1 ? "state" : "states"}, but no branch has a
        coordinate. Positions are never guessed from a city or state name, so
        the map stays empty rather than showing {clinics === 1 ? "it" : "them"}{" "}
        somewhere approximate.
      </p>
      <Link href="/admin/clinics" className="mt-4">
        <Button variant="outline" size="sm">
          Add clinic locations
        </Button>
      </Link>
    </div>
  );
}

/* ───────────────────────────── Panels ───────────────────────────── */

function PanelHeader({
  title,
  subtitle,
  onBack,
}: {
  title: string;
  subtitle: string;
  onBack?: () => void;
}) {
  return (
    <div className="border-b border-border px-4 py-3">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="mb-1.5 inline-flex items-center gap-1 rounded-sm text-xs text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <ArrowLeft className="size-3" aria-hidden />
          Back
        </button>
      )}
      <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
      <p className="text-xs text-muted-foreground">{subtitle}</p>
    </div>
  );
}

function NetworkPanel({
  data,
  onSelectState,
}: {
  data: Payload;
  onSelectState: (state: string) => void;
}) {
  const t = data.totals;
  return (
    <div>
      <PanelHeader
        title="Dr FACT India network"
        subtitle={`${t.clinics} ${t.clinics === 1 ? "clinic" : "clinics"} · ${
          data.states.length
        } ${data.states.length === 1 ? "state" : "states"} · ${
          t.intentsInWindow
        } order intents in ${data.windowDays} days`}
      />
      <ul className="max-h-[330px] divide-y divide-border overflow-y-auto">
        {data.states.length === 0 && (
          <li className="px-4 py-4 text-sm text-muted-foreground">
            No branch records a state yet.
          </li>
        )}
        {data.states.map((s) => (
          <li key={s.state}>
            {/* A button, not a hover target: every state must be reachable by
                keyboard and by tap, not only by a mouse passing over it. */}
            <button
              type="button"
              onClick={() => onSelectState(s.state)}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50"
            >
              <span
                aria-hidden
                className={`size-2 shrink-0 rounded-full ${ATTENTION[s.attention]!.dot}`}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{s.state}</span>
                <span className="block text-xs text-muted-foreground">
                  {s.clinics} {s.clinics === 1 ? "clinic" : "clinics"} ·{" "}
                  {s.branches} {s.branches === 1 ? "branch" : "branches"}
                  {s.branchesOnMap === 0 && s.branches > 0 && " · none pinned"}
                </span>
              </span>
              {s.attention !== "none" && (
                <span className={`shrink-0 text-[11px] ${ATTENTION[s.attention]!.text}`}>
                  {ATTENTION[s.attention]!.label}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
      {data.clinicsWithoutState > 0 && (
        <p className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
          {data.clinicsWithoutState}{" "}
          {data.clinicsWithoutState === 1 ? "clinic records" : "clinics record"} no
          state and {data.clinicsWithoutState === 1 ? "is" : "are"} not counted above.
        </p>
      )}
    </div>
  );
}

function StatePanel({
  state,
  clinics,
  onSelectClinic,
}: {
  state: string;
  clinics: NetworkClinic[];
  onSelectClinic: (id: string) => void;
}) {
  return (
    <div>
      <PanelHeader
        title={state}
        subtitle={`${clinics.length} ${clinics.length === 1 ? "clinic" : "clinics"}`}
      />
      <ul className="max-h-[330px] divide-y divide-border overflow-y-auto">
        {clinics.map((c) => (
          <li key={c.clinicId}>
            <button
              type="button"
              onClick={() => onSelectClinic(c.clinicId)}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50"
            >
              <span
                aria-hidden
                className={`size-2 shrink-0 rounded-full ${
                  ATTENTION[c.attention.level]!.dot
                }`}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{c.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {c.city ?? "City not recorded"} · {c.status}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The clinic panel.
 *
 * Every figure here is a stored count from the snapshot. There is deliberately
 * no doctor count or assessment total: the network endpoint does not return
 * them, and reaching for a plausible-looking number from another payload is
 * how a dashboard starts lying. No patient is named anywhere.
 */
function ClinicPanel({
  clinic,
  windowDays,
  onBack,
}: {
  clinic: NetworkClinic;
  windowDays: number;
  onBack: () => void;
}) {
  const tone = ATTENTION[clinic.attention.level]!;
  return (
    <div className="flex h-full flex-col">
      <PanelHeader
        title={clinic.name}
        subtitle={[clinic.city, clinic.statesPresent.join(", ")]
          .filter(Boolean)
          .join(", ")}
        onBack={onBack}
      />
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        <div className="flex items-center gap-2">
          <span aria-hidden className={`size-2 rounded-full ${tone.dot}`} />
          {/* The state is stated in words; the dot only repeats it. */}
          <span className="text-sm font-medium">{tone.label}</span>
          <span className="ml-auto text-xs text-muted-foreground">{clinic.status}</span>
        </div>

        {clinic.attention.reasons.length > 0 && (
          <ul className="space-y-1 rounded-md border border-border bg-muted/30 px-3 py-2">
            {clinic.attention.reasons.map((r) => (
              <li key={r} className="text-xs text-muted-foreground">
                {r}
              </li>
            ))}
          </ul>
        )}

        <dl className="grid grid-cols-2 gap-2 text-sm">
          <Stat label={`Order intents (${windowDays}d)`} value={clinic.intentsInWindow} />
          <Stat label="Order intents (all time)" value={clinic.intentsTotal} />
          <Stat label="Branches pinned" value={clinic.branches.length} />
          <Stat label="Not pinned" value={clinic.unmappableBranches.length} />
        </dl>

        {clinic.unmappableBranches.length > 0 && (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-700" aria-hidden />
            <p className="text-xs text-amber-900">
              {clinic.unmappableBranches
                .map((b) => `${b.branchName}: ${b.reason}`)
                .join(" · ")}
            </p>
          </div>
        )}
      </div>

      <div className="border-t border-border px-4 py-3">
        {/* A real link to the real management page — not a button that only
            changes state on this screen. */}
        <Link href={`/admin/clinics/${clinic.clinicId}/edit`}>
          <Button variant="outline" size="sm" className="w-full">
            Open clinic
          </Button>
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border px-2.5 py-1.5">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-base font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
