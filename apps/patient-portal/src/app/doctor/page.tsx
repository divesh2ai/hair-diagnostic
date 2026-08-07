"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowUpRight,
  BadgeCheck,
  ChevronRight,
  Clock,
  EyeIcon,
  Inbox,
  UserRound,
  Users,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { composeWorkflowLabel } from "@/lib/labels/statusLabels";
import { waitingTime } from "@/lib/format/waitingTime";
import {
  DEFAULT_BADGE_THEME,
  getBadgeTheme,
  readStoredBadgeTheme,
  type BadgeThemeId,
} from "@/lib/doctor/badgeThemes";

// Editorial doctor dashboard.
//
// Design brief: this is where clinicians spend the workday. Every millimetre
// competes for their attention, so the surface is intentionally quiet.
//
//  • One hero headline (serif) — the greeting sits above a single primary
//    call to action instead of a wall of tiles.
//  • Three restrained stat cards. Numeric emphasis, understated labels,
//    hairline dividers, no borders competing with content.
//  • A single ranked "Today's inbox" that shows the doctor exactly what to
//    open next; secondary lists come below.
//  • Warm stone / bone palette, teal accent, deep slate text — no clinical
//    grey. Feels like a private studio, not a call centre.
//
// No API contract changes — reads the same /api/doctor/stats payload.

interface RecentRow {
  id: string;
  patientName: string;
  clinicName: string;
  submittedAt: string | null;
  status: string;
}

interface Stats {
  counts: { patients: number; reports: number; pending: number; kitOrders?: number };
  recent: RecentRow[];
}

interface DoctorMe {
  clinic: { name: string | null } | null;
  doctor: {
    id: string;
    name: string | null;
    photoUrl: string | null;
    specialization: string | null;
  } | null;
  role: string;
  email: string | null;
}

