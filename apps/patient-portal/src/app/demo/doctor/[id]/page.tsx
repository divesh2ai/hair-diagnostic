import Link from "next/link";
import { notFound } from "next/navigation";
import { DEMO_PATIENTS, getDemoPatient } from "../data";

export function generateStaticParams() {
  return DEMO_PATIENTS.map((p) => ({ id: p.id }));
}

export default async function PatientSummaryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const patient = getDemoPatient(id);
  if (!patient) notFound();

  return (
    <div className="space-y-10">
      <div>
        <Link
          href="/demo/doctor"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-500 hover:text-slate-900 transition"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
          Today&apos;s Assessments
        </Link>
        <h1 className="mt-5 text-[36px] font-semibold tracking-tight text-slate-900">
          {patient.name}
        </h1>
        <p className="mt-1.5 text-[15px] text-slate-500">
          {patient.age}, {patient.gender} · {patient.condition} · Assessed{" "}
          {patient.assessmentDate.toLowerCase()}
        </p>
      </div>

      <section className="rounded-3xl bg-white border border-slate-200/70 px-8 py-7 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex items-center gap-2.5">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-slate-700">
            Clinical Findings
          </h2>
        </div>
        <ul className="mt-5 space-y-4">
          {patient.findings.map((f, i) => (
            <li key={i} className="flex gap-4">
              <span className="mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[12px] font-semibold text-emerald-700">
                {i + 1}
              </span>
              <p className="text-[15px] leading-relaxed text-slate-700">{f}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-3xl bg-white border border-slate-200/70 px-8 py-7 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex items-center gap-2.5">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-slate-700">
            Recommended Treatment
          </h2>
        </div>
        <p className="mt-5 text-[20px] font-semibold tracking-tight text-slate-900">
          {patient.recommendedKit}
        </p>
        <p className="mt-1.5 text-[14px] text-slate-500">{patient.kitTagline}</p>
      </section>

      <section>
        <button
          type="button"
          className="group flex w-full items-center justify-between gap-6 rounded-3xl bg-slate-900 px-8 py-6 text-left shadow-[0_8px_30px_rgba(15,23,42,0.12)] transition hover:bg-emerald-700 active:scale-[0.998]"
        >
          <span className="flex items-center gap-5">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 transition group-hover:bg-white/20">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="white"
                stroke="white"
                strokeLinejoin="round"
                strokeLinecap="round"
                strokeWidth="1.5"
              >
                <path d="M8 5.14v13.72a.5.5 0 0 0 .76.43l11.04-6.86a.5.5 0 0 0 0-.86L8.76 4.71A.5.5 0 0 0 8 5.14Z" />
              </svg>
            </span>
            <span>
              <span className="block text-[18px] font-semibold tracking-tight text-white">
                Play Recovery Story
              </span>
              <span className="mt-0.5 block text-[13px] text-white/70">
                A 90-second consultation for {patient.name.split(" ")[0]}.
              </span>
            </span>
          </span>
          <span className="text-[12px] font-medium uppercase tracking-wider text-white/60">
            01:30
          </span>
        </button>

        <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200/70 bg-slate-50">
          <div className="relative aspect-video w-full bg-gradient-to-br from-slate-100 via-emerald-50 to-slate-100">
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
              <div className="h-16 w-16 rounded-full bg-white/80 backdrop-blur flex items-center justify-center shadow-sm">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="text-emerald-700"
                >
                  <path d="M8 5.14v13.72a.5.5 0 0 0 .76.43l11.04-6.86a.5.5 0 0 0 0-.86L8.76 4.71A.5.5 0 0 0 8 5.14Z" />
                </svg>
              </div>
              <p className="text-[14px] font-medium text-slate-700">
                {patient.name.split(" ")[0]}&apos;s Recovery Story
              </p>
              <p className="text-[12px] text-slate-500">
                Tap above to begin the consultation.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
