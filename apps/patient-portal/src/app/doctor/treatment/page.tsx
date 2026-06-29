import { Stethoscope } from "lucide-react";
import { PageContainer } from "@/components/app-shell";

export default function DoctorTreatmentPage() {
  return (
    <PageContainer className="space-y-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-700">
          DrFACT · Treatment plans
        </p>
        <h1 className="font-serif text-3xl font-medium tracking-tight text-slate-900">
          Treatment library
        </h1>
        <p className="text-sm text-slate-500">
          Manage protocol templates and treatment plans — coming soon.
        </p>
      </div>
      <section className="rounded-2xl border border-stone-200 bg-white shadow-sm px-6 py-12 text-center">
        <div className="mx-auto h-12 w-12 rounded-full bg-stone-100 grid place-items-center">
          <Stethoscope className="h-5 w-5 text-stone-400" />
        </div>
        <p className="mt-3 text-sm font-medium text-slate-700">Treatment library arrives in Sprint 2</p>
        <p className="mt-1 text-xs text-slate-500">
          Until then, treatment plans live inline on the report detail page.
        </p>
      </section>
    </PageContainer>
  );
}
