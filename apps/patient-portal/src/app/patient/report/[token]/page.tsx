import type { Metadata } from "next";
import { OnePageHairReport } from "@/components/reports/one-page/OnePageHairReport";
import {
  composeOnePageReportViewModel,
  ReportAccessError,
} from "@/lib/reports/one-page/loadReport";
import { verifyReportShareToken } from "@/lib/reportShareToken";
import { recordPatientOpen } from "@/lib/journey/events";

// The patient's own copy of their clinical report.
//
// ── Why the token is the whole address ──────────────────────────────────────
// `/patient/report/<token>` carries no assessment id. That is not cosmetic:
// with an id in the path there are two claims about which record is meant —
// the id and the token — and every such pair has to be compared, forever, by
// every future handler that touches it. Here there is one claim, so the
// confused-deputy bug is absent rather than defended against. See
// lib/reportShareToken for the same argument stated from the verifier's side.
//
// ── What a patient can reach from here ──────────────────────────────────────
// This page and nothing else. The token's purpose field means it does not open
// the cart, does not open a doctor review link, and is not accepted by any
// /api/doctor or /api/admin route — those authenticate a session, and a token
// is not a session. There is no staff toolbar on this page either: Print,
// Download PDF, Share and Copy-link are clinic tools that belong on the
// doctor's view of the same document.
//
// ── No indexing, ever ───────────────────────────────────────────────────────
// The URL contains a live credential. A crawler that reaches one — from a
// referrer header, a browser extension, or a patient pasting the link into a
// search box — must not put it in an index.

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your hair assessment report",
  robots: { index: false, follow: false, nocache: true },
};

type Outcome =
  | { kind: "ok"; data: Awaited<ReturnType<typeof composeOnePageReportViewModel>> }
  | { kind: "expired" }
  | { kind: "invalid" }
  | { kind: "not_ready" };

export default async function PatientReportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const outcome = await resolve(token);

  if (outcome.kind === "ok") {
    return <OnePageHairReport data={outcome.data} />;
  }

  return <LinkNotice kind={outcome.kind} />;
}

async function resolve(rawToken: string): Promise<Outcome> {
  const token = decodeURIComponent(rawToken ?? "");
  const verdict = verifyReportShareToken(token);

  if (!verdict.ok) {
    // EXPIRED is separated from every other failure on purpose, and it is the
    // only one that gets a specific message.
    //
    // "This link has expired" tells the holder of a genuinely issued link what
    // to do next, and discloses nothing they did not already have: they were
    // holding a token that was, at some point, validly signed for a real
    // assessment. Every other failure — a forged signature, a mangled string,
    // a cart token replayed here — is answered identically, so probing cannot
    // distinguish "wrong signature" from "not a report token" from "garbage".
    return verdict.error === "EXPIRED" ? { kind: "expired" } : { kind: "invalid" };
  }

  try {
    // The assessment id comes from the VERIFIED payload and from nowhere else
    // — not from a query string, not from a header. This is the property the
    // token's shape is designed to make unavoidable.
    const data = await composeOnePageReportViewModel(verdict.assessmentId, {
      kind: "patient_share_token",
    });

    // Recorded after the document is successfully composed, so "the patient
    // opened their report" means they were actually shown one. Never throws —
    // engagement telemetry must not be able to break the page it measures.
    await recordPatientOpen({
      assessmentId: verdict.assessmentId,
      subject: "REPORT",
      token,
    });

    return { kind: "ok", data };
  } catch (err) {
    if (err instanceof ReportAccessError) {
      // 403 here is the approval gate in lib/reports/one-page/loadReport: the
      // consultation is no longer APPROVED, which is what happens when the
      // doctor moves the case back to revision after sending. That is the
      // token's revocation lever, and the patient should see a calm "your
      // doctor is reviewing this" rather than an error.
      //
      // 202 is "the clinical report is not composed yet", which reads the same
      // way to a patient. 404 means the assessment is gone; there is nothing
      // useful or safe to say beyond the generic notice.
      if (err.status === 403 || err.status === 202) return { kind: "not_ready" };
      return { kind: "invalid" };
    }
    throw err;
  }
}

function LinkNotice({ kind }: { kind: "expired" | "invalid" | "not_ready" }) {
  const copy = {
    expired: {
      title: "This link has expired",
      body: "For your privacy, report links stop working after a while. Please contact your clinic and they can send you a new one.",
    },
    not_ready: {
      title: "Your report is being reviewed",
      body: "Your doctor is still working on this report. You will receive a new link as soon as it is ready.",
    },
    invalid: {
      title: "This link is no longer valid",
      body: "Please contact your clinic for an up-to-date link to your report.",
    },
  }[kind];

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="text-lg font-semibold text-slate-800">{copy.title}</h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-600">{copy.body}</p>
    </main>
  );
}
