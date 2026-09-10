"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  Search,
  Download,
  FileSpreadsheet,
  ChevronDown,
  ChevronRight,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { PageContainer } from "@/components/app-shell";
import { useHydrated } from "@/lib/format/useHydrated";
import { OrderTabs } from "../OrderTabs";
import {
  formatInr,
  formatInrCompact,
  formatAgeGender,
  deltaLines,
  deltaSummary,
  systemRecommendedText,
  kitListText,
} from "@/lib/doctor/orderSummary/present";
import type {
  SummaryRow,
  SummaryMetrics,
  DoctorOption,
} from "@/lib/doctor/orderSummary/query";
import "@/styles/doctor-tokens.css";

// PATIENT ORDER SUMMARY — the clinic's single source of truth for what each
// patient presented with, what HairOS recommended, what the doctor changed, and
// what was finally ordered and what it was worth. This is a reporting/audit
// surface, NOT the clinical review workspace: one row per finalized order,
// filterable by period, exportable to CSV/Excel with the same semantics.

// The JSON row: identical to the server SummaryRow except createdAt is an ISO
// string after serialization.
type Row = Omit<SummaryRow, "createdAt"> & { createdAt: string };

interface SummaryResponse {
  rows: Row[];
  metrics: SummaryMetrics;
  doctors: DoctorOption[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  generatedAt: string;
  filters: Record<string, unknown>;
}

type SortKey = "date" | "patient" | "total";
type SortDir = "asc" | "desc";

// ── Date helpers ─────────────────────────────────────────────────────────────

function toDateInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** A yyyy-mm-dd input value → ISO at start (from) or end (to) of that day. */
function dayBoundaryIso(value: string, edge: "start" | "end"): string | undefined {
  if (!value) return undefined;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  const date =
    edge === "start"
      ? new Date(y, m - 1, d, 0, 0, 0, 0)
      : new Date(y, m - 1, d, 23, 59, 59, 999);
  return date.toISOString();
}

function isoToDateInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return toDateInput(d);
}

function monthStart(): string {
  const now = new Date();
  return toDateInput(new Date(now.getFullYear(), now.getMonth(), 1));
}

function today(): string {
  return toDateInput(new Date());
}

// ── Presets ──────────────────────────────────────────────────────────────────

const PRESETS: { label: string; range: () => [string, string] }[] = [
  { label: "Today", range: () => [today(), today()] },
  {
    label: "Last 7 days",
    range: () => {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 6);
      return [toDateInput(from), toDateInput(to)];
    },
  },
  { label: "This month", range: () => [monthStart(), today()] },
  {
    label: "Last month",
    range: () => {
      const now = new Date();
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      return [toDateInput(first), toDateInput(last)];
    },
  },
];

// ── Page ─────────────────────────────────────────────────────────────────────

