"use client";

import { useEffect, useState } from "react";
import { Download, Filter, RotateCcw, Info } from "lucide-react";
import { PageContainer } from "@/components/app-shell";
import { MetricCard } from "@/components/ui/metric-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { FilterBar } from "@/components/ui/filter-bar";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoadingState, ErrorState } from "@/components/ui/states";
import { toast } from "@/components/ui/toast";

type Summary = {
  summary: {
    totalIntents: number;
    totalUnits: number;
    indicativeValueInr: number;
    intentsPriced: number;
    excludedFromValue: number;
    readyForFulfilment: number;
    cancelled: number;
    clinicsRepresented: number;
    statesRepresented: number;
    rowsFlagged: number;
  };
  topStates: Array<{ state: string; intents: number; indicativeValueInr: number }>;
  topClinics: Array<{ clinicId: string; clinicName: string; state: string; intents: number; indicativeValueInr: number }>;
  topKits: Array<{ kitId: string; displayName: string; units: number; indicativeValueInr: number }>;
  options: { states: string[]; clinics: Array<{ id: string; name: string }> };
};

type Filters = {
  from: string;
  to: string;
  state: string;
  clinicId: string;
  status: string;
};

const EMPTY: Filters = { from: "", to: "", state: "", clinicId: "", status: "" };

