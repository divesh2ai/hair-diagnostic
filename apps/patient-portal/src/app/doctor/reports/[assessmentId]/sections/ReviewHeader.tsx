"use client";

import { User, Phone, Mail, Building2, MessageCircle } from "lucide-react";
import type { ConsultationPatient } from "@shared/types/consultation";
import type { ReviewVisitContext } from "@/lib/consultation/loadReview";
import { waitingTime } from "@/lib/format/waitingTime";
import { useHydrated } from "@/lib/format/useHydrated";

// WHO IS THIS PATIENT? — the first question the review answers.
//
// ── The one rule this component exists to hold ──────────────────────────────
// Review priority and clinical severity are different things and must never
// share a visual language. "Priority review" is an operational statement about
// a queue; "Severe" is a statement about a person's disease. A doctor who sees
// them in the same row of the same badge style will read one as the other, and
// the mistake runs in the dangerous direction: a routine case flagged
// operationally starts looking clinically urgent.
//
// So: this header carries operational context only — who, why they came, how
// long they have waited, and where the review stands. Clinical severity is
// rendered by FindingsSection and appears nowhere here.
//
// ── Waiting time ────────────────────────────────────────────────────────────
// Measured from `submittedAt` (assessment submitted), never from intake or
// page load. That definition is shared with the dashboard queue; if the two
// ever disagree the doctor is looking at two different clocks for one patient.

/** Visit intents, as stored on Assessment.visitType. */
const VISIT_INTENT_LABELS: Record<string, string> = {
  INITIAL: "Initial visit",
  FOLLOW_UP: "Follow-up",
  KIT_FULFILMENT: "Kit fulfilment",
  REASSESSMENT: "Reassessment",
  NEW_CONCERN: "New concern",
  CONDITION_CHANGED: "Condition changed",
};

/**
 * Operational review pathways.
 *
 * Rendered only when the field is actually populated. The classifier that
 * writes it is currently disabled and has classified none of the live
 * assessments, so the overwhelmingly common case is null — and a null must
 * render nothing rather than defaulting to "Standard review", which would
 * state a classification that was never made.
 */
const PATHWAY_LABELS: Record<string, string> = {
  ROUTINE_REVIEW: "Routine review",
  FOCUSED_REVIEW: "Focused review",
  EXAMINATION_REQUIRED: "Examination required",
  RESOLUTION_REQUIRED: "Resolution required",
};

