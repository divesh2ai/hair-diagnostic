"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  Minus,
  Plus,
  MessageCircle,
  FileText,
  LayoutDashboard,
} from "lucide-react";
import { ProductImage } from "@/components/kits/ProductImage";
import type { CartData, CartLineItem } from "@/lib/cart/loadCartData";
import "@/styles/doctor-tokens.css";

// CLINIC ORDER — the doctor/clinic's ordering screen for an approved
// treatment plan. NOT ecommerce checkout: there is no payment step here, and
// the quantity stepper below sets ORDER quantity only — how many boxes the
// clinic is bringing in — never the approved prescription. See
// api/cart/[assessmentId]/quantity/route.ts for why that write can never
// reach Consultation/KitOrderIntent.kitIds.
//
// Doctor-only. The patient-facing view is a separate, read-only component —
// see PatientPlanView in this same route.

export function ClinicOrderView({ cart: initial }: { cart: CartData }) {
  const [cart, setCart] = useState(initial);
  const [pendingKitId, setPendingKitId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setQuantity = async (kitId: string, quantity: number) => {
    if (quantity < 1 || quantity > 99 || pendingKitId) return;
    setPendingKitId(kitId);
    setError(null);
    // Optimistic — reverted on failure, matching the pattern the kit lineup
    // editor and substitution route already use elsewhere in this app.
    const previous = cart;
    setCart((c) => ({
      ...c,
      lineItems: c.lineItems.map((li) =>
        li.kitId === kitId
          ? {
              ...li,
              quantity,
              lineTotalMinor: li.unitPriceMinor === null ? null : li.unitPriceMinor * quantity,
            }
          : li,
      ),
    }));
    try {
      const res = await fetch(`/api/cart/${cart.assessmentId}/quantity`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kitId, quantity }),
      });
      if (!res.ok) {
        setCart(previous);
        const j = await res.json().catch(() => ({}));
        setError(j.message ?? "Could not update the order quantity.");
      }
    } catch {
      setCart(previous);
      setError("Could not update the order quantity.");
    } finally {
      setPendingKitId(null);
    }
  };

  const confirmOrder = async () => {
    setConfirming(true);
    setError(null);
    try {
      const res = await fetch(`/api/cart/${cart.assessmentId}/confirm`, { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.message ?? "Could not confirm the clinic order.");
        return;
      }
      setConfirmed(true);
    } catch {
      setError("Could not confirm the clinic order.");
    } finally {
      setConfirming(false);
    }
  };

  const totalUnits = useMemo(
    () => cart.lineItems.reduce((sum, li) => sum + li.quantity, 0),
    [cart.lineItems],
  );

  const onePagerHref = `/reports/${cart.assessmentId}/one-page`;
  const patientPhone = cart.patient?.phone ?? "";

  if (confirmed) {
    return (
      <div data-surface="doctor" className="mx-auto max-w-lg py-10">
        <div className="hd-card p-6 text-center">
          <CheckCircle2 className="mx-auto size-10 text-emerald-600" aria-hidden />
          <p className="mt-3 text-lg font-medium text-slate-900">Treatment Approved</p>
          <p className="text-lg font-medium text-slate-900">Clinic Order Confirmed</p>
          {cart.patient?.name && (
            <p className="mt-1 text-sm text-stone-500">Patient: {cart.patient.name}</p>
          )}

          <div className="mt-6 space-y-2.5">
            <Link
              href={onePagerHref}
              target="_blank"
              rel="noreferrer"
              className="hd-btn hd-btn-secondary w-full justify-center"
            >
              <FileText className="size-4" aria-hidden />
              View Approved Report
            </Link>
            {patientPhone && (
              <a
                href={`https://wa.me/${patientPhone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
                  `Hi${cart.patient?.name ? " " + cart.patient.name : ""}, your Dr FACT treatment plan is approved. Your report: ${typeof window !== "undefined" ? window.location.origin : ""}${onePagerHref}`,
                )}`}
                target="_blank"
                rel="noreferrer"
                className="hd-btn hd-btn-secondary w-full justify-center"
              >
                <MessageCircle className="size-4" aria-hidden />
                Share Report on WhatsApp
              </a>
            )}
            <Link href="/doctor" className="hd-btn hd-btn-secondary w-full justify-center">
              <LayoutDashboard className="size-4" aria-hidden />
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div data-surface="doctor" className="mx-auto max-w-xl px-4 py-8 sm:px-0">
      <header className="mb-5">
        <p className="hd-eyebrow">Clinic Order</p>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-stone-600">
          {cart.patient?.name && <span>Patient: {cart.patient.name}</span>}
          {cart.doctor?.name && <span>Doctor: {cart.doctor.name}</span>}
          {cart.clinic?.name && <span>Clinic: {cart.clinic.name}</span>}
        </div>
        <p className="mt-2 text-sm font-medium text-slate-800">
          {cart.lineItems.length} approved product{cart.lineItems.length === 1 ? "" : "s"}
        </p>
      </header>

      {error && (
        <div role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-900">
          {error}
        </div>
      )}

      <div className="hd-card divide-y divide-stone-100">
        {cart.lineItems.map((li) => (
          <ClinicOrderLine
            key={li.kitId}
            item={li}
            busy={pendingKitId === li.kitId}
            onQuantityChange={(q) => setQuantity(li.kitId, q)}
          />
        ))}
      </div>

      <div className="hd-card mt-4 space-y-2.5 p-4 sm:p-5">
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-stone-600">Products / units</span>
          <span className="tabular-nums font-medium text-slate-800">
            {cart.lineItems.length} / {totalUnits}
          </span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-base font-medium text-slate-900">Order Total</span>
          {cart.subtotalMinor === null ? (
            <span className="text-sm font-medium text-amber-700">Pricing pending</span>
          ) : (
            <span className="font-serif text-2xl text-slate-900 tabular-nums">
              {cart.subtotalLabel}
            </span>
          )}
        </div>
        {cart.subtotalMinor === null && (
          <p className="text-xs leading-relaxed text-amber-800">
            One or more products are not yet priced — the order total cannot be confirmed until
            every line has an approved price.
          </p>
        )}

        <button
          type="button"
          onClick={confirmOrder}
          disabled={confirming || !cart.chargeable}
          className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {confirming ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <ClipboardCheck className="size-4" aria-hidden />
          )}
          {confirming ? "Confirming…" : "Confirm Clinic Order"}
        </button>
        {!cart.chargeable && (
          <p className="text-center text-xs text-stone-500">
            Resolve pricing/catalog mapping on every line to confirm.
          </p>
        )}
      </div>
    </div>
  );
}

