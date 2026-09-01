"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { MapPin, AlertTriangle, Building2 } from "lucide-react";
import { PageContainer } from "@/components/app-shell";
import { MetricCard } from "@/components/ui/metric-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { LoadingState, ErrorState } from "@/components/ui/states";
import type { NetworkClinic } from "@/lib/admin/network/snapshot";

// maplibre-gl touches `window` at module scope, so the map cannot be
// server-rendered. ssr:false is what keeps it out of the server bundle.
const NetworkMap = dynamic(() => import("@/components/admin/NetworkMap"), {
  ssr: false,
  loading: () => (
    <div className="grid h-[520px] w-full place-items-center rounded-xl border border-border bg-muted text-sm text-muted-foreground">
      Loading map…
    </div>
  ),
});

type Payload = {
  generatedAt: string;
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
  states: Array<{ state: string; clinics: number; branches: number; intentsInWindow: number }>;
  onMap: NetworkClinic[];
  offMap: NetworkClinic[];
  styleUrl: string | null;
};

const TONE: Record<string, "danger" | "warning" | "success"> = {
  action: "danger",
  watch: "warning",
  none: "success",
};

export default function AdminNetworkPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch("/api/admin/network", { cache: "no-store" });
        const j = await r.json();
        if (cancelled) return;
        if (!r.ok) setError(j.message ?? j.error ?? "Couldn't load the network");
        else setData(j);
      } catch (e) {
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Action before watch, then most active first. A comparator that ignores
  // its second argument is not a sort — it just shuffles.
  const needsAttention = useMemo(() => {
    const rank: Record<string, number> = { action: 0, watch: 1, none: 2 };
    return [...(data?.onMap ?? []), ...(data?.offMap ?? [])]
      .filter((c) => c.attention.level !== "none")
      .sort(
        (a, b) =>
          rank[a.attention.level]! - rank[b.attention.level]! ||
          b.intentsInWindow - a.intentsInWindow,
      );
  }, [data]);

  if (error) {
    return (
      <PageContainer>
        <ErrorState title="Couldn't load the network" description={error} />
      </PageContainer>
    );
  }
  if (!loaded || !data) {
    return (
      <PageContainer>
        <LoadingState />
      </PageContainer>
    );
  }

  const t = data.totals;

  return (
    <PageContainer className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Clinic network</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Where the network physically is. Marker size shows kit order intents in the
          last {data.windowDays} days; colour shows whether the clinic needs attention.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          icon={<Building2 className="size-4" />}
          label="Clinics on the map"
          value={t.clinicsOnMap}
          hint={`of ${t.clinics} total`}
        />
        <MetricCard
          icon={<MapPin className="size-4" />}
          label="Branches plotted"
          value={t.branchesOnMap}
          hint={`${t.pinnedBranches} pinned · ${t.geocodedBranches} geocoded`}
        />
        <MetricCard
          label={`Order intents (${data.windowDays}d)`}
          value={t.intentsInWindow}
        />
        <MetricCard
          icon={<AlertTriangle className="size-4" />}
          label="Clinics not on the map"
          value={t.clinicsOffMap}
          hint={t.clinicsOffMap > 0 ? "No coordinate recorded" : "All clinics located"}
        />
      </div>

      {t.clinicsOffMap > 0 && (
        // The map's own honesty notice. A coordinate is never inferred, so a
        // clinic without one is genuinely absent from the picture above.
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-700" />
          <p className="text-xs text-amber-900">
            <span className="font-medium">
              {t.clinicsOffMap} clinic{t.clinicsOffMap > 1 ? "s are" : " is"} missing from
              the map
            </span>{" "}
            because no branch has a coordinate. Positions are never guessed from a city
            or state name — those clinics are listed below instead of being plotted
            somewhere approximate.
          </p>
        </div>
      )}

      <NetworkMap
        clinics={data.onMap}
        styleUrl={data.styleUrl}
        selectedClinicId={selected}
        onSelect={setSelected}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">By state</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.states.length === 0 && (
              <p className="text-sm text-muted-foreground">No plotted branches yet.</p>
            )}
            {data.states.map((s) => (
              <div key={s.state} className="flex items-center justify-between gap-3">
                <span className="truncate text-sm">{s.state}</span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {s.branches} branch{s.branches > 1 ? "es" : ""} · {s.intentsInWindow}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Needs attention</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {needsAttention.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Every clinic is located and active.
              </p>
            )}
            {needsAttention.map((c) => (
              <div
                key={c.clinicId}
                className="flex items-start justify-between gap-3 rounded-md p-2 -mx-2 hover:bg-muted"
              >
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => setSelected(c.clinicId)}
                    className="truncate text-sm font-medium hover:underline"
                  >
                    {c.name}
                  </button>
                  <ul className="mt-0.5 space-y-0.5">
                    {c.attention.reasons.map((r) => (
                      <li key={r} className="text-xs text-muted-foreground">
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusBadge tone={TONE[c.attention.level]}>
                    {c.attention.level === "action" ? "Action" : "Watch"}
                  </StatusBadge>
                  <Link href={`/admin/clinics/${c.clinicId}/edit`}>
                    <Button variant="ghost" size="sm">
                      Fix
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {data.offMap.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Not on the map</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.offMap.map((c) => (
              <div key={c.clinicId} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{c.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.unmappableBranches.length === 0
                      ? "No branches recorded at all"
                      : c.unmappableBranches
                          .map((b) => `${b.branchName}: ${b.reason}`)
                          .join(" · ")}
                  </div>
                </div>
                <Link href={`/admin/clinics/${c.clinicId}/edit`}>
                  <Button variant="outline" size="sm">
                    Add a pin
                  </Button>
                </Link>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </PageContainer>
  );
}
