"use client";

import { use, useEffect, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { AnimatePresence } from "framer-motion";
import {
  ShoppingBag,
  Loader2,
  CheckCircle2,
  MessageCircle,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import CartCheckoutAnimation from "./CartCheckoutAnimation";

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
    displayName: string;
    description: string | null;
    quantity: number;
    unitPriceInr: number;
    unitPriceLabel: string;
  }[];
  subtotalInr: number;
  subtotalLabel: string;
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
    fetch(`/api/cart/${assessmentId}`)
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
    // Payment integration lands with Instamojo in the next sprint. For the
    // demo, "Confirm" plays the checkout animation and flips the state.
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
  const waMsg = encodeURIComponent(
    `Hi, I have questions about my Dr FACT recommendation (order ${cart.order.id.slice(0, 8)}).`,
  );

  return (
    <Frame primaryColor={cart.clinic?.primaryColor ?? null}>
      <AnimatePresence>
        {animating && (
          <CartCheckoutAnimation
            itemNames={cart.lineItems.map((li) => li.displayName)}
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
          <div className="relative size-11 shrink-0 overflow-hidden rounded-full bg-stone-100 ring-1 ring-stone-200">
            {cart.doctor.photoUrl ? (
              <Image
                src={cart.doctor.photoUrl}
                alt={cart.doctor.name ?? "Doctor"}
                fill
                sizes="44px"
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-stone-400">
                <Stethoscope className="size-5" />
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
          <div key={li.kitId} className="p-5 flex items-start gap-4">
            <div className="flex-1 min-w-0">
              <p className="font-serif text-lg text-slate-900 leading-tight">{li.displayName}</p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-teal-700">
                2-month protocol · 1 kit
              </p>
              {li.description && (
                <p className="mt-2 text-sm text-stone-700 leading-relaxed line-clamp-3">
                  {li.description}
                </p>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="text-base font-medium text-slate-900 tabular-nums">
                {li.unitPriceLabel}
              </p>
              <p className="text-xs text-stone-500 mt-0.5">Qty {li.quantity}</p>
            </div>
          </div>
        ))}
      </section>

      {/* ── TOTAL + CTA ────────────────────────────────────────── */}
      <section className="mt-4 rounded-2xl border border-stone-200 bg-white p-4 space-y-3">
        <div className="flex items-baseline justify-between">
          <span className="text-base text-stone-700">Subtotal · {cart.lineItems.length * 2}-month plan</span>
          <span className="font-serif text-3xl text-slate-900 tabular-nums">
            {cart.subtotalLabel}
          </span>
        </div>
        <p className="text-xs text-stone-500 leading-relaxed">
          Each kit is a 2-month supply of your doctor-approved protocol ({cart.lineItems.length} {cart.lineItems.length === 1 ? "kit" : "kits"} = {cart.lineItems.length * 2} months).
          Prices indicative — final invoice arrives from the clinic. Shipping
          is included.
        </p>
        {confirmed ? (
          <div className="flex items-center gap-2 rounded-xl bg-teal-50 px-3 py-2.5 text-sm text-teal-900 ring-1 ring-teal-200">
            <CheckCircle2 className="size-4" />
            Order confirmed. The clinic will reach out on WhatsApp.
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
        <a
          href={`https://wa.me/${clinicPhone.replace(/[^0-9]/g, "")}?text=${waMsg}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:border-stone-400"
        >
          <MessageCircle className="size-4" />
          Ask a question on WhatsApp
        </a>
      </section>
    </Frame>
  );
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
