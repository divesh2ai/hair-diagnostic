"use client";

import { useCallback, useMemo, useState } from "react";
import { EyeIcon } from "lucide-react";
import { useMinuteTick, useVisibilityPolling } from "@/lib/doctor/useLiveDashboard";
// TYPE-ONLY. lib/doctor/dashboardStats imports Prisma; a value import from it
// would drag the client into the browser bundle and fail at runtime.
import type { DashboardCounts, DashboardStats } from "@/lib/doctor/dashboardStats";
import { toDeckCard } from "@/lib/doctor/patientDeck";
import { CommandBand, type CommandMetric } from "@/components/doctor/dashboard/CommandBand";
import { PatientDeck } from "@/components/doctor/dashboard/PatientDeck";
import { LiveClinicPanel } from "@/components/doctor/dashboard/LiveClinicPanel";
import {
  AttentionPanel,
  type AttentionItem,
} from "@/components/doctor/dashboard/AttentionPanel";
import { buildDashboardAttention } from "@/lib/doctor/dashboardAttention";

// Doctor Dashboard V4 — a clinical command centre.
//
// Four questions, answered in the order a doctor asks them:
//   1. What is the state of my day?  → the command band (identity + counts)
//   2. Who do I review next?         → the Patient Deck (front card = next)
//   3. Who is in clinic now?         → Live in Clinic
//   4. Is anything stuck?            → Needs Attention
//
// It is NOT the Review Queue. The deck shows the next few actionable patients
// in the queue's own FIFO order; the full backlog stays on /doctor/reports, one
// click away.
//
// ── What changed in V4 ──────────────────────────────────────────────────────
// The five day counts moved from a pale strip at the BOTTOM of the page into
// the band at the top, where they are read; the greeting header and that strip
// are gone as separate components. The page adopts the Doctor token layer
// (`data-surface="doctor"`), so it is materially the same product as the review
// page instead of a second, colder grey theme. And the page no longer opens on
// a skeleton: `initialStats` is server-rendered — see page.tsx.
//
// ── Data ────────────────────────────────────────────────────────────────────
// Still exactly one endpoint. /api/doctor/stats (one Promise.all: counts +
// queue + in-clinic), polled every 15s while visible. Identity now arrives as
// props from the server render instead of a second /api/doctor/me request. No
// widget opens its own connection.

interface DoctorDashboardClientProps {
  /** Server-rendered first frame. Null only when the first read failed. */
  initialStats: DashboardStats | null;
  doctorName: string | null;
  photoUrl: string | null;
  clinicName: string | null;
  role: string;
}

// Only ever shown after a failed reload, when the real counts are unknown.
const EMPTY_COUNTS: DashboardCounts = {
  pending: 0,
  inProgress: 0,
  approvedToday: 0,
  reviewedToday: 0,
  kitOrders: 0,
};

