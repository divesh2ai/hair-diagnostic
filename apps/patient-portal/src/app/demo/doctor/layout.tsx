import Link from "next/link";

export default function DemoDoctorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#FAFAF7] text-slate-900 antialiased">
      <header className="border-b border-slate-200/70 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto max-w-5xl px-8 py-5 flex items-center justify-between">
          <Link href="/demo/doctor" className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-2xl bg-emerald-600/10 flex items-center justify-center">
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
            </div>
            <div>
              <p className="text-[15px] font-semibold tracking-tight text-slate-900">HairOS</p>
              <p className="text-[11px] text-slate-500 -mt-0.5">Consultation Companion</p>
            </div>
          </Link>
          <div className="text-right">
            <p className="text-[13px] font-medium text-slate-700">Dr. Anjali Rao</p>
            <p className="text-[11px] text-slate-500">Dermatology · Mumbai Clinic</p>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-8 py-10">{children}</main>
    </div>
  );
}
