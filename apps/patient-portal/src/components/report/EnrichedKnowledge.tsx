import type { EnrichedRootCause, EnrichedTherapyNeed } from "@shared/types/assessment";

export function EnrichedTherapyNeeds({ items }: { items: EnrichedTherapyNeed[] | undefined }) {
  if (!items?.length) return null;

  return (
    <section className="rounded-lg border border-sky-200 bg-sky-50 p-4">
      <h3 className="text-sm font-semibold text-sky-900">Why these therapies were chosen</h3>
      <div className="mt-3 grid gap-3">
        {items.map((item) => (
          <article key={item.need} className="rounded-md border border-sky-100 bg-white p-3">
            <h4 className="text-sm font-semibold text-slate-900">{item.title}</h4>
            <p className="mt-1 text-sm text-slate-700">{item.patientExplanation}</p>
            <p className="mt-2 text-xs text-slate-500">{item.clinicalRationale}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function EnrichedRootCauses({ items }: { items: EnrichedRootCause[] | undefined }) {
  if (!items?.length) return null;

  return (
    <section className="rounded-lg border border-violet-200 bg-violet-50 p-4">
      <h3 className="text-sm font-semibold text-violet-900">Root causes</h3>
      <div className="mt-3 grid gap-3">
        {items.map((item) => (
          <article key={item.cause} className="rounded-md border border-violet-100 bg-white p-3">
            <h4 className="text-sm font-semibold text-slate-900">{item.title}</h4>
            <p className="mt-1 text-sm text-slate-700">{item.patientFriendly}</p>
            <p className="mt-2 text-xs text-slate-500">{item.clinicalContext}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
