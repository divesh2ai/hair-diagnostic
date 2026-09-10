"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ListChecks, MapPin, UserRound } from "lucide-react";

// THE COMMAND BAND — the first thing the doctor sees, and the only dark panel
// on the surface.
//
// ── What it replaced, and why ───────────────────────────────────────────────
// Two components used to do this job at opposite ends of the page: a header
// that spent a full band on a greeting and a "View full queue" link, and a
// "Today's overview" strip of five counts that sat BELOW everything else — the
// least-read position on the page, given to the most scannable information on
// it. Between them the page said "ready for review" three times and "view full
// queue" twice, and still made the doctor scroll to learn how the day was
// going.
//
// One band now answers all three questions in the order they are asked:
//   Who am I and where am I working?   → greeting + clinic + date
//   What is the single next action?     → the next patient, by name, one click
//   How is the day going?               → the five counts, on one rail
//
// ── Honesty ─────────────────────────────────────────────────────────────────
// Every number is the stats route's own count; the labels say "today" wherever
// the count is scoped to today, because a bare "Approved" on a console band
// states nothing about which period it covers. The primary action names the
// patient at the FRONT OF THE QUEUE — the same FIFO front the deck shows — and
// is replaced by a plain link to the queue when nothing is waiting. Nothing
// here is a clinical claim; no severity, diagnosis or decision appears in this
// band.

export interface CommandMetric {
  key: string;
  value: number;
  label: string;
  href?: string;
}

export function CommandBand({
  greeting,
  clinicName,
  dateLabel,
  photoUrl,
  metrics,
  nextPatientName,
  nextPatientHref,
  loading,
}: {
  greeting: string;
  clinicName: string | null;
  dateLabel: string;
  photoUrl: string | null;
  metrics: CommandMetric[];
  /** Front of the FIFO queue. Null when nothing is waiting. */
  nextPatientName: string | null;
  nextPatientHref: string | null;
  loading: boolean;
}) {
  const hasNext = Boolean(nextPatientName && nextPatientHref);

  return (
    <section className="hd-command" aria-label="Clinic overview">
      <div className="relative flex flex-wrap items-center justify-between gap-x-8 gap-y-5 px-5 py-6 sm:px-7 sm:py-7">
        <div className="flex min-w-0 items-center gap-4">
          <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-white/10 ring-1 ring-white/20">
            {photoUrl ? (
              <Image src={photoUrl} alt="" fill sizes="48px" className="object-cover" unoptimized />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-white/70">
                <UserRound className="h-5 w-5" />
              </span>
            )}
          </span>
          <div className="min-w-0">
            {/* Wraps rather than truncates: on a 375px screen "Good evening,
                Dr Divesh." was clipped to "Good evening, Dr Di…", which turns a
                greeting into a defect. */}
            <h1 suppressHydrationWarning className="hd-command-greeting text-balance">
              {greeting}
            </h1>
            <p suppressHydrationWarning className="hd-command-meta mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
              {clinicName && (
                <span className="flex min-w-0 items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                  <span className="truncate">{clinicName}</span>
                </span>
              )}
              {clinicName && <span aria-hidden className="opacity-40">·</span>}
              {/* Locale formatting differs between the Node render and the
                  browser, so the text-bearing element carries the suppression
                  itself — a parent's flag does not reach nested spans. */}
              <span suppressHydrationWarning>{dateLabel}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {hasNext ? (
            <>
              <Link
                href={nextPatientHref as string}
                className="hd-command-cta"
                aria-label={`Review the next patient, ${nextPatientName}`}
              >
                <span className="flex flex-col items-start leading-tight">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-75">
                    Next patient
                  </span>
                  <span>{nextPatientName}</span>
                </span>
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link href="/doctor/reports?tab=needs_review" className="hd-command-cta-quiet">
                <ListChecks className="h-4 w-4 opacity-80" aria-hidden />
                Full queue
              </Link>
            </>
          ) : (
            <Link href="/doctor/reports" className="hd-command-cta-quiet">
              <ListChecks className="h-4 w-4 opacity-80" aria-hidden />
              Open review queue
            </Link>
          )}
        </div>
      </div>

      {/* A plain grid, not a <dl>: half these cells are links, and an <a>
          wrapping <dt>/<dd> is invalid inside a description list. */}
      <div
        className="hd-command-rail relative grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
        role="group"
        aria-label="Clinic activity"
      >
        {metrics.map((metric) => (
          <MetricCell key={metric.key} metric={metric} loading={loading} />
        ))}
      </div>
    </section>
  );
}

function MetricCell({ metric, loading }: { metric: CommandMetric; loading: boolean }) {
  const body = (
    <>
      <span
        className="hd-command-value block"
        data-muted={metric.value === 0 ? "true" : "false"}
      >
        {loading ? (
          <span className="inline-block h-6 w-8 animate-pulse rounded bg-white/15 align-middle" />
        ) : (
          metric.value.toLocaleString()
        )}
      </span>
      <span className="hd-command-label block">{metric.label}</span>
    </>
  );

  if (metric.href) {
    return (
      <Link href={metric.href} className="hd-command-metric">
        {body}
      </Link>
    );
  }
  return <div className="hd-command-metric">{body}</div>;
}
