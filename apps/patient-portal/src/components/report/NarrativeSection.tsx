import type { NarrativeSection as NarrativeSectionType } from "@shared/types/assessment";

interface Props {
  title: string;
  section: NarrativeSectionType | null | undefined;
}

export function NarrativeSection({ title, section }: Props) {
  const hasContent =
    !!section &&
    (section.full?.trim().length > 0 ||
      section.short?.trim().length > 0 ||
      section.segments.some((seg) => seg.text?.trim().length > 0));

  if (!hasContent) {
    return (
      <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        <p className="mt-2 text-xs text-slate-500">Section content is being prepared.</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {section!.segments.length > 0 ? (
        <dl className="mt-3 space-y-3">
          {section!.segments.map((seg, index) => (
            <div key={`${seg.label}-${index}`}>
              <dt className="text-xs font-semibold text-slate-600">{seg.label}</dt>
              <dd className="mt-1 whitespace-pre-line text-sm leading-6 text-slate-800">{seg.text}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-800">
          {section!.full || section!.short}
        </p>
      )}
    </section>
  );
}