function whatsappHref(phone: string, patientName: string): string {
  const digits = phone.replace(/[^0-9]/g, "");
  const firstName = patientName?.split(" ")[0] ?? "";
  const text = `Hi ${firstName}, this is your dermatologist following up on your Dr FACT report. Let me know if you have any questions.`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export interface ReviewHeaderProps {
  patient: ConsultationPatient;
  clinicName: string | null;
  visit: ReviewVisitContext | null;
  contentVersion: number;
  /** Approval badge + report pill, owned by the parent. */
  statusSlot?: React.ReactNode;
}

export function ReviewHeader({
  patient,
  clinicName,
  visit,
  contentVersion,
  statusSlot,
}: ReviewHeaderProps) {
  // Rendered by the browser, never by the server.
  //
  // `toLocaleString` formats in the runtime's locale and time zone. This page
  // server-renders, so the server emitted ITS reading of the moment — a
  // hydration mismatch locally, and on Vercel a UTC timestamp shown to a
  // doctor who is not in UTC. Waiting for the client is what keeps the time
  // the reader's own. `waitingTime` needs no gate: arithmetic on a UTC instant
  // is already runtime-independent.
  const hydrated = useHydrated();
  const relationship = visit?.patientRelationship ?? null;
  const intentLabel = visit?.visitType ? VISIT_INTENT_LABELS[visit.visitType] : null;
  const pathwayLabel = visit?.reviewPathway ? PATHWAY_LABELS[visit.reviewPathway] : null;
  // The shared helper, not a local variant. Its own header says why: every
  // doctor surface must read the same, and the number here has to match the
  // one the doctor just saw beside this patient in the queue.
  const waiting = visit?.submittedAt ? waitingTime(visit.submittedAt) : null;
  const submitted = visit?.submittedAt ? new Date(visit.submittedAt) : null;

  return (
    // Compact case strip. One card, two rows of dense context, so the doctor
    // reaches the clinical conclusion immediately instead of scrolling past a
    // tall banner. Every field is real payload — nothing is invented for a
    // missing value; an absent field simply does not render.
    <section className="rounded-xl border border-stone-200 bg-white px-5 py-3.5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          {/* Identity + why they are here, on one line. */}
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <h1 className="flex items-center gap-2 font-serif text-lg text-slate-900">
              <User className="h-4 w-4 text-slate-400" aria-hidden />
              {patient.name || "(unnamed patient)"}
            </h1>
            {relationship && <RelationshipChip relationship={relationship} />}
            {intentLabel && (
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                {intentLabel}
              </span>
            )}
            {/* Operational only — visually quiet, not in any clinical family. */}
            {pathwayLabel && (
              <span className="rounded-full border border-stone-300 px-2 py-0.5 text-[11px] font-medium text-stone-600">
                {pathwayLabel}
              </span>
            )}
          </div>

          {/* Age · sex · clinic · submitted · waiting · contact — one dense
              row. Middot separators come from the flex gap + leading dots. */}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
            {patient.age != null && <span>{patient.age} yrs</span>}
            {patient.sex && <span className="capitalize">{patient.sex}</span>}
            {clinicName && (
              <span className="inline-flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                {clinicName}
              </span>
            )}
            {submitted && hydrated && (
              <span>
                Submitted{" "}
                <time dateTime={submitted.toISOString()}>
                  {submitted.toLocaleString(undefined, {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </span>
            )}
            {waiting && (
              <span className="font-medium text-slate-700">Waiting {waiting}</span>
            )}
            {patient.phone && (
              <span className="inline-flex items-center gap-1">
                <Phone className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                {patient.phone}
              </span>
            )}
            {patient.email && (
              <span className="inline-flex items-center gap-1">
                <Mail className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                {patient.email}
              </span>
            )}
            {patient.phone && (
              <a
                href={whatsappHref(patient.phone, patient.name)}
                target="_blank"
                rel="noreferrer"
                // Deliberately NOT green. Green on this surface means a
                // decision was made and saved; spending it on a contact
                // affordance is what makes the approval green stop reading as
                // approval. Plum is the brand accent and carries the action
                // just as well.
                className="inline-flex items-center gap-1 rounded-full bg-[color:var(--hd-primary-tint)] px-2 py-0.5 font-medium text-[color:var(--hd-primary-dark)] ring-1 ring-[color:var(--hd-primary-border)] hover:bg-[color:var(--hd-primary-border)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--hd-primary-dark)]"
              >
                <MessageCircle className="h-3 w-3" aria-hidden />
                WhatsApp
              </a>
            )}
          </div>
        </div>

        {/* Review status stays top-right, always visible — not only at the
            bottom decision bar. */}
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {statusSlot}
          <span className="text-[11px] text-stone-500">Version {contentVersion}</span>
        </div>
      </div>
    </section>
  );
}

/**
 * NEW / RETURNING / AMBIGUOUS.
 *
 * AMBIGUOUS is shown as its own state rather than folded into RETURNING: intake
 * found more than one record carrying this number and refused to pick one, so
 * telling the doctor "returning" would assert a history that has not actually
 * been established. Never colour alone — each carries its own word.
 */
function RelationshipChip({ relationship }: { relationship: string }) {
  if (relationship === "NEW") {
    return (
      <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-sky-800 ring-1 ring-sky-200">
        New patient
      </span>
    );
  }
  if (relationship === "RETURNING") {
    return (
      <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-teal-800 ring-1 ring-teal-200">
        Returning
      </span>
    );
  }
  if (relationship === "AMBIGUOUS") {
    return (
      <span
        className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-900 ring-1 ring-amber-200"
        title="More than one record carries this mobile number. Identity has not been confirmed."
      >
        Identity unconfirmed
      </span>
    );
  }
  return null;
}