export default function DoctorDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [me, setMe] = useState<DoctorMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [badgeThemeId, setBadgeThemeId] = useState<BadgeThemeId>(DEFAULT_BADGE_THEME);

  useEffect(() => {
    setBadgeThemeId(readStoredBadgeTheme());
    fetch("/api/doctor/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
    fetch("/api/doctor/me")
      .then((r) => (r.ok ? r.json() : null))
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

  const badgeTheme = getBadgeTheme(badgeThemeId);

  const pendingCount = stats?.counts.pending ?? 0;
  const patientsCount = stats?.counts.patients ?? 0;
  const reportsCount = stats?.counts.reports ?? 0;
  const kitOrdersCount = stats?.counts.kitOrders ?? 0;

  const heroCopy = useMemo(() => {
    if (loading) return "Preparing your workspace…";
    if (pendingCount === 0) return "Nothing waits for your review. A rare quiet morning.";
    if (pendingCount === 1) return "One consultation is ready for you.";
    return `${pendingCount} consultations are ready for your review.`;
  }, [loading, pendingCount]);

  const heroDate = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="min-h-full bg-stone-50">
      <div className="mx-auto w-full max-w-6xl px-6 lg:px-10 py-10 lg:py-14 space-y-14">
        {me?.role === "SUPER_ADMIN" && (
          <div className="flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-xs text-indigo-900">
            <EyeIcon className="size-3.5 shrink-0" />
            <span>
              <strong>Viewing as super admin.</strong>{" "}
              This is the doctor workspace view. All actions are audit-logged as super-admin activity — please avoid clinical decisions from this account.
            </span>
          </div>
        )}
        {/* ── HERO ─────────────────────────────────────────────────────── */}
        <header className="space-y-6">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-teal-600" />
            <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-stone-500">
              Dr FACT · Clinical Intelligence · {heroDate}
            </span>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] items-start pt-3">
            <div className="max-w-3xl space-y-4">
              <h1 className="font-serif text-4xl lg:text-5xl leading-[1.05] tracking-tight text-slate-900">
                {me?.doctor?.name ? `Good to see you, ${me.doctor.name.split(" ")[0]}.` : "Good to see you."}
              </h1>
              <p className="text-lg leading-relaxed text-stone-600">
                {heroCopy}
              </p>
            </div>

            {/* ── DOCTOR IDENTITY CARD ─────────────────────────────────── */}
            <Link
              href="/doctor/profile"
              className={`group relative flex items-center gap-5 rounded-2xl border border-stone-200 bg-gradient-to-br ${badgeTheme.cardAccent} p-5 pt-7 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.15)] hover:shadow-[0_1px_2px_rgba(15,23,42,0.05),0_16px_40px_-16px_rgba(15,23,42,0.25)] hover:-translate-y-0.5 transition-all duration-300`}
            >
              <span
                className={`absolute -top-2 left-5 inline-flex items-center gap-1 rounded-full ${badgeTheme.chipBg} px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] ${badgeTheme.chipText} ring-1 ${badgeTheme.chipRing} shadow-sm`}
              >
                <BadgeCheck className="size-3" />
                Your workspace
              </span>

              <div className={`relative size-20 shrink-0 overflow-hidden rounded-full bg-white ring-2 ${badgeTheme.avatarRing} shadow-md`}>
                {me?.doctor?.photoUrl ? (
                  <Image
                    src={me.doctor.photoUrl}
                    alt={me.doctor.name ?? "Doctor"}
                    fill
                    sizes="80px"
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-stone-400">
                    <UserRound className="size-9" />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="font-serif text-xl leading-tight text-slate-900 truncate">
                  {me?.doctor?.name ?? "Add your name"}
                </p>
                <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500 truncate">
                  {me?.doctor?.specialization ?? "Dermatologist"}
                </p>
                {me?.clinic?.name && (
                  <p className="mt-2 text-xs text-stone-600 truncate">
                    <span className="text-stone-400">at </span>
                    {me.clinic.name}
                  </p>
                )}
                <p className={`mt-2 text-[11px] font-medium ${badgeTheme.chipText} opacity-0 group-hover:opacity-100 transition-opacity`}>
                  {me?.doctor?.photoUrl ? "Edit profile →" : "Upload your photo →"}
                </p>
              </div>
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              href="/doctor/reports"
              className="group inline-flex items-center gap-2 rounded-full bg-slate-900 pl-5 pr-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 transition-colors"
            >
              Open clinical inbox
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/doctor/patients"
              className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white/80 px-4 py-2.5 text-sm font-medium text-slate-700 hover:border-stone-400 hover:bg-white transition-colors"
            >
              Patient registry
            </Link>
            <Link
              href="/doctor/profile"
              className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white/80 px-4 py-2.5 text-sm font-medium text-slate-700 hover:border-stone-400 hover:bg-white transition-colors"
            >
              Your profile
            </Link>
          </div>
        </header>

        {/* ── STAT ROW ─────────────────────────────────────────────────── */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            eyebrow="Needs review"
            value={pendingCount}
            loading={loading}
            href="/doctor/reports"
            accent={pendingCount > 0 ? "amber" : "quiet"}
            hint={
              pendingCount > 0
                ? pendingCount === 1
                  ? "Awaiting your read"
                  : "Awaiting your reads"
                : "You are caught up"
            }
          />
          <StatCard
            eyebrow="Approved cases"
            value={reportsCount}
            loading={loading}
            href="/doctor/reports"
            accent="quiet"
            hint="Total reviewed to date"
          />
          <StatCard
            eyebrow="Kit orders"
            value={kitOrdersCount}
            loading={loading}
            href="/doctor/orders"
            accent="quiet"
            hint="Ready for fulfillment"
          />
          <StatCard
            eyebrow="Patients"
            value={patientsCount}
            loading={loading}
            href="/doctor/patients"
            accent="quiet"
            hint="Registered in your clinic"
          />
        </section>

        {/* ── INBOX PREVIEW ────────────────────────────────────────────── */}
        <section className="space-y-6">
          <div className="flex items-end justify-between gap-4">
            <div className="space-y-1.5">
              <span className="inline-block text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-500">
                Recent activity
              </span>
              <h2 className="font-serif text-2xl text-slate-900">
                Today's inbox
              </h2>
            </div>
            <Link
              href="/doctor/reports"
              className="inline-flex items-center gap-1 text-sm text-slate-700 hover:text-slate-900"
            >
              View all
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
            {loading ? (
              <SkeletonList />
            ) : (stats?.recent.length ?? 0) === 0 ? (
              <EmptyInbox />
            ) : (
              <ul className="divide-y divide-stone-100">
                {stats!.recent.map((r) => (
                  <InboxRow key={r.id} row={r} />
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────── */

function StatCard({
  eyebrow,
  value,
  hint,
  loading,
  href,
  accent,
}: {
  eyebrow: string;
  value: number | string;
  hint: string;
  loading: boolean;
  href: string;
  accent: "amber" | "quiet";
}) {
  const dot =
    accent === "amber"
      ? "bg-amber-500"
      : "bg-stone-300";
  const numeral =
    accent === "amber" ? "text-slate-900" : "text-slate-800";

  return (
    <Link
      href={href}
      className="group relative flex flex-col justify-between rounded-2xl border border-stone-200 bg-white p-6 hover:border-stone-300 hover:shadow-[0_1px_2px_rgba(15,23,42,0.04),0_16px_40px_-24px_rgba(15,23,42,0.14)] transition-all"
    >
      <div className="flex items-center gap-2">
        <span className={`inline-flex h-1.5 w-1.5 rounded-full ${dot}`} />
        <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-stone-500">
          {eyebrow}
        </span>
      </div>
      <div className="mt-6 flex items-baseline gap-3">
        {loading ? (
          <span className="inline-block h-9 w-14 rounded bg-stone-100 animate-pulse" />
        ) : (
          <span className={`font-serif text-5xl leading-none tracking-tight tabular-nums ${numeral}`}>
            {value}
          </span>
        )}
      </div>
      <div className="mt-4 flex items-center justify-between text-xs text-stone-500">
        <span>{hint}</span>
        <ArrowUpRight className="h-3.5 w-3.5 text-stone-300 transition-colors group-hover:text-stone-500" />
      </div>
    </Link>
  );
}

function InboxRow({ row }: { row: RecentRow }) {
  const initials =
    row.patientName
      ?.split(/\s+/)
      .filter(Boolean)
      .map((s) => s[0]?.toUpperCase())
      .slice(0, 2)
      .join("") || "•";

  return (
    <li>
      <Link
        href={`/doctor/reports/${row.id}`}
        className="group flex items-center gap-4 px-5 py-4 hover:bg-stone-50 focus:outline-none focus:bg-stone-50 transition-colors"
      >
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-stone-100 to-stone-200 text-xs font-medium text-stone-600">
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-medium text-slate-900">
              {row.patientName}
            </p>
            <InboxStatus status={row.status} />
          </div>
          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-stone-500">
            <Clock className="h-3 w-3" />
            {row.clinicName}
            {row.submittedAt && (
              <>
                <span className="mx-1 h-0.5 w-0.5 rounded-full bg-stone-300" />
                {waitingTime(row.submittedAt)}
              </>
            )}
          </p>
        </div>
        <ChevronRight className="h-4 w-4 text-stone-300 transition-transform group-hover:translate-x-0.5 group-hover:text-stone-500" />
      </Link>
    </li>
  );
}

function InboxStatus({ status }: { status: string }) {
  // The inbox row only carries assessment status; workflow composer handles
  // the missing decision/approval as unknown, which is the correct read for
  // the "recent activity" strip on the home page.
  const w = composeWorkflowLabel({ assessmentStatus: status });
  return <StatusBadge tone={w.tone}>{w.label}</StatusBadge>;
}

function SkeletonList() {
  return (
    <ul className="divide-y divide-stone-100 animate-pulse">
      {Array.from({ length: 5 }).map((_, i) => (
        <li key={i} className="flex items-center gap-4 px-5 py-4">
          <div className="h-10 w-10 rounded-full bg-stone-100" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-40 rounded bg-stone-100" />
            <div className="h-3 w-60 rounded bg-stone-100" />
          </div>
          <div className="h-3 w-14 rounded bg-stone-100" />
        </li>
      ))}
    </ul>
  );
}

function EmptyInbox() {
  return (
    <div className="px-6 py-16 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-stone-100">
        <Inbox className="h-5 w-5 text-stone-400" />
      </div>
      <p className="mt-4 font-serif text-lg text-slate-800">
        A rare quiet morning.
      </p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-stone-500">
        New consultations will appear here the moment a patient completes their
        assessment.
      </p>
      <Link
        href="/doctor/patients"
        className="mt-6 inline-flex items-center gap-1.5 rounded-full border border-stone-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:border-stone-400"
      >
        <Users className="h-3.5 w-3.5" />
        Browse patient registry
      </Link>
    </div>
  );
}