const inr = (v: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(v);

/** Local datetime-local value → ISO with offset, which the API schema requires. */
function toIso(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function buildQuery(f: Filters): string {
  const p = new URLSearchParams();
  const from = toIso(f.from);
  const to = toIso(f.to);
  if (from) p.set("from", from);
  if (to) p.set("to", to);
  if (f.state) p.set("state", f.state);
  if (f.clinicId) p.set("clinicId", f.clinicId);
  if (f.status) p.set("status", f.status);
  return p.toString();
}

export default function AdminOrdersPage() {
  const [draft, setDraft] = useState<Filters>(EMPTY);
  const [applied, setApplied] = useState<Filters>(EMPTY);
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  // `loading` is DERIVED, not a flag flipped at the top of the effect.
  // Setting state synchronously in an effect body triggers a cascading
  // render; tracking which filter set we have data for gives the same
  // spinner with one render.
  const appliedKey = buildQuery(applied);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const loading = loadedFor !== appliedKey;

  useEffect(() => {
    let cancelled = false;
    // Every setState below happens after an await, so none of them runs
    // synchronously during the effect.
    void (async () => {
      try {
        const r = await fetch(
          `/api/admin/orders${appliedKey ? `?${appliedKey}` : ""}`,
          { cache: "no-store" },
        );
        const j = await r.json();
        if (cancelled) return;
        if (!r.ok) {
          setData(null);
          setError(j.message ?? j.error ?? "Couldn't load orders");
        } else {
          setData(j);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(String(e));
      } finally {
        // Marks this filter set as settled, which clears the derived spinner.
        if (!cancelled) setLoadedFor(appliedKey);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [appliedKey]);

  async function download() {
    setDownloading(true);
    try {
      const q = buildQuery(applied);
      const r = await fetch(`/api/admin/orders/export${q ? `?${q}` : ""}`, {
        cache: "no-store",
      });
      if (!r.ok) {
        // The row-limit refusal carries an actionable message — surface it
        // rather than a generic failure, because the fix is the admin's.
        const j = await r.json().catch(() => null);
        toast.error(j?.message ?? "Export failed");
        return;
      }
      const blob = await r.blob();
      const name =
        r.headers
          .get("content-disposition")
          ?.match(/filename="([^"]+)"/)?.[1] ?? "kit-order-intents.xlsx";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Downloaded ${name}`);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setDownloading(false);
    }
  }

  const s = data?.summary;

  return (
    <PageContainer className="space-y-5">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Kit Order Intents</h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Every doctor-approved consultation creates a kit order intent. This is a
            clinical authorization record, not an invoice — values are indicative.
          </p>
        </div>
        <Button onClick={download} disabled={downloading || !data}>
          <Download />
          {downloading ? "Preparing…" : "Download Excel"}
        </Button>
      </div>

      {/* The single most important thing on this page: say what the numbers
          are NOT, before anyone reconciles them against a bank statement. */}
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
        <Info className="size-4 mt-0.5 shrink-0 text-amber-700" />
        <p className="text-xs text-amber-900">
          <span className="font-medium">Indicative values, not invoiced revenue.</span>{" "}
          This system stores no payment, fulfilment, SKU or discount data. Amounts are
          derived from the ops price sheet and are not receipts. Payment and delivery
          columns are omitted from the workbook rather than estimated.
        </p>
      </div>

      <FilterBar
        onClear={() => {
          setDraft(EMPTY);
          setApplied(EMPTY);
        }}
      >
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-muted-foreground">From</span>
          <input
            type="datetime-local"
            value={draft.from}
            onChange={(e) => setDraft({ ...draft, from: e.target.value })}
            className="h-9 px-2 rounded-lg border border-border bg-background text-sm"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-muted-foreground">To</span>
          <input
            type="datetime-local"
            value={draft.to}
            onChange={(e) => setDraft({ ...draft, to: e.target.value })}
            className="h-9 px-2 rounded-lg border border-border bg-background text-sm"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-muted-foreground">State</span>
          <select
            value={draft.state}
            onChange={(e) => setDraft({ ...draft, state: e.target.value })}
            className="h-9 px-2 rounded-lg border border-border bg-background text-sm min-w-[150px]"
          >
            <option value="">All states</option>
            {data?.options.states.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-muted-foreground">Clinic</span>
          <select
            value={draft.clinicId}
            onChange={(e) => setDraft({ ...draft, clinicId: e.target.value })}
            className="h-9 px-2 rounded-lg border border-border bg-background text-sm min-w-[170px]"
          >
            <option value="">All clinics</option>
            {data?.options.clinics.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-muted-foreground">Intent status</span>
          <select
            value={draft.status}
            onChange={(e) => setDraft({ ...draft, status: e.target.value })}
            className="h-9 px-2 rounded-lg border border-border bg-background text-sm min-w-[170px]"
          >
            <option value="">All statuses</option>
            <option value="READY_FOR_FULFILMENT">Ready for fulfilment</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </label>
        <div className="flex items-end gap-2">
          <Button size="sm" onClick={() => setApplied(draft)}>
            <Filter />
            Apply filters
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setDraft(EMPTY);
              setApplied(EMPTY);
            }}
          >
            <RotateCcw />
            Clear
          </Button>
        </div>
      </FilterBar>

      {error && <ErrorState title="Couldn't load orders" description={error} />}
      {!error && loading && <LoadingState />}

      {!error && !loading && s && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard label="Order intents" value={s.totalIntents} />
            <MetricCard label="Kit units" value={s.totalUnits} />
            <MetricCard
              label="Indicative value"
              value={inr(s.indicativeValueInr)}
              hint={
                s.excludedFromValue > 0
                  ? `${s.intentsPriced} of ${s.totalIntents} intents priced`
                  : "Ops price sheet — not invoiced"
              }
            />
            <MetricCard label="Ready for fulfilment" value={s.readyForFulfilment} />
            <MetricCard label="Cancelled" value={s.cancelled} />
            <MetricCard label="Clinics represented" value={s.clinicsRepresented} />
            <MetricCard label="States represented" value={s.statesRepresented} />
            <MetricCard
              label="Rows flagged"
              value={s.rowsFlagged}
              hint="Data-quality caveats"
            />
          </div>

          <div className="grid lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top states</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.topStates.length === 0 && (
                  <p className="text-sm text-muted-foreground">No intents match.</p>
                )}
                {data.topStates.map((st) => (
                  <div key={st.state} className="flex items-center justify-between gap-3">
                    <span className="text-sm truncate">{st.state}</span>
                    <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                      {st.intents} · {inr(st.indicativeValueInr)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top clinics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.topClinics.length === 0 && (
                  <p className="text-sm text-muted-foreground">No intents match.</p>
                )}
                {data.topClinics.map((c) => (
                  <div key={c.clinicId} className="flex items-center justify-between gap-3">
                    <span className="text-sm truncate">{c.clinicName}</span>
                    <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                      {c.intents} · {inr(c.indicativeValueInr)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top kits</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.topKits.length === 0 && (
                  <p className="text-sm text-muted-foreground">No intents match.</p>
                )}
                {data.topKits.map((k) => (
                  <div key={k.kitId} className="flex items-center justify-between gap-3">
                    <span className="text-sm truncate">{k.displayName}</span>
                    <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                      {k.units} units
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {s.excludedFromValue > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
              <Info className="size-4 mt-0.5 shrink-0 text-amber-700" />
              <p className="text-xs text-amber-900">
                <span className="font-medium">
                  {s.excludedFromValue.toLocaleString()} of{" "}
                  {s.totalIntents.toLocaleString()} order intents are excluded from
                  the indicative value
                </span>{" "}
                because at least one kit on them has no price-sheet entry. Their units
                are still counted. No default rate has been substituted.
              </p>
            </div>
          )}

          {s.rowsFlagged > 0 && (
            <div className="flex items-center gap-2">
              <StatusBadge tone="warning">{s.rowsFlagged} rows flagged</StatusBadge>
              <span className="text-xs text-muted-foreground">
                Missing clinic location, kit absent from the price sheet, or kit with no
                registry entry. Per-row detail is in the workbook.
              </span>
            </div>
          )}
        </>
      )}
    </PageContainer>
  );
}