export function DoctorDashboardClient({
  initialStats,
  doctorName,
  photoUrl,
  clinicName,
  role,
}: DoctorDashboardClientProps) {
  const [stats, setStats] = useState<DashboardStats | null>(initialStats);
  // The server already resolved the first frame, so there is no loading state
  // to open on. Only an explicit retry after a failure returns here.
  const [loading, setLoading] = useState(false);
  const [statsError, setStatsError] = useState(initialStats === null);

  const minuteTick = useMinuteTick();

  const loadStats = useCallback(async (background = false) => {
    if (!background) {
      setLoading(true);
      setStatsError(false);
    }
    try {
      const res = await fetch("/api/doctor/stats");
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as DashboardStats & { error?: string };
      if (data.error) throw new Error(data.error);
      setStats(data);
      setStatsError(false);
    } catch {
      // A failed poll must never wipe a queue the doctor is reading — the last
      // good data stays; only an explicit failed reload shows the error state.
      if (!background) {
        setStats(null);
        setStatsError(true);
      }
    } finally {
      if (!background) setLoading(false);
    }
  }, []);

  useVisibilityPolling(() => loadStats(true));

  const counts = stats?.counts ?? EMPTY_COUNTS;
  const queue = useMemo(() => stats?.queue ?? [], [stats]);
  const inClinic = stats?.inClinic ?? [];
  const inClinicTotal = stats?.inClinicTotal ?? counts.inProgress ?? inClinic.length;

  const firstName = useMemo(() => firstNameOf(doctorName), [doctorName]);

  // Greeting and date are clock- and locale-dependent, so the server's render
  // and the browser's can differ; both carry `suppressHydrationWarning` where
  // they are printed, exactly as the previous header did. They are courtesies,
  // not clinical values — no timestamp a doctor reads for a decision is
  // rendered this way (see PatientDeckCard, which withholds its tooltip until
  // hydration instead).
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    const part = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
    return firstName ? `${part}, Dr ${firstName}.` : `${part}.`;
  }, [firstName]);

  const dateLabel = new Date().toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  // The front of the FIFO queue — the same card the deck shows first, so the
  // band's primary action and the deck can never point at different patients.
  const nextCard = queue.length > 0 ? toDeckCard(queue[0]) : null;

  // The deck renders at most five cards — see PatientDeck's MAX_CARDS.
  const shownInDeck = Math.min(queue.length, 5);

  // Operational exceptions, derived only from data we actually hold. Rebuilt
  // on the minute tick so "waiting > 15 min" stays honest without a request.
  // The rules themselves live in lib/doctor/dashboardAttention so they can be
  // tested without rendering anything.
  const attentionItems = useMemo<AttentionItem[]>(
    () => {
      void minuteTick;
      return buildDashboardAttention({ counts, queue });
    },
    [counts, queue, minuteTick],
  );

  // Labels say "today" wherever the count is scoped to today. On a bare console
  // rail, "Approved" alone states no period — and a doctor reading it as a
  // running total would be reading a different number than the one we sent.
  const metrics = useMemo<CommandMetric[]>(
    () => [
      {
        key: "ready",
        // "Hair", explicitly. This count is hair-only BY CONSTRUCTION, not by
        // intention: /api/assessment/submit orchestrates `concern === 'hair'`
        // and nothing else, so a Skin FACT case never leaves PENDING and can
        // never enter REVIEW_QUEUE_STATUSES. The Review Queue page it links to
        // additionally lists skin intakes awaiting their own review, so the
        // number there is legitimately larger. An unqualified "Ready for
        // review" beside a queue showing more rows reads as a miscount; naming
        // the domain is the smallest way to make both true at once.
        value: counts.pending,
        label: "Hair reviews ready",
        href: "/doctor/reports?tab=needs_review",
      },
      { key: "in-clinic", value: counts.inProgress, label: "In clinic now" },
      {
        // A real superset of "approved" — every decision made today. See the
        // stats loader: reviewedAt is stamped for all terminal decisions.
        key: "reviewed",
        value: counts.reviewedToday,
        label: "Reviewed today",
        href: "/doctor/reports",
      },
      {
        key: "approved",
        value: counts.approvedToday,
        label: "Approved today",
        href: "/doctor/reports?tab=approved",
      },
      {
        key: "fulfilment",
        value: counts.kitOrders,
        label: "Awaiting fulfilment",
        href: "/doctor/orders",
      },
    ],
    [counts],
  );

  return (
    // `data-surface="doctor"` scopes the HairOS Doctor token layer to this tree
    // — the same layer the review page uses, so the two surfaces are one
    // product. See styles/doctor-tokens.css for why the tokens are not global.
    <div
      data-surface="doctor"
      className="min-h-full bg-[color:var(--hd-bg)]"
    >
      <div className="mx-auto w-full max-w-6xl space-y-6 px-5 pb-20 pt-6 sm:px-6 lg:px-10">
        {role === "SUPER_ADMIN" && (
          <div className="flex items-start gap-2 rounded-xl border border-[color:var(--hd-medical-edge)] bg-[color:var(--hd-medical-tint)] px-4 py-2.5 text-xs text-[color:var(--hd-medical-ink)]">
            <EyeIcon className="mt-0.5 size-3.5 shrink-0" />
            <span>
              <strong>Viewing as super admin.</strong> This is the doctor
              workspace view. All actions are audit-logged as super-admin
              activity — please avoid clinical decisions from this account.
            </span>
          </div>
        )}

        {/* ── 1 · THE STATE OF THE DAY ──────────────────────────────────── */}
        <CommandBand
          greeting={greeting}
          clinicName={clinicName}
          dateLabel={dateLabel}
          photoUrl={photoUrl}
          metrics={metrics}
          nextPatientName={nextCard?.name ?? null}
          nextPatientHref={nextCard?.href ?? null}
          loading={loading}
        />

        {/* ── 2 · WHO DO I REVIEW NEXT? ─────────────────────────────────── */}
        <section aria-labelledby="deck-heading" className="space-y-3 pt-1">
          <div className="flex items-baseline gap-2.5">
            <h2 id="deck-heading" className="hd-eyebrow">
              Up next
            </h2>
            {/* Only when the deck is actually holding back a backlog. With one
                patient waiting, "1 of 1 waiting" is a counter that counts
                nothing — and the band overhead already says how many are
                ready. */}
            {counts.pending > shownInDeck && (
              <span className="text-[11px] tabular-nums text-[color:var(--hd-text-muted)]">
                Showing {shownInDeck} of {counts.pending}
              </span>
            )}
          </div>
          <PatientDeck
            rows={queue}
            tick={minuteTick}
            loading={loading}
            error={statsError}
            approvedToday={counts.approvedToday}
            inProgress={counts.inProgress}
            onRetry={loadStats}
          />
        </section>

        {/* ── 3 · LIVE IN CLINIC · 4 · NEEDS ATTENTION ──────────────────── */}
        <div className="grid gap-5 lg:grid-cols-2">
          <LiveClinicPanel visits={inClinic} total={inClinicTotal} tick={minuteTick} />
          <AttentionPanel items={attentionItems} />
        </div>
      </div>
    </div>
  );
}

function firstNameOf(name: string | null | undefined): string | null {
  if (!name) return null;
  const cleaned = name.replace(/^\s*dr\.?\s+/i, "").trim();
  const first = cleaned.split(/\s+/)[0];
  return first || null;
}
