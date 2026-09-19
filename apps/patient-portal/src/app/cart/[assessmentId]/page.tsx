import { ShoppingBag } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { resolveCartCaller, loadCartData } from "@/lib/cart/loadCartData";
import { ClinicOrderView } from "./ClinicOrderView";
import { PatientPlanView } from "./PatientPlanView";

// CLINIC ORDER / patient plan — resolved on the SERVER.
//
// This used to fetch /api/cart/[assessmentId] after mounting: server-render
// -> bundle -> hydrate -> fetch -> paint, the same waterfall the doctor
// dashboard and review page were already rewritten to avoid (see their own
// page.tsx headers). loadCartData is the SAME query the API route still uses
// for the client-side quantity/confirm writes, so the doctor's screen and any
// later client refetch can never name a different order.
//
// Route intentionally stays `/cart/[assessmentId]` — migrating it was judged
// not worth the risk to existing WhatsApp links and bookmarks for a URL
// rename alone. What changed is what renders at it: a doctor session sees the
// Clinic Order screen (ClinicOrderView); a patient cart token sees a
// read-only plan summary (PatientPlanView). Neither is the old single
// ecommerce-flavoured page both callers used to share.
export const dynamic = "force-dynamic";

export default async function CartOrClinicOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ assessmentId: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { assessmentId } = await params;
  const { t } = await searchParams;

  const caller = await resolveCartCaller(assessmentId, t ?? null);

  if (caller.kind === "denied") {
    return <NotReady />;
  }

  const cart = await loadCartData(prisma, assessmentId, caller);
  if (!cart) {
    return <NotReady />;
  }

  if (cart.viewer === "doctor") {
    return <ClinicOrderView cart={cart} />;
  }
  return <PatientPlanView cart={cart} />;
}

function NotReady() {
  return (
    <div className="min-h-screen bg-stone-50 px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-md py-16 text-center">
        <ShoppingBag className="mx-auto mb-3 size-8 text-stone-300" aria-hidden />
        <h1 className="font-serif text-xl text-slate-900">Nothing here yet</h1>
        <p className="mt-2 text-sm text-stone-500">
          No confirmed plan yet — please wait for your doctor to approve this report.
        </p>
      </div>
    </div>
  );
}
