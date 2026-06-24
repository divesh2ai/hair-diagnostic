"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FileText, Users, LogOut } from "lucide-react";

const NAV = [
  { href: "/doctor", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/doctor/reports", label: "All Reports", icon: FileText, exact: false },
  { href: "/doctor/patients", label: "All Patients", icon: Users, exact: false },
];

export default function DoctorLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <header className="bg-white border-b">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">DrFACT Doctor Console</h1>
            <p className="text-xs text-slate-500">Clinical reports · Patients · Assessments</p>
          </div>
          <nav className="flex items-center gap-1">
            {NAV.map(({ href, label, icon: Icon, exact }) => (
              <Link
                key={href}
                href={href}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive(href, exact)
                    ? "bg-sky-50 text-sky-700"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
            <form action="/auth/signout" method="post" className="ml-2">
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
