import Image from "next/image";
import { ShieldCheck } from "lucide-react";
import { ProductImage } from "@/components/kits/ProductImage";
import { protocolMonthsLabel } from "@/lib/commerce/kitQuantity";
import type { CartData } from "@/lib/cart/loadCartData";

// The patient's read-only view of their approved treatment plan.
//
// No cart, no checkout, no quantity control, no "place an order" action —
// ownership of ordering belongs to the doctor/clinic (see ClinicOrderView).
// This is a calm summary: what was approved, and that the clinic will follow
// up. Server-rendered, no client JS: there is nothing here for the patient to
// do, so there is nothing here to hydrate.

export function PatientPlanView({ cart }: { cart: CartData }) {
  const labelOf = (li: CartData["lineItems"][number]) => li.displayName ?? li.sourceIdentifierSnapshot;

  return (
    <div
      className="min-h-screen bg-stone-50 px-4 py-6 sm:py-10"
      style={
        cart.clinic?.primaryColor
          ? ({ ["--brand" as string]: cart.clinic.primaryColor } as React.CSSProperties)
          : undefined
      }
    >
      <div className="mx-auto max-w-lg">
        <header className="flex items-center justify-between gap-4 border-b border-stone-200 pb-4">
          <div className="flex min-w-0 items-center gap-3">
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
                Your treatment plan
              </p>
              <p className="truncate text-base font-medium text-slate-900">
                {cart.clinic?.name ?? "Your clinic"}
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-800 ring-1 ring-teal-200">
            <ShieldCheck className="size-3.5" />
            Doctor approved
          </span>
        </header>

        {cart.doctor && (
          <section className="mt-4 rounded-2xl border border-stone-200 bg-white p-3">
            <p className="text-base font-medium text-slate-900">
              Reviewed &amp; approved by {cart.doctor.name}
            </p>
            {cart.doctor.specialization && (
              <p className="text-sm text-stone-500">{cart.doctor.specialization}</p>
            )}
          </section>
        )}

        <section className="mt-4 divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
          {cart.lineItems.map((li) => (
            <div key={li.kitId} className="flex items-start gap-4 p-4 sm:p-5">
              <ProductImage id={li.kitId} category="kit" size="sm" />
              <div className="min-w-0 flex-1">
                <p className="font-serif text-lg leading-tight text-slate-900">{labelOf(li)}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-teal-700">
                    {protocolMonthsLabel(li.quantity)}
                  </span>
                  <span className="text-sm font-medium text-stone-700">&middot; Qty {li.quantity}</span>
                </div>
                {li.description && (
                  <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-stone-700">
                    {li.description}
                  </p>
                )}
              </div>
              {li.commercialState === "CHARGEABLE" && (
                <p className="shrink-0 text-base font-medium tabular-nums text-slate-900">
                  {li.unitPriceLabel}
                </p>
              )}
            </div>
          ))}
        </section>

        <section className="mt-4 rounded-2xl border border-stone-200 bg-white p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-base text-stone-700">Total</span>
            {cart.subtotalMinor === null ? (
              <span className="text-sm font-medium text-amber-700">Confirming with clinic</span>
            ) : (
              <span className="font-serif text-3xl text-slate-900 tabular-nums">
                {cart.subtotalLabel}
              </span>
            )}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-stone-500">
            This is the plan {cart.doctor?.name ?? "your doctor"} approved for you. Your clinic
            will follow up with next steps.
          </p>
        </section>
      </div>
    </div>
  );
}
