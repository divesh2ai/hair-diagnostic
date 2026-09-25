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
import { protocolMonthsLabel } from "@/lib/commerce/kitQuantity";
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
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

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

  // Reuses the existing governed WhatsApp send path
  // (api/consultation/[assessmentId]/share) rather than composing a wa.me
  // link by hand: that endpoint is the ONE place the message copy, the
  // signed report link and the audit trail (MANUAL_SHARE_OPENED) are
  // produced, and it is what the review page's own Share already calls. A
  // second, ad-hoc wa.me builder here would drift from that message the
  // first time either one changed.
  const shareOnWhatsApp = async () => {
    setSharing(true);
    setShareError(null);
    try {
      const res = await fetch(`/api/consultation/${cart.assessmentId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: "REPORT", mode: "manual" }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.waUrl) {
        setShareError(j.message ?? "Could not prepare the WhatsApp message.");
        return;
      }
      window.open(j.waUrl, "_blank", "noreferrer");
    } catch {
      setShareError("Could not prepare the WhatsApp message.");
    } finally {
      setSharing(false);
    }
  };

  const totalUnits = useMemo(
    () => cart.lineItems.reduce((sum, li) => sum + li.quantity, 0),
    [cart.lineItems],
  );

  const onePagerHref = `/reports/${cart.assessmentId}/one-page`;

  if (confirmed) {
    return (
      <div data-surface="doctor" className="v2-canvas min-h-screen">
        <div className="mx-auto max-w-md px-4 py-16 sm:px-0">
          <div className="v2-card-elevated p-7 text-center">
            <CheckCircle2 className="mx-auto size-9" style={{ color: "var(--status-success)" }} aria-hidden />
            <p className="mt-4 font-serif text-[21px] leading-snug text-[color:var(--ink-primary)]">
              Treatment approved
              <br />
              Clinic order confirmed
            </p>
            {cart.patient?.name && (
              <p className="mt-2 text-sm text-[color:var(--ink-secondary)]">{cart.patient.name}</p>
            )}
            <p className="mt-0.5 text-sm tabular-nums text-[color:var(--ink-tertiary)]">
              {cart.lineItems.length} {cart.lineItems.length === 1 ? "kit" : "kits"}
              {cart.subtotalLabel ? ` · ${cart.subtotalLabel}` : ""}
            </p>

            <div className="mt-7 space-y-2">
              <p className="v2-eyebrow text-left">Patient communication</p>
              {shareError && (
                <p role="alert" className="text-left text-xs" style={{ color: "var(--status-critical)" }}>
                  {shareError}
                </p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href={onePagerHref}
                  target="_blank"
                  rel="noreferrer"
                  className="v2-btn v2-btn-secondary"
                >
                  <FileText className="size-4" aria-hidden />
                  View report
                </Link>
                <button
                  type="button"
                  onClick={shareOnWhatsApp}
                  disabled={sharing}
                  className="v2-btn v2-btn-secondary"
                >
                  {sharing ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <MessageCircle className="size-4" aria-hidden />}
                  Share on WhatsApp
                </button>
              </div>
              <Link href="/doctor" className="v2-btn v2-btn-primary mt-2 w-full">
                <LayoutDashboard className="size-4" aria-hidden />
                Done
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div data-surface="doctor" className="v2-canvas min-h-screen">
      <div className="mx-auto max-w-xl px-4 py-8 sm:px-0">
        <header className="mb-5">
          <p className="v2-eyebrow">Clinic order</p>
          <div className="mt-1.5 space-y-0.5 text-sm text-[color:var(--ink-secondary)]">
            {cart.patient?.name && <p className="font-medium text-[color:var(--ink-primary)]">{cart.patient.name}</p>}
            {cart.doctor?.name && <p>{cart.doctor.name}</p>}
            {cart.clinic?.name && <p>{cart.clinic.name}</p>}
          </div>
          <p className="mt-2 text-sm font-medium" style={{ color: "var(--status-success)" }}>
            Treatment approved · {cart.lineItems.length} product{cart.lineItems.length === 1 ? "" : "s"}
          </p>
        </header>

        {error && (
          <div role="alert" className="mb-4 rounded-lg px-3 py-2.5 text-sm" style={{ background: "var(--status-critical-bg)", color: "var(--status-critical)" }}>
            {error}
          </div>
        )}

        <div className="v2-card divide-y" style={{ borderColor: "var(--v2-border-subtle)" }}>
          {cart.lineItems.map((li) => (
            <ClinicOrderLine
              key={li.kitId}
              item={li}
              busy={pendingKitId === li.kitId}
              onQuantityChange={(q) => setQuantity(li.kitId, q)}
            />
          ))}
        </div>

        <div className="v2-card-elevated mt-4 space-y-2.5 p-4 sm:p-5">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-[color:var(--ink-secondary)]">Products / units</span>
            <span className="tabular-nums font-medium text-[color:var(--ink-primary)]">
              {cart.lineItems.length} / {totalUnits}
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-base font-medium text-[color:var(--ink-primary)]">Order value</span>
            {cart.subtotalMinor === null ? (
              <span className="text-sm font-medium" style={{ color: "var(--status-attention)" }}>
                Pricing pending
              </span>
            ) : (
              <span className="font-serif text-2xl text-[color:var(--ink-primary)] tabular-nums">
                {cart.subtotalLabel}
              </span>
            )}
          </div>
          {cart.subtotalMinor === null && (
            <p className="text-xs leading-relaxed" style={{ color: "var(--status-attention)" }}>
              One or more products are not yet priced — the order value cannot be confirmed until
              every line has an approved price.
            </p>
          )}

          <button
            type="button"
            onClick={confirmOrder}
            disabled={confirming || !cart.chargeable}
            className="v2-btn v2-btn-primary mt-2 w-full"
          >
            {confirming ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <ClipboardCheck className="size-4" aria-hidden />
            )}
            {confirming ? "Confirming…" : "Confirm clinic order"}
          </button>
          {!cart.chargeable && (
            <p className="text-center text-xs text-[color:var(--ink-tertiary)]">
              Resolve pricing/catalog mapping on every line to confirm.
            </p>
          )}
        </div>
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
      {/* "md" is 128px — the closest of ProductImage's fixed sizes (44 / 96 /
          128 / 176) to the 100–130px target for this row. */}
      <ProductImage id={item.kitId} category="kit" size="md" />

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className="font-serif text-lg leading-tight text-[color:var(--ink-primary)]">{label}</p>
          <div className="shrink-0 text-right">
            {item.commercialState === "CHARGEABLE" ? (
              <p className="text-base font-medium tabular-nums text-[color:var(--ink-primary)]">
                {item.unitPriceLabel}
              </p>
            ) : (
              <p
                className="max-w-[9rem] text-[11px] font-medium leading-snug"
                style={{
                  color:
                    item.commercialState === "PRICE_PENDING"
                      ? "var(--status-attention)"
                      : "var(--ink-tertiary)",
                }}
              >
                {item.commercialState === "PRICE_PENDING"
                  ? "Pricing requires confirmation"
                  : item.commercialState === "IDENTITY_REVIEW"
                    ? "Catalog match required"
                    : "Not available to order"}
              </p>
            )}
          </div>
        </div>

        <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--brand-primary)" }}>
          {protocolMonthsLabel(item.quantity)}
        </p>
        {item.commercialState === "IDENTITY_REVIEW" && (
          <p className="mt-1 rounded-md px-2 py-1 text-[11px] leading-snug" style={{ background: "var(--status-attention-bg)", color: "var(--status-attention)" }}>
            Review product mapping before confirming this order.
          </p>
        )}

        <div className="mt-2.5 flex items-center gap-3">
          <span className="text-xs font-medium text-[color:var(--ink-tertiary)]">Order quantity</span>
          <div className="inline-flex items-center gap-1 rounded-full border" style={{ borderColor: "var(--v2-border-strong)" }}>
            <button
              type="button"
              onClick={() => onQuantityChange(item.quantity - 1)}
              disabled={busy || item.quantity <= 1}
              aria-label={`Decrease quantity for ${label}`}
              className="flex size-10 items-center justify-center rounded-full text-[color:var(--ink-primary)] transition-colors hover:bg-[color:var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Minus className="size-4" aria-hidden />
            </button>
            <span className="w-7 text-center text-sm font-medium tabular-nums text-[color:var(--ink-primary)]">
              {busy ? <Loader2 className="mx-auto size-3.5 animate-spin" aria-hidden /> : item.quantity}
            </span>
            <button
              type="button"
              onClick={() => onQuantityChange(item.quantity + 1)}
              disabled={busy || item.quantity >= 99}
              aria-label={`Increase quantity for ${label}`}
              className="flex size-10 items-center justify-center rounded-full text-[color:var(--ink-primary)] transition-colors hover:bg-[color:var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus className="size-4" aria-hidden />
            </button>
          </div>
        </div>

        <p className="mt-2 text-xs text-[color:var(--ink-tertiary)]">Approved treatment</p>
      </div>
    </div>
  );
}