function ClinicOrderLine({
  item,
  busy,
  onQuantityChange,
}: {
  item: CartLineItem;
  busy: boolean;
  onQuantityChange: (quantity: number) => void;
}) {
  const label = item.displayName ?? item.sourceIdentifierSnapshot;

  return (
    <div className="flex items-start gap-4 p-4 sm:p-5">
      <ProductImage id={item.kitId} category="kit" size="lg" />

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className="font-serif text-lg leading-tight text-slate-900">{label}</p>
          <div className="shrink-0 text-right">
            {item.commercialState === "CHARGEABLE" ? (
              <p className="text-base font-medium tabular-nums text-slate-900">
                {item.unitPriceLabel}
              </p>
            ) : (
              <p
                className={`max-w-[9rem] text-[11px] font-medium leading-snug ${
                  item.commercialState === "PRICE_PENDING" ? "text-amber-700" : "text-stone-500"
                }`}
              >
                {item.commercialState === "PRICE_PENDING"
                  ? "Pricing requires confirmation"
                  : item.commercialState === "IDENTITY_REVIEW"
                    ? "Catalog mapping required"
                    : "Not available to order"}
              </p>
            )}
          </div>
        </div>

        <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-teal-700">
          1-month protocol
        </p>

        <div className="mt-2.5 flex items-center gap-3">
          <span className="text-xs font-medium text-stone-500">Quantity</span>
          <div className="inline-flex items-center gap-1 rounded-full border border-stone-300">
            <button
              type="button"
              onClick={() => onQuantityChange(item.quantity - 1)}
              disabled={busy || item.quantity <= 1}
              aria-label={`Decrease quantity for ${label}`}
              className="flex size-7 items-center justify-center rounded-full text-slate-700 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Minus className="size-3.5" aria-hidden />
            </button>
            <span className="w-6 text-center text-sm font-medium tabular-nums text-slate-900">
              {busy ? <Loader2 className="mx-auto size-3.5 animate-spin" aria-hidden /> : item.quantity}
            </span>
            <button
              type="button"
              onClick={() => onQuantityChange(item.quantity + 1)}
              disabled={busy || item.quantity >= 99}
              aria-label={`Increase quantity for ${label}`}
              className="flex size-7 items-center justify-center rounded-full text-slate-700 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus className="size-3.5" aria-hidden />
            </button>
          </div>
        </div>

        <p className="mt-2 text-xs text-stone-500">Approved treatment</p>
      </div>
    </div>
  );
}
