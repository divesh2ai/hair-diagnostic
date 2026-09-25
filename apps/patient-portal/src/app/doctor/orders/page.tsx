"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Package,
  Loader2,
  ExternalLink,
  Stethoscope,
  X,
  Search,
} from "lucide-react";
import { PageContainer } from "@/components/app-shell";
import { ProductImage } from "@/components/kits/ProductImage";
import { DEFAULT_KIT_QUANTITY, protocolMonthsLabel } from "@/lib/commerce/kitQuantity";
import { useHydrated } from "@/lib/format/useHydrated";
import { OrderTabs } from "./OrderTabs";
import "@/styles/doctor-tokens.css";

// KIT ORDERS — what has been authorised, and what ops has to ship.
//
// ── What this page was ──────────────────────────────────────────────────────
// A five-column table showing a patient name, a kit COUNT, a doctor, a status
// pill and a date. So the one fact an order page exists to carry — WHAT was
// ordered — was the one fact it did not show, and the row's only action opened
// the clinical review, which is a different question entirely.
//
// ── What it answers now ─────────────────────────────────────────────────────
// Three questions, in the order they get asked:
//
//   WHAT SHIPPED?   the kits by name, with their cartons
//   WHAT IS IT      order value, from the same price table the patient's cart
//   WORTH?          bills against
//   IS IT RIGHT?    "View order" opens exactly what the patient sees
//
// ── One row, one order ──────────────────────────────────────────────────────
// Deliberately not a dense data grid. An order is a small number of products
// and a total; rendering it as a card with its cartons lets a doctor confirm
// at a glance that Meera got the kits they authorised, which is the actual
// review task. A table optimises for scanning fifty rows, and nobody scans
// fifty kit orders.

type LineItem = {
  kitId: string;
  displayName: string;
  priceInr: number;
  priceLabel: string;
};

type Order = {
  id: string;
  status: "READY_FOR_FULFILMENT" | "CANCELLED";
  kitCount: number;
  kitIds: string[];
  lineItems: LineItem[];
  totalInr: number;
  totalLabel: string;
  patientName: string;
  assessmentId: string | null;
  doctorName: string;
  clinicName: string;
  createdAt: string;
};

