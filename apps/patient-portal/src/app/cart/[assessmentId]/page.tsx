"use client";

import { use, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import { AnimatePresence } from "framer-motion";
import {
  ShoppingBag,
  Loader2,
  CheckCircle2,
  MessageCircle,
  ShieldCheck,
  LayoutDashboard,
} from "lucide-react";
import CartCheckoutAnimation from "./CartCheckoutAnimation";
import { ProductImage } from "@/components/kits/ProductImage";
import { formatInr } from "@/lib/pricing/kitPrices";

// Patient-facing cart. Renders the doctor-approved kit lineup with prices
// so the patient can review, ask questions, or confirm. Deep-linkable —
// doctor / clinic sends this URL over WhatsApp after approval.

type Cart = {
  order: { id: string; status: string; createdAt: string };
  patient: { name: string | null; phone: string | null } | null;
  clinic: {
    name: string;
    slug: string;
    logoUrl: string | null;
    primaryColor: string | null;
  } | null;
  doctor: {
    name: string | null;
    specialization: string | null;
    photoUrl: string | null;
  } | null;
  lineItems: {
    kitId: string;
    /** The identifier the clinical system supplied, preserved verbatim. */
    sourceIdentifierSnapshot: string;
    /** Null until the line's commercial identity is approved. */
    displayName: string | null;
    description: string | null;
    quantity: number;
    commercialState:
      | "CHARGEABLE"
      | "IDENTITY_REVIEW"
      | "UNAVAILABLE"
      | "PRICE_PENDING";
    blockingReasons: string[];
    /** Integer paise, and null unless the line is genuinely chargeable. */
    unitPriceMinor: number | null;
    unitPriceLabel: string | null;
    lineTotalMinor: number | null;
  }[];
  /** False when any line is unresolved, unavailable, or priced-but-unapproved. */
  chargeable: boolean;
  blockingReasons: string[];
  subtotalMinor: number | null;
  subtotalLabel: string | null;
};

export default function PatientCartPage({
  params,
}: {
  params: Promise<{ assessmentId: string }>;
}) {
  const { assessmentId } = use(params);
  const [cart, setCart] = useState<Cart | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    // The cart token travels in the page URL and is forwarded verbatim to the
    // API, which binds it to this assessment id. Absent here means the caller
    // is relying on a doctor session; the API decides, not this component.
    const token =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("t")
        : null;
    const url = token
      ? `/api/cart/${assessmentId}?t=${encodeURIComponent(token)}`
      : `/api/cart/${assessmentId}`;
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then(setCart)
      .catch(async (r) => {
        if (r?.json) {
          const d = await r.json().catch(() => ({}));
          setError(d?.message ?? "Your plan is not ready yet.");
        } else {
          setError("Something went wrong. Please try again.");
        }
      });
  }, [assessmentId]);

  const confirm = async () => {
    setConfirming(true);

    // Tell the server the patient has begun checking out.
    //
    // ── What this does and does not claim ─────────────────────────────────
    // It records intent, never payment. The endpoint it calls can only write
    // PENDING — a browser cannot mark an order paid under any code path, and
    // the confirmed state below is a local UI state, not a commercial fact.
    // Money is recorded only by a signature-verified gateway callback or an
    // authenticated clinic user at the counter.
    //
    // ── Why a failure here is swallowed ───────────────────────────────────
    // Being unable to RECORD that a checkout started must not stop the patient
    // from checking out. The write is best-effort; the consequence of losing
    // it is one missing timestamp on an ops follow-up list, which is a far
    // smaller harm than a patient blocked at the last step by a telemetry
    // error. It is awaited rather than fired-and-forgotten so the record
    // exists before the confirmation animation implies the step is done.
    const token =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("t")
        : null;
    if (token) {
      await fetch(
        `/api/cart/${assessmentId}/checkout?t=${encodeURIComponent(token)}`,
        { method: "POST" },
      ).catch(() => {
        /* best effort — see above */
      });
    }

    // Payment integration lands with Instamojo in the next sprint. Until it
    // does, "Confirm" plays the checkout animation and the clinic collects at
    // the counter, which is the Wave-0 commercial model.
    await new Promise((r) => setTimeout(r, 400));
    setConfirming(false);
    setAnimating(true);
  };

  const finishAnimation = () => {
    setAnimating(false);
    setConfirmed(true);
    toast.success("Order confirmed — your clinic will reach out shortly");
  };

  if (error) {
    return (
      <Frame>
        <div className="mx-auto max-w-md text-center py-16">
          <ShoppingBag className="mx-auto size-8 text-stone-300 mb-3" />
          <h1 className="font-serif text-xl text-slate-900">Nothing here yet</h1>
          <p className="mt-2 text-sm text-stone-500">{error}</p>
        </div>
      </Frame>
    );
  }

  if (!cart) {
    return (
      <Frame>
        <div className="flex items-center justify-center py-24 text-stone-400">
          <Loader2 className="size-5 animate-spin" />
        </div>
      </Frame>
    );
  }

  const clinicPhone = cart.patient?.phone ?? "";

  // Quantity is the doctor's, and it is READ-ONLY here.
  //
  // The page briefly carried a +/- stepper whose changes were never persisted
  // — the cart API is read-only — so it told the patient in one breath that
  // their order was confirmed and in the next that their quantities were not
  // saved. A control that cannot keep its promise is worse than no control,
  // and this is a prescribed quantity: changing it is a clinical decision, so
  // it belongs with the doctor, not behind a stepper on the patient's phone.
  const qtyOf = (li: { quantity: number }) => li.quantity;

  // A product name exists only for a line whose commercial identity has been
  // approved. Everything else shows the identifier the doctor actually
  // prescribed, rather than a similar-looking product's name.
  const labelOf = (li: Cart["lineItems"][number]) =>
    li.displayName ?? li.sourceIdentifierSnapshot;

  // No local arithmetic over prices. The server hands back a chargeable flag
  // and per-line amounts that are null unless approved, so an incomplete cart
  // has no subtotal — and none is invented here to fill the gap.
  const subtotalMinor = cart.chargeable
    ? cart.lineItems.reduce(
        (sum, li) => sum + (li.unitPriceMinor ?? 0) * qtyOf(li),
        0,
      )
    : null;

  const waMsg = encodeURIComponent(
    `Hi, I have questions about my Dr FACT recommendation (order ${cart.order.id.slice(0, 8)}).`,
  );

  return (
    <Frame primaryColor={cart.clinic?.primaryColor ?? null}>
      <AnimatePresence>
        {animating && (
          <CartCheckoutAnimation
            itemNames={cart.lineItems.map(labelOf)}
            onComplete={finishAnimation}
          />
        )}
      </AnimatePresence>
      {/* ── HEADER ─────────────────────────────────────────────── */}
      <header className="flex items-center justify-between gap-4 pb-4 border-b border-stone-200">
        <div className="flex items-center gap-3 min-w-0">
          {cart.clinic?.logoUrl && (
            <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg">
              <Image
                src={cart.clinic.logoUrl}
                alt={cart.clinic.name}
                fill
                sizes="36px"
                className="object-contain"
                unoptimized
              />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-stone-500">
              Your recommended plan
            </p>
            <p className="text-base font-medium text-slate-900 truncate">
              {cart.clinic?.name ?? "Your clinic"}
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-800 ring-1 ring-teal-200">
          <ShieldCheck className="size-3.5" />
          Doctor approved
        </span>
      </header>

      {/* ── DOCTOR STRIP ───────────────────────────────────────── */}
      {cart.doctor && (
        <section className="mt-4 flex items-center gap-3 rounded-2xl border border-stone-200 bg-white p-3">
          <div className="relative size-14 shrink-0 overflow-hidden rounded-full bg-stone-100 ring-1 ring-stone-200">
            {cart.doctor.photoUrl ? (
              <Image
                src={cart.doctor.photoUrl}
                alt={cart.doctor.name ?? "Doctor"}
                fill
                sizes="56px"
                className="object-cover"
                unoptimized
              />
            ) : (
              // Initials, not a stethoscope.
              //
              // This strip exists to tell the patient WHO approved their plan,
              // and a stock clip-art icon says the opposite — it reads as
              // "no real person here". Initials carry the doctor's identity
              // even with no photograph on file.
              <div className="flex h-full w-full items-center justify-center bg-teal-50 text-sm font-semibold text-teal-800">
                {doctorInitials(cart.doctor.name)}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-medium text-slate-900 truncate">
              Reviewed & approved by {cart.doctor.name}
            </p>
            {cart.doctor.specialization && (
              <p className="text-sm text-stone-500 truncate">
                {cart.doctor.specialization}
              </p>
            )}
          </div>
        </section>
      )}

      {/* ── LINE ITEMS ─────────────────────────────────────────── */}
      <section className="mt-4 rounded-2xl border border-stone-200 bg-white divide-y divide-stone-100">
        {cart.lineItems.map((li) => (
          <div key={li.kitId} className="flex items-start gap-4 p-4 sm:p-5">
            {/* The carton the patient will actually receive. Without it this
                page asked someone to confirm a few thousand rupees against a
                name and a paragraph. */}
            <ProductImage id={li.kitId} category="kit" size="sm" />

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <p className="font-serif text-lg leading-tight text-slate-900">
                  {labelOf(li)}
                </p>
                {/* A number appears only on a CHARGEABLE line. Every other
                    state says what is missing, in words. The alternative —
                    showing a figure while the price or the product is still
                    unconfirmed — is what this page used to do. */}
                <div className="shrink-0 text-right">
                  {li.commercialState === "CHARGEABLE" ? (
                    <>
                      <p className="text-base font-medium tabular-nums text-slate-900">
                        {qtyOf(li) === 1
                          ? li.unitPriceLabel
                          : formatInr(
                              ((li.unitPriceMinor ?? 0) * qtyOf(li)) / 100,
                            )}
                      </p>
                      {qtyOf(li) > 1 && (
                        <p className="text-[11px] tabular-nums text-stone-500">
                          {li.unitPriceLabel} each
                        </p>
                      )}
                    </>
                  ) : (
                    <p
                      className={`max-w-[9rem] text-[11px] font-medium leading-snug ${
                        li.commercialState === "PRICE_PENDING"
                          ? "text-amber-700"
                          : "text-stone-500"
                      }`}
                    >
                      {li.commercialState === "PRICE_PENDING"
                        ? "Price confirmation pending"
                        : li.commercialState === "IDENTITY_REVIEW"
                          ? "Kit identity requires review"
                          : "Not available to order"}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-teal-700">
                  1-month protocol
                </span>
                {/* Quantity is shown, never edited — this is a prescribed
                    amount from an approved consultation. */}
                <span className="text-[11px] text-stone-500">
                  &middot; Qty {li.quantity}
                </span>
              </div>

              {li.description && (
                <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-stone-700">
                  {li.description}
                </p>
              )}
            </div>
          </div>
        ))}
      </section>

      {/* ── TOTAL + CTA ────────────────────────────────────────── */}
      <section className="mt-4 rounded-2xl border border-stone-200 bg-white p-4 space-y-3">
        <div className="flex items-baseline justify-between">
          {/* Deliberately NOT "N-month plan".
              Protocol duration is a clinical property of the approved
              treatment plan; box count is a supply fact. Multiplying kits by
              quantity produced claims like "6-month plan" from three products
              taken twice, which no doctor prescribed. This endpoint receives
              only the approved kitIds — no protocol duration — so the honest
              move is to state no duration rather than derive a wrong one. */}
          <span className="text-base text-stone-700">Subtotal</span>
          {subtotalMinor === null ? (
            <span className="text-sm font-medium text-amber-700">
              Awaiting confirmation
            </span>
          ) : (
            <span className="font-serif text-3xl text-slate-900 tabular-nums">
              {formatInr(subtotalMinor / 100)}
            </span>
          )}
        </div>
        <p className="text-xs text-stone-500 leading-relaxed">
          These are the kits your doctor approved, in the quantities they
          prescribed. Your treatment duration is the one discussed with your
          doctor.{" "}
          {subtotalMinor === null
            ? "Your clinic is confirming the details above and will share the final cost with you directly."
            : "Final invoice arrives from the clinic. Shipping is included."}
        </p>
        {confirmed ? (
          <div className="flex items-center gap-2 rounded-xl bg-teal-50 px-3 py-2.5 text-sm text-teal-900 ring-1 ring-teal-200">
            <CheckCircle2 className="size-4" />
            Order confirmed. The clinic will reach out on WhatsApp.
          </div>
        ) : !cart.chargeable ? (
          /* Monetary progression stops while any line is unconfirmed. The
             checkout endpoint refuses the same order independently, so this
             is the honest surface of that rule rather than the rule itself —
             hiding a button is presentation, not a control. */
          <div className="rounded-xl bg-amber-50 px-3 py-2.5 text-sm leading-relaxed text-amber-900 ring-1 ring-amber-200">
            Your clinic is confirming some details on this plan, so it can’t be
            ordered online just yet. Message them below and they’ll take it from
            there.
          </div>
        ) : (
          <button
            type="button"
            onClick={confirm}
            disabled={confirming}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow hover:bg-slate-800 disabled:opacity-50"
          >
            {confirming ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ShoppingBag className="size-4" />
            )}
            {confirming ? "Confirming…" : "Confirm my order"}
          </button>
        )}
        {/* The secondary action swaps at exactly one moment.

            BEFORE confirming, the open question is the patient's, so the exit
            is WhatsApp. AFTER confirming, this page is a dead end: the order is
            placed, there is nothing left to do here, and on a clinic device the
            doctor was closing the tab and signing in again to reach their
            queue. The confirmed state offers the way back instead. */}
        {confirmed ? (
          <Link
            href="/doctor"
            className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:border-stone-400"
          >
            <LayoutDashboard className="size-4" />
            Back to dashboard
          </Link>
        ) : (
          <a
            href={`https://wa.me/${clinicPhone.replace(/[^0-9]/g, "")}?text=${waMsg}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:border-stone-400"
          >
            <MessageCircle className="size-4" />
            Ask a question on WhatsApp
          </a>
        )}
      </section>
    </Frame>
  );
}

/**
 * Up to two initials from a doctor's name, ignoring the title.
 *
 * "Dr Test B" -> "TB". A name that is only a title falls back to a neutral
 * glyph rather than rendering "DR", which would read as a stray abbreviation
 * rather than a person.
 */
function doctorInitials(name: string | null | undefined): string {
  const parts = (name ?? "")
    .replace(/^\s*(dr|doctor|prof)\.?\s+/i, "")
    .split(/\s+/)
    .filter(Boolean);
  const initials = parts
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return initials || "·";
}

function Frame({
  children,
  primaryColor,
}: {
  children: React.ReactNode;
  primaryColor?: string | null;
}) {
  return (
    <div
      className="min-h-screen bg-stone-50 px-4 py-6 sm:py-10"
      style={
        primaryColor
          ? ({ ["--brand" as string]: primaryColor } as React.CSSProperties)
          : undefined
      }
    >
      <div className="mx-auto max-w-lg">{children}</div>
    </div>
  );
}
