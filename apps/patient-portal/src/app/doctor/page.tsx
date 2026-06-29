"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  FileText,
  Clock,
  ArrowRight,
  ClipboardCheck,
  Settings as SettingsIcon,
  Sparkles,
  Languages,
  ImageIcon,
  Video,
  Stethoscope,
  Pill,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadges";
import { PageContainer } from "@/components/app-shell";

interface RecentRow {
  id: string;
  patientName: string;
  clinicName: string;
  submittedAt: string | null;
  status: string;
}

interface Stats {
  counts: { patients: number; reports: number; pending: number };
  recent: RecentRow[];
}

export default function DoctorDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/doctor/stats")
      .then((r) => r.json())
      .then((d) => setStats(d))
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  const pendingCount = stats?.counts.pending ?? 0;

  const cards = [
    {
      icon: ClipboardCheck,
      label: "Needs review",
      value: pendingCount,
      href: "/doctor/reports",
      accent: pendingCount > 0 ? "text-amber-700 bg-amber-50" : "text-slate-500 bg-slate-50",
      hint: pendingCount > 0 ? "Open the inbox" : "Nothing pending",
    },
    {
      icon: FileText,
      label: "Reports",
      value: stats?.counts.reports ?? "—",
      href: "/doctor/reports",
      accent: "text-sky-700 bg-sky-50",
      hint: "All completed cases",
    },
    {
      icon: Users,
      label: "Patients",
      value: stats?.counts.patients ?? "—",
      href: "/doctor/patients",
      accent: "text-teal-700 bg-teal-50",
      hint: "Open registry",
    },
  ];

  return (
    <PageContainer className="space-y-8">
      <header className="flex flex-col gap-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-700">
          DrFACT · Doctor workspace
        </p>
        <h2 className="font-serif text-3xl font-medium tracking-tight text-slate-900">
          Today
        </h2>
        <p className="text-sm text-slate-500">
          {loading
            ? "Loading clinical inbox…"
            : pendingCount === 0
              ? "All caught up — nothing waits for your review."
              : `${pendingCount} case${pendingCount === 1 ? "" : "s"} waiting for your review.`}
        </p>
      </header>

      <div className="grid sm:grid-cols-3 gap-4">
        {cards.map(({ icon: Icon, label, value, href, accent, hint }) => (
          <Link
            key={label}
            href={href}
            className="group rounded-2xl bg-white border border-stone-200 p-5 shadow-sm hover:shadow-md hover:border-stone-300 transition-all"
          >
            <div className="flex items-start justify-between">
              <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${accent}`}>
                <Icon className="h-4 w-4" />
              </span>
              <ArrowRight className="h-4 w-4 text-stone-300 group-hover:text-stone-500 transition-colors" />
            </div>
            <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
              {loading ? "…" : value}
            </p>
            <p className="mt-1 text-sm font-medium text-slate-700">{label}</p>
            <p className="text-xs text-slate-500">{hint}</p>
          </Link>
        ))}
      </div>

      <section className="rounded-2xl bg-white border border-stone-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-500">
              Recent activity
            </p>
            <h2 className="font-serif text-lg text-slate-900">Recent reports</h2>
          </div>
          <Link
            href="/doctor/reports"
            className="text-sm text-sky-600 font-medium inline-flex items-center gap-1 hover:text-sky-700"
          >
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {loading ? (
          <SkeletonRows />
        ) : (stats?.recent.length ?? 0) === 0 ? (
          <EmptyRecent />
        ) : (
          <ul className="divide-y divide-stone-200">
            {stats!.recent.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/doctor/reports/${r.id}`}
                  className="block px-5 py-3 hover:bg-stone-50 focus:outline-none focus:bg-stone-50"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 truncate">
                        {r.patientName}
                      </p>
                      <p className="text-xs text-slate-500 truncate inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {r.clinicName} ·{" "}
                        {r.submittedAt ? new Date(r.submittedAt).toLocaleString() : "—"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 whitespace-nowrap">
                      <StatusBadge status={r.status} />
                      <span className="text-sm text-sky-600 font-medium">Open →</span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Workspace customization (additive — does not replace anything) ── */}
      <section className="rounded-2xl bg-white border border-stone-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-500">
              Workspace
            </p>
            <h2 className="font-serif text-lg text-slate-900">Customization</h2>
          </div>
          <Link
            href="/doctor/settings"
            className="text-sm text-sky-600 font-medium inline-flex items-center gap-1 hover:text-sky-700"
          >
            Open settings <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 p-5">
          {CUSTOMIZATION_TILES.map(({ icon: Icon, label, hint, href }) => (
            <Link
              key={label}
              href={href}
              className="group rounded-xl border border-stone-200 bg-stone-50/40 p-4 hover:bg-white hover:border-stone-300 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white border border-stone-200 text-slate-700">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">{label}</p>
                  <p className="text-xs text-slate-500 truncate">{hint}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </PageContainer>
  );
}

const CUSTOMIZATION_TILES = [
  { icon: Sparkles,    label: "Doctor AI",            hint: "Pick your assistant model",  href: "/doctor/settings#ai" },
  { icon: Languages,   label: "Preferred language",   hint: "Default report language",    href: "/doctor/settings#language" },
  { icon: ImageIcon,   label: "Brand logo",           hint: "Header & PDF logo",          href: "/doctor/settings#logo" },
  { icon: Video,       label: "Avatar & video",       hint: "Patient handoff video",      href: "/doctor/settings#avatar" },
  { icon: Stethoscope, label: "Consultation",         hint: "Default session preferences",href: "/doctor/settings#consultation" },
  { icon: Pill,        label: "Prescription defaults",hint: "Refill, dosage, signature",  href: "/doctor/settings#prescription" },
] as const;

function SkeletonRows() {
  return (
    <ul className="divide-y divide-stone-200 animate-pulse">
      {Array.from({ length: 5 }).map((_, i) => (
        <li key={i} className="px-5 py-4 flex items-center justify-between gap-4">
          <div className="space-y-2 min-w-0 w-full">
            <div className="h-4 w-48 bg-stone-100 rounded" />
            <div className="h-3 w-64 bg-stone-100 rounded" />
          </div>
          <div className="h-4 w-16 bg-stone-100 rounded" />
        </li>
      ))}
    </ul>
  );
}

function EmptyRecent() {
  return (
    <div className="px-6 py-12 text-center">
      <div className="mx-auto h-12 w-12 rounded-full bg-stone-100 grid place-items-center">
        <FileText className="h-5 w-5 text-stone-400" />
      </div>
      <p className="mt-3 text-sm font-medium text-slate-700">No reports yet</p>
      <p className="mt-1 text-xs text-slate-500">
        Reports appear as patients complete assessments.
      </p>
    </div>
  );
}