export default function DoctorOrdersPage() {
  const [items, setItems] = useState<Order[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Order | null>(null);
  const hydrated = useHydrated();

  useEffect(() => {
    fetch("/api/doctor/orders")
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data) => setItems(data.items ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const ready = useMemo(
    () => (items ?? []).filter((i) => i.status === "READY_FOR_FULFILMENT"),
    [items],
  );

  // Value of what is actually waiting to ship. Cancelled orders are excluded —
  // counting them would overstate the pipeline.
  const pipeline = useMemo(
    () => ready.reduce((sum, o) => sum + (o.totalInr ?? 0), 0),
    [ready],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items ?? [];
    return (items ?? []).filter(
      (o) =>
        o.patientName.toLowerCase().includes(q) ||
        o.doctorName.toLowerCase().includes(q) ||
        o.lineItems.some((li) => li.displayName.toLowerCase().includes(q)),
    );
  }, [items, query]);

  return (
    <PageContainer className="max-w-5xl">
      <div data-surface="doctor" className="space-y-6">
        <div>
          <h1 className="hd-headline">Kit orders</h1>
          <p className="hd-label mt-1 max-w-prose">
            Approving a consultation creates an order for the ops team. Each one
            below is exactly what the patient was shown.
          </p>
        </div>

        <OrderTabs />

        {/* Two numbers that mean something. "Cancelled: 0" was one of the two
            headline figures before, and it is 0 on every clinic that has never
            cancelled anything — a permanent zero is not a statistic. */}
        <div className="grid gap-3 sm:grid-cols-2">
          <Stat
            label="Awaiting fulfilment"
            value={loading ? "—" : String(ready.length)}
            hint="orders with the ops team"
          />
          <Stat
            label="Pipeline value"
            value={loading ? "—" : formatInr(pipeline)}
            hint="indicative, excludes cancelled"
          />
        </div>

        {(items?.length ?? 0) > 6 && (
          <label className="relative block">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[color:var(--hd-text-muted)]"
              aria-hidden
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search patient, doctor or kit"
              aria-label="Search orders"
              className="hd-card w-full py-2.5 pl-9 pr-3 text-sm outline-none"
            />
          </label>
        )}

        {loading ? (
          <div className="hd-card flex items-center justify-center py-14">
            <Loader2
              className="size-4 animate-spin text-[color:var(--hd-text-muted)]"
              aria-label="Loading orders"
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className="hd-card flex flex-col items-center justify-center py-16 text-center">
            <Package
              className="mb-3 size-8 text-[color:var(--hd-border-strong)]"
              aria-hidden
            />
            <p className="hd-value font-medium">
              {query ? "No orders match that search." : "No kit orders yet."}
            </p>
            <p className="hd-label mt-1">
              {query
                ? "Try a patient, doctor or kit name."
                : "Approve a consultation to create your first order."}
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {filtered.map((o) => (
              <li key={o.id} className="hd-card p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                  <div className="min-w-0">
                    <p className="hd-value text-[15px] font-semibold">
                      {o.patientName}
                    </p>
                    <p className="hd-label mt-0.5 flex flex-wrap items-center gap-x-2 text-xs">
                      <span className="inline-flex items-center gap-1">
                        <Stethoscope className="size-3" aria-hidden />
                        {o.doctorName}
                      </span>
                      {/* Locale-formatted, so the browser renders it. The
                          server runs in UTC and would otherwise show a doctor
                          a time that is not theirs. */}
                      {hydrated && <span>· {fmtDate(o.createdAt)}</span>}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={
                        "hd-pill " +
                        (o.status === "READY_FOR_FULFILMENT"
                          ? "hd-pill-primary"
                          : "hd-pill-neutral")
                      }
                    >
                      {o.status === "READY_FOR_FULFILMENT"
                        ? "Ready for fulfilment"
                        : "Cancelled"}
                    </span>
                    <span className="hd-value font-semibold tabular-nums">
                      {o.totalLabel}
                    </span>
                  </div>
                </div>

                {/* The kits themselves — the reason this page exists. */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {o.lineItems.map((li, i) => (
                    <span
                      key={`${li.kitId}-${i}`}
                      className="flex items-center gap-2 rounded-lg bg-[color:var(--hd-surface-sunken)] py-1 pl-1 pr-2.5"
                    >
                      <ProductImage id={li.kitId} category="kit" size="xs" />
                      <span className="hd-value text-[13px]">
                        {li.displayName}
                      </span>
                    </span>
                  ))}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {/* THE order view: what the patient actually sees. */}
                  {o.assessmentId && (
                    <button
                      type="button"
                      onClick={() => setOpen(o)}
                      className="hd-btn hd-btn-secondary !px-3 !py-1.5 !text-xs"
                    >
                      View order
                    </button>
                  )}
                  {/* The clinical case is a different question, so it is a
                      different, quieter control — not the row's main action. */}
                  {o.assessmentId && (
                    <Link
                      href={`/doctor/reports/${o.assessmentId}`}
                      className="hd-label text-xs underline underline-offset-2 hover:text-[color:var(--hd-text)]"
                    >
                      Open clinical review
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {open && <OrderDialog order={open} onClose={() => setOpen(null)} />}
    </PageContainer>
  );
}

/**
 * The patient's final order, as the patient sees it.
 *
 * Rendered from the SAME line items and totals the cart bills against, so this
 * dialog cannot show a different order from the one the patient confirmed. The
 * link at the foot opens the real cart page for anyone who wants the live
 * article; it is a new tab so an open orders list is not lost.
 */
function OrderDialog({ order, onClose }: { order: Order; onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Order for ${order.patientName}`}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:p-8"
    >
      <div
        data-surface="doctor"
        onClick={(e) => e.stopPropagation()}
        className="hd-card w-full max-w-lg p-5 sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="hd-eyebrow">Clinic order</p>
            <p className="hd-value mt-1 text-lg font-semibold">
              {order.patientName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close order"
            className="hd-btn hd-btn-secondary !p-2"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <ul className="mt-4 space-y-2">
          {order.lineItems.map((li, i) => (
            <li
              key={`${li.kitId}-${i}`}
              className="flex items-center gap-3 rounded-xl border border-[color:var(--hd-border)] p-2.5"
            >
              <ProductImage id={li.kitId} category="kit" size="sm" />
              <div className="min-w-0 flex-1">
                <p className="hd-value font-medium">{li.displayName}</p>
                <p className="hd-label text-xs">
                  {protocolMonthsLabel(DEFAULT_KIT_QUANTITY)} · Qty {DEFAULT_KIT_QUANTITY}
                </p>
              </div>
              <span className="hd-value tabular-nums">{li.priceLabel}</span>
            </li>
          ))}
        </ul>

        <div className="hd-divide-t mt-4 flex items-baseline justify-between pt-3">
          <span className="hd-label">
            Total · {order.kitCount}-month plan
          </span>
          <span className="hd-value text-xl font-semibold tabular-nums">
            {order.totalLabel}
          </span>
        </div>

        <p className="hd-label mt-1 text-xs">
          Prices indicative — the final invoice comes from the clinic.
        </p>

        {order.assessmentId && (
          <a
            href={`/cart/${order.assessmentId}`}
            target="_blank"
            rel="noreferrer"
            className="hd-btn hd-btn-secondary mt-4 w-full !text-xs"
          >
            <ExternalLink className="size-3.5" aria-hidden />
            Open clinic order
          </a>
        )}
      </div>
    </div>
  );
}

/** Rupee formatting, matching lib/pricing/kitPrices so totals read alike. */
function formatInr(v: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(v);
}

function Stat({
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

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}
