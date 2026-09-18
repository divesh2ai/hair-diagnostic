import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Clock, User } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getAuthClaims } from "@/lib/auth";
import { doctorAuthIdentityWhere } from "@/lib/auth/doctorIdentity";
import { isReviewUnavailable } from "@/lib/doctor/reviewHref";
import "@/styles/doctor-tokens.css";

export const dynamic = "force-dynamic";

// A SKIN CASE WITH NO REVIEW PRODUCT — the case is here, the review is not.
//
// ── Why this page exists ────────────────────────────────────────────────────
// `skin_acne` is a fully implemented PATIENT questionnaire with no doctor
// review surface behind it. Until this page, `reviewHref` sent acne cases to
// the default destination — the HAIR consultation — where the `skin_` guard in
// lib/consultation/reviewPayload refused them with "the hair clinical review
// does not apply to it".
//
// That refusal is correct and must stay (it is what stopped the engines being
// fed acne answers and returning a confident "Telogen Effluvium"), but it is
// the wrong thing to route a doctor INTO. It reads as a fault in the record
// rather than a gap in the product, and it puts an unreviewable case one click
// from the surface that authorises treatment.
//
// So the queue now sends acne here instead, and this page says the true thing:
// the submission is intact, and nobody has reviewed it.
//
// It serves EVERY skin track without a surface, not acne alone, so a new
// questionnaire shipped ahead of its review lands here instead of inheriting
// the hair consultation by omission. See SKIN_ROUTES in lib/doctor/reviewHref.
//
// ── What this page is NOT ───────────────────────────────────────────────────
// It is not a review product, and it must not grow into one by accretion. It
// renders no clinical interpretation, no grading, no protocol and no decision
// control — because none of those exist for these tracks yet, and a page that
// looked like a review would be worse than this one. When a track's real
// review is built, that track gets a route in SKIN_ROUTES and stops arriving
// here.

/** Display label per track. Absent → the generic wording below. */
const TRACK_LABEL: Record<string, string> = {
  skin_acne: "Acne",
};

export default async function SkinReviewUnavailablePage({
  params,
}: {
  params: Promise<{ assessmentId: string }>;
}) {
  const { assessmentId } = await params;

  // Same gate as the rest of the doctor surface: the clinic comes from the
  // caller's own live Doctor row, never from the URL, and a case in another
  // clinic is a 404 rather than a 403 so the response cannot confirm that an
  // assessment with this id exists somewhere else.
  const claims = await getAuthClaims();
  if (!claims?.sub) redirect("/login");

  const doctor = await prisma.doctor.findFirst({
    where: { ...doctorAuthIdentityWhere(claims.sub), isActive: true, deletedAt: null },
    select: { clinicId: true },
  });
  if (!doctor) redirect("/login?reason=forbidden");

  const assessment = await prisma.assessment.findFirst({
    where: { id: assessmentId, deletedAt: null },
    select: {
      id: true,
      clinicId: true,
      submittedAt: true,
      rawResponses: true,
      reviewDecision: true,
      patient: { select: { name: true, age: true, gender: true } },
    },
  });
  if (!assessment || assessment.clinicId !== doctor.clinicId) notFound();

  const raw = (assessment.rawResponses ?? {}) as Record<string, unknown>;
  const meta = (raw.__meta ?? {}) as Record<string, unknown>;
  const concern = typeof meta.concern === "string" ? meta.concern : null;
  // Only a skin track WITHOUT its own surface belongs here. A hair case, or a
  // track that does have a review, is a miss rather than a holding screen —
  // otherwise a mistyped URL could park a reviewable case behind
  // "not available yet". The predicate is shared with the router, so a case
  // cannot be sent here and then refused by the page.
  if (!isReviewUnavailable(concern)) notFound();
  const trackLabel = (concern && TRACK_LABEL[concern]) ?? null;

  // A count, not the content. It answers the one question the doctor has here
  // — "is the patient's submission still intact?" — without this page starting
  // to look like a clinical read of answers no engine has interpreted.
  // `__meta` is session metadata, not an answer.
  const answerCount = Object.keys(raw).filter((k) => k !== "__meta").length;
  const demographic = [
    assessment.patient.age != null ? `${assessment.patient.age} yrs` : null,
    assessment.patient.gender,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div data-surface="doctor" className="mx-auto w-full max-w-3xl space-y-6 px-5 py-8">
      <Link
        href="/doctor/reports"
        className="inline-flex items-center gap-1.5 text-sm text-[color:var(--hd-text-secondary)] hover:text-[color:var(--hd-text)]"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to review queue
      </Link>

      <section className="hd-card p-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="flex items-center gap-2 font-serif text-xl text-[color:var(--hd-text)]">
            <User className="h-4 w-4 text-[color:var(--hd-text-muted)]" aria-hidden />
            {assessment.patient.name || "(unnamed patient)"}
          </h1>
          {demographic && (
            <span className="text-sm text-[color:var(--hd-text-secondary)]">{demographic}</span>
          )}
          <span className="hd-pill hd-pill-neutral">
            Dr Skin FACT{trackLabel ? " · " + trackLabel : ""}
          </span>
        </div>

        {assessment.submittedAt && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-[color:var(--hd-text-muted)]">
            <Clock className="h-3.5 w-3.5" aria-hidden />
            {/* Rendered from the ISO instant on the server in a fixed,
                locale-independent form — a doctor must not be shown a UTC
                reading of their own clock, and this page has no client half to
                defer to. */}
            Submitted {assessment.submittedAt.toISOString().slice(0, 10)}
          </p>
        )}
      </section>

      <section
        className="rounded-xl border border-[color:var(--hd-attention)] bg-[color:var(--hd-attention-tint)] p-5"
        role="status"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle
            className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--hd-attention)]"
            aria-hidden
          />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-[color:var(--hd-text)]">
              {trackLabel
                ? trackLabel + " doctor review is not available yet"
                : "Doctor review is not available for this concern yet"}
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-[color:var(--hd-text-secondary)]">
              This patient completed their Dr Skin FACT assessment and their
              answers are stored ({answerCount}{" "}
              {answerCount === 1 ? "response" : "responses"} on file). There is
              no clinical review surface for this concern in this release, so
              no interpretation, grading or plan has been produced.
            </p>
            <p className="mt-2.5 text-sm font-medium text-[color:var(--hd-text)]">
              This case has not been clinically reviewed
              {assessment.reviewDecision === "PENDING" ? "" : " on this surface"}
              , and nothing here should be treated as a clinical opinion.
            </p>
            <p className="mt-2.5 text-sm leading-relaxed text-[color:var(--hd-text-secondary)]">
              The hair consultation deliberately refuses skin answers rather
              than running its engines over inputs they do not recognise, so
              there is no hair diagnosis for this patient and there should not
              be one. Contact the patient directly if they need to be seen.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
