import Link from "next/link";
import { DEMO_PATIENTS } from "./data";

export default function TodaysAssessmentsPage() {
  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="space-y-10">
      <div>
        <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-emerald-700/80">
          {today}
        </p>
        <h1 className="mt-2 text-[34px] font-semibold tracking-tight text-slate-900">
          Today&apos;s Assessments
        </h1>
        <p className="mt-2 text-[15px] text-slate-500">
          {DEMO_PATIENTS.length} patients ready for consultation review.
        </p>
      </div>

      <ul className="space-y-4">
        {DEMO_PATIENTS.map((p) => (
          <li key={p.id}>
            <Link
              href={`/demo/doctor/${p.id}`}
              className="group block rounded-3xl border border-slate-200/70 bg-white px-7 py-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-emerald-300/70 hover:shadow-[0_4px_20px_rgba(15,23,42,0.06)]"
            >
              <div className="flex items-center justify-between gap-6">
                <div className="flex items-center gap-5 min-w-0">
                  <Avatar name={p.name} />
                  <div className="min-w-0">
                    <p className="text-[18px] font-semibold tracking-tight text-slate-900">
                      {p.name}
                    </p>
                    <p className="mt-0.5 text-[14px] text-slate-500 truncate">
                      {p.condition} · {p.age}, {p.gender}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-6 shrink-0">
                  <div className="text-right hidden sm:block">
                    <p className="text-[11px] uppercase tracking-wider text-slate-400">
                      Assessed
                    </p>
                    <p className="text-[13px] font-medium text-slate-700">
                      {p.assessmentDate}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-[13px] font-medium text-white transition group-hover:bg-emerald-700">
                    Open
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
                      <path d="M5 12h14" />
                      <path d="m12 5 7 7-7 7" />
                    </svg>
                  </span>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("");
  return (
    <div className="h-14 w-14 shrink-0 rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100 flex items-center justify-center">
      <span className="text-[15px] font-semibold tracking-tight text-emerald-800">
        {initials}
      </span>
    </div>
  );
}