export default function PatientOrderSummaryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hydrated = useHydrated();

  // Filters read from the URL so a filtered report is shareable / reload-safe.
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const from = fromParam ? isoToDateInput(fromParam) : monthStart();
  const to = toParam ? isoToDateInput(toParam) : today();
  const doctorId = searchParams.get("doctor") ?? "";
  const status = searchParams.get("status") ?? "";
  const search = searchParams.get("search") ?? "";
  const sort = (searchParams.get("sort") as SortKey) ?? "date";
  const dir = (searchParams.get("dir") as SortDir) ?? "desc";
  const page = Number(searchParams.get("page") ?? "1") || 1;

  const [data, setData] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchDraft, setSearchDraft] = useState(search);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Build the API query string from the current URL-driven filters.
  const apiQuery = useMemo(() => {
    const qs = new URLSearchParams();
    const fromIso = dayBoundaryIso(from, "start");
    const toIso = dayBoundaryIso(to, "end");
    if (fromIso) qs.set("from", fromIso);
    if (toIso) qs.set("to", toIso);
    if (doctorId) qs.set("doctorId", doctorId);
    if (status) qs.set("status", status);
    if (search) qs.set("search", search);
    qs.set("sort", sort);
    qs.set("dir", dir);
    qs.set("page", String(page));
    return qs.toString();
  }, [from, to, doctorId, status, search, sort, dir, page]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/doctor/orders/summary?${apiQuery}`)
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body?.message ?? "load_failed");
        return body as SummaryResponse;
      })
      .then((body) => {
        if (!cancelled) setData(body);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message || "We couldn't load this order summary.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiQuery]);

  // Update the URL (and therefore filters) without a full navigation.
  const setParams = useCallback(
    (updates: Record<string, string | null>, resetPage = true) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v === null || v === "") next.delete(k);
        else next.set(k, v);
      }
      if (resetPage) next.delete("page");
      router.replace(`/doctor/orders/summary?${next.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const applyPreset = (label: string) => {
    const preset = PRESETS.find((p) => p.label === label);
    if (!preset) return;
    const [f, t] = preset.range();
    setParams({
      from: dayBoundaryIso(f, "start") ?? null,
      to: dayBoundaryIso(t, "end") ?? null,
    });
  };

  const onSort = (key: SortKey) => {
    if (sort === key) {
      setParams({ dir: dir === "asc" ? "desc" : "asc" }, false);
    } else {
      setParams({ sort: key, dir: key === "patient" ? "asc" : "desc" }, false);
    }
  };

  const rangeInvalid = from && to && from > to;

  const exportHref = (format: "csv" | "xlsx") => {
    const qs = new URLSearchParams();
    const fromIso = dayBoundaryIso(from, "start");
    const toIso = dayBoundaryIso(to, "end");
    if (fromIso) qs.set("from", fromIso);
    if (toIso) qs.set("to", toIso);
    if (doctorId) qs.set("doctorId", doctorId);
    if (status) qs.set("status", status);
    if (search) qs.set("search", search);
    qs.set("sort", sort);
    qs.set("dir", dir);
    qs.set("format", format);
    return `/api/doctor/orders/summary/export?${qs.toString()}`;
  };

  const hasRows = (data?.rows.length ?? 0) > 0;

  return (
    <PageContainer className="max-w-[1400px]">
      <div data-surface="doctor" className="space-y-5">
        {/* Header */}
        <div>
          <h1 className="hd-headline">Patient order summary</h1>
          <p className="hd-label mt-1 max-w-prose">
            Clinical recommendations, doctor adjustments and final patient orders
            for your clinic.
          </p>
        </div>

        <OrderTabs />

        {/* Filter bar */}
        <div className="hd-card p-3 sm:p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="from" className="hd-eyebrow">
                From
              </label>
              <input
                id="from"
                type="date"
                value={from}
                max={to || undefined}
                onChange={(e) =>
                  setParams({ from: dayBoundaryIso(e.target.value, "start") ?? null })
                }
                className="rounded-lg border border-[color:var(--hd-border)] bg-[color:var(--hd-surface)] px-3 py-2 text-sm outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="to" className="hd-eyebrow">
                To
              </label>
              <input
                id="to"
                type="date"
                value={to}
                min={from || undefined}
                onChange={(e) =>
                  setParams({ to: dayBoundaryIso(e.target.value, "end") ?? null })
                }
                className="rounded-lg border border-[color:var(--hd-border)] bg-[color:var(--hd-surface)] px-3 py-2 text-sm outline-none"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => applyPreset(p.label)}
                  className="hd-btn hd-btn-secondary !px-2.5 !py-1.5 !text-xs"
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="doctor" className="hd-eyebrow">
                Doctor
              </label>
              <select
                id="doctor"
                value={doctorId}
                onChange={(e) => setParams({ doctor: e.target.value || null })}
                className="rounded-lg border border-[color:var(--hd-border)] bg-[color:var(--hd-surface)] px-3 py-2 text-sm outline-none"
              >
                <option value="">All doctors</option>
                {(data?.doctors ?? []).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="status" className="hd-eyebrow">
                Status
              </label>
              <select
                id="status"
                value={status}
                onChange={(e) => setParams({ status: e.target.value || null })}
                className="rounded-lg border border-[color:var(--hd-border)] bg-[color:var(--hd-surface)] px-3 py-2 text-sm outline-none"
              >
                <option value="">All statuses</option>
                <option value="READY_FOR_FULFILMENT">Ready for fulfilment</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            <form
              className="relative min-w-[220px] flex-1"
              onSubmit={(e) => {
                e.preventDefault();
                setParams({ search: searchDraft.trim() || null });
              }}
            >
              <label htmlFor="search" className="hd-eyebrow">
                Search
              </label>
              <Search
                className="pointer-events-none absolute left-3 top-[34px] size-4 text-[color:var(--hd-text-muted)]"
                aria-hidden
              />
              <input
                id="search"
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                onBlur={() => setParams({ search: searchDraft.trim() || null })}
                placeholder="Patient, doctor or kit"
                className="mt-1 w-full rounded-lg border border-[color:var(--hd-border)] bg-[color:var(--hd-surface)] py-2 pl-9 pr-3 text-sm outline-none"
              />
            </form>
          </div>

          {rangeInvalid && (
            <p className="mt-2 text-xs font-medium text-[color:var(--hd-critical)]">
              The From date is after the To date.
            </p>
          )}
        </div>

        {/* Metrics */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            label="Patient orders"
            value={loading || !data ? "—" : String(data.metrics.patientOrders)}
            hint="finalized in this period"
          />
          <Metric
            label="Final kits"
            value={loading || !data ? "—" : String(data.metrics.finalKits)}
            hint="total kit units, excl. cancelled"
          />
          <Metric
            label="Order value"
            value={
              loading || !data ? "—" : formatInrCompact(data.metrics.orderValueInr)
            }
            hint={
              data && data.metrics.excludedFromValue > 0
                ? `indicative · ${data.metrics.excludedFromValue} excluded (unpriced)`
                : "indicative, excl. cancelled"
            }
          />
          <Metric
            label="Doctor modified"
            value={
              loading || !data ? "—" : `${data.metrics.doctorModifiedPct}%`
            }
            hint={
              data
                ? `${data.metrics.doctorModified} of ${data.metrics.deltaDeterminable} determinable`
                : "of determinable orders"
            }
          />
        </div>

        {/* Export actions */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="hd-label text-xs">
            {loading || !data
              ? " "
              : `${data.total} order${data.total === 1 ? "" : "s"} match — exports include every matching row, not just this page.`}
          </p>
          <div className="flex items-center gap-2">
            <a
              href={hasRows ? exportHref("csv") : undefined}
              aria-disabled={!hasRows}
              className={
                "hd-btn hd-btn-secondary !text-xs " +
                (hasRows ? "" : "pointer-events-none opacity-50")
              }
            >
              <Download className="size-3.5" aria-hidden />
              Download CSV
            </a>
            <a
              href={hasRows ? exportHref("xlsx") : undefined}
              aria-disabled={!hasRows}
              className={
                "hd-btn hd-btn-primary !text-xs " +
                (hasRows ? "" : "pointer-events-none opacity-50")
              }
            >
              <FileSpreadsheet className="size-3.5" aria-hidden />
              Export Excel
            </a>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="hd-card flex items-center justify-center py-16">
            <Loader2
              className="size-5 animate-spin text-[color:var(--hd-text-muted)]"
              aria-label="Loading order summary"
            />
          </div>
        ) : error ? (
          <div className="hd-card flex flex-col items-center justify-center py-14 text-center">
            <p className="hd-value font-medium">
              We couldn&apos;t load this order summary.
            </p>
            <p className="hd-label mt-1">{error}</p>
            <button
              type="button"
              onClick={() => setParams({}, false)}
              className="hd-btn hd-btn-secondary mt-4 !text-xs"
            >
              Try again
            </button>
          </div>
        ) : !hasRows ? (
          <div className="hd-card flex flex-col items-center justify-center py-16 text-center">
            <p className="hd-value font-medium">No patient orders found</p>
            <p className="hd-label mt-1 max-w-sm">
              There are no finalized patient orders for the selected period. Try
              changing the date range or filters.
            </p>
          </div>
        ) : (
          <div className="hd-card overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[color:var(--hd-border)] text-left">
                    <Th className="w-8" />
                    <SortableTh
                      label="Date"
                      active={sort === "date"}
                      dir={dir}
                      onClick={() => onSort("date")}
                    />
                    <SortableTh
                      label="Patient"
                      active={sort === "patient"}
                      dir={dir}
                      onClick={() => onSort("patient")}
                    />
                    <Th>Doctor</Th>
                    <Th>Age / Sex</Th>
                    <Th>Goal</Th>
                    <Th>Symptoms</Th>
                    <Th>System recommended</Th>
                    <Th>Doctor changes</Th>
                    <Th>Final kits</Th>
                    <Th className="text-right">Kits</Th>
                    <SortableTh
                      label="Total"
                      align="right"
                      active={sort === "total"}
                      dir={dir}
                      onClick={() => onSort("total")}
                    />
                  </tr>
                </thead>
                <tbody>
                  {data!.rows.map((row) => (
                    <SummaryTableRow
                      key={row.intentId}
                      row={row}
                      hydrated={hydrated}
                      expanded={expanded === row.intentId}
                      onToggle={() =>
                        setExpanded(expanded === row.intentId ? null : row.intentId)
                      }
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {data!.pageCount > 1 && (
              <div className="flex items-center justify-between gap-3 border-t border-[color:var(--hd-border)] px-4 py-3">
                <p className="hd-label text-xs">
                  Page {data!.page} of {data!.pageCount}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={data!.page <= 1}
                    onClick={() => setParams({ page: String(data!.page - 1) }, false)}
                    className="hd-btn hd-btn-secondary !text-xs disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={data!.page >= data!.pageCount}
                    onClick={() => setParams({ page: String(data!.page + 1) }, false)}
                    className="hd-btn hd-btn-secondary !text-xs disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </PageContainer>
  );
}

// ── Table row ────────────────────────────────────────────────────────────────

function SummaryTableRow({
  row,
  hydrated,
  expanded,
  onToggle,
}: {
  row: Row;
  hydrated: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const changeLines = deltaLines(row);
  return (
    <>
      <tr className="border-b border-[color:var(--hd-border)] align-top hover:bg-[color:var(--hd-surface-sunken)]">
        <td className="px-2 py-3">
          <button
            type="button"
            onClick={onToggle}
            aria-label={expanded ? "Collapse details" : "Expand details"}
            aria-expanded={expanded}
            className="text-[color:var(--hd-text-muted)] hover:text-[color:var(--hd-text)]"
          >
            {expanded ? (
              <ChevronDown className="size-4" aria-hidden />
            ) : (
              <ChevronRight className="size-4" aria-hidden />
            )}
          </button>
        </td>
        <td className="whitespace-nowrap px-3 py-3 text-[color:var(--hd-text)]">
          {hydrated ? fmtDate(row.createdAt) : ""}
        </td>
        <td className="px-3 py-3">
          <span className="hd-value font-medium">{row.patientName}</span>
        </td>
        <td className="px-3 py-3 text-[color:var(--hd-text-secondary)]">
          {row.doctorName}
        </td>
        <td className="whitespace-nowrap px-3 py-3 text-[color:var(--hd-text-secondary)]">
          {formatAgeGender(row.age, row.gender)}
        </td>
        <td className="px-3 py-3">
          <TruncatedChips items={row.goals} limit={1} fallback="—" />
        </td>
        <td className="px-3 py-3">
          <TruncatedChips items={row.symptoms} limit={2} fallback="—" />
        </td>
        <td className="px-3 py-3 text-[color:var(--hd-text-secondary)]">
          <SystemRecommendedCell row={row} />
        </td>
        <td className="px-3 py-3">
          <DoctorChangesCell row={row} changeLines={changeLines} />
        </td>
        <td className="px-3 py-3 text-[color:var(--hd-text-secondary)]">
          {kitListText(row.finalKits)}
        </td>
        <td className="px-3 py-3 text-right tabular-nums text-[color:var(--hd-text)]">
          {row.finalKitCount}
        </td>
        <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">
          {row.totalInr === null ? (
            <span className="text-xs italic text-[color:var(--hd-text-muted)]">
              Unavailable
            </span>
          ) : (
            <span className="hd-value font-semibold">{formatInr(row.totalInr)}</span>
          )}
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-[color:var(--hd-border)] bg-[color:var(--hd-surface-sunken)]">
          <td colSpan={12} className="px-6 py-4">
            <RowDetails row={row} />
          </td>
        </tr>
      )}
    </>
  );
}

function SystemRecommendedCell({ row }: { row: Row }) {
  if (row.systemRecommended === null) {
    return (
      <span className="text-xs italic text-[color:var(--hd-text-muted)]">
        Historical recommendation unavailable
      </span>
    );
  }
  return <span>{kitListText(row.systemRecommended)}</span>;
}

function DoctorChangesCell({
  row,
  changeLines,
}: {
  row: Row;
  changeLines: string[];
}) {
  if (row.delta.status === "indeterminate") {
    return (
      <span className="text-xs italic text-[color:var(--hd-text-muted)]">
        Unavailable
      </span>
    );
  }
  if (row.delta.status === "unchanged") {
    return (
      <span className="hd-pill hd-pill-success !text-xs">No change</span>
    );
  }
  return (
    <div className="flex flex-col gap-0.5">
      {changeLines.map((line, i) => (
        <span
          key={i}
          className={
            "text-xs " +
            (line.startsWith("+")
              ? "text-[color:var(--hd-success)]"
              : line.startsWith("−")
                ? "text-[color:var(--hd-critical)]"
                : "text-[color:var(--hd-attention)]")
          }
        >
          {line}
        </span>
      ))}
    </div>
  );
}

function RowDetails({ row }: { row: Row }) {
  return (
    <div className="grid gap-6 md:grid-cols-4">
      <DetailBlock title="System recommended">
        {row.systemRecommended === null ? (
          <p className="text-xs italic text-[color:var(--hd-text-muted)]">
            Historical recommendation unavailable — the original recommendation
            for this order was not stored.
          </p>
        ) : (
          <KitList lines={row.systemRecommended} />
        )}
      </DetailBlock>
      <DetailBlock title="Doctor changes">
        <p className="text-xs text-[color:var(--hd-text-secondary)]">
          {deltaSummary(row)}
        </p>
      </DetailBlock>
      <DetailBlock title="Final kits">
        <KitList lines={row.finalKits} />
      </DetailBlock>
      <DetailBlock title="Clinical context">
        <dl className="space-y-1 text-xs text-[color:var(--hd-text-secondary)]">
          <div>
            <dt className="hd-eyebrow">Goal</dt>
            <dd>{row.goals.length ? row.goals.join(" · ") : "—"}</dd>
          </div>
          <div>
            <dt className="hd-eyebrow">Symptoms</dt>
            <dd>{row.symptoms.length ? row.symptoms.join(" · ") : "—"}</dd>
          </div>
        </dl>
        {row.dataQualityFlags.length > 0 && (
          <ul className="mt-2 space-y-0.5">
            {row.dataQualityFlags.map((f, i) => (
              <li
                key={i}
                className="text-[11px] text-[color:var(--hd-attention)]"
              >
                {f}
              </li>
            ))}
          </ul>
        )}
        <Link
          href={`/doctor/reports/${row.assessmentId}`}
          className="mt-2 inline-block text-xs underline underline-offset-2 hover:text-[color:var(--hd-text)]"
        >
          Open clinical review
        </Link>
      </DetailBlock>
    </div>
  );
}

// ── Small presentational bits ────────────────────────────────────────────────

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="hd-card p-4">
      <p className="hd-eyebrow">{label}</p>
      <p className="hd-value mt-1 font-serif text-2xl tabular-nums">{value}</p>
      <p className="hd-label mt-0.5 text-xs">{hint}</p>
    </div>
  );
}

function Th({
  children,
  className = "",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={
        "hd-eyebrow px-3 py-2.5 font-medium text-[color:var(--hd-text-muted)] " +
        className
      }
    >
      {children}
    </th>
  );
}

function SortableTh({
  label,
  active,
  dir,
  onClick,
  align = "left",
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  align?: "left" | "right";
}) {
  return (
    <th
      className={
        "px-3 py-2.5 " + (align === "right" ? "text-right" : "text-left")
      }
    >
      <button
        type="button"
        onClick={onClick}
        className={
          "hd-eyebrow inline-flex items-center gap-1 font-medium hover:text-[color:var(--hd-text)] " +
          (active
            ? "text-[color:var(--hd-text)]"
            : "text-[color:var(--hd-text-muted)]")
        }
      >
        {label}
        {active &&
          (dir === "asc" ? (
            <ArrowUp className="size-3" aria-hidden />
          ) : (
            <ArrowDown className="size-3" aria-hidden />
          ))}
      </button>
    </th>
  );
}

function TruncatedChips({
  items,
  limit,
  fallback,
}: {
  items: string[];
  limit: number;
  fallback: string;
}) {
  if (items.length === 0) {
    return <span className="text-[color:var(--hd-text-muted)]">{fallback}</span>;
  }
  const shown = items.slice(0, limit);
  const extra = items.length - shown.length;
  return (
    <span className="text-[color:var(--hd-text-secondary)]">
      {shown.join(" · ")}
      {extra > 0 && (
        <span
          className="ml-1 text-xs text-[color:var(--hd-text-muted)]"
          title={items.join(" · ")}
        >
          +{extra}
        </span>
      )}
    </span>
  );
}

function DetailBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="hd-eyebrow mb-1.5">{title}</p>
      {children}
    </div>
  );
}

function KitList({
  lines,
}: {
  lines: { kitId: string; displayName: string; quantity: number }[];
}) {
  if (lines.length === 0) {
    return <p className="text-xs text-[color:var(--hd-text-muted)]">—</p>;
  }
  return (
    <ul className="space-y-0.5">
      {lines.map((l, i) => (
        <li key={`${l.kitId}-${i}`} className="text-xs text-[color:var(--hd-text)]">
          {l.displayName}
          {l.quantity > 1 && (
            <span className="text-[color:var(--hd-text-muted)]"> ×{l.quantity}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
