import { notFound, redirect } from "next/navigation";
import { OnePageHairReport } from "@/components/reports/one-page/OnePageHairReport";
import { OnePageReportActions } from "@/components/reports/one-page/OnePageReportActions";
import { loadOnePageReportData, ReportAccessError } from "@/lib/reports/one-page/loadReport";

export const dynamic = "force-dynamic";

export default async function OnePageReportRoute({
  params,
  searchParams,
}: {
  params: Promise<{ assessmentId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { assessmentId } = await params;
  // `t` is the signed review token the patient preview page already appends to
  // its "Patient Report" link. It is only honoured in conference mode — see
  // lib/conferenceMode.
  const rawToken = (await searchParams)?.t;
  const reviewToken = Array.isArray(rawToken) ? rawToken[0] : rawToken;
  const data = await readReportData(assessmentId, reviewToken ?? null);

  // Validation output is an internal QA diagnostic. It used to render as a
  // red banner at the top of the report, which put engineering language
  // ("Doctor-Reviewed Result is too short (37 words)…") in front of the
  // patient and the reviewing doctor. It stays on the view model for tests
  // and dev tooling, and is logged server-side, but never renders here.
  if (!data.validation.ok) {
    console.warn(
      `[one-page-report] validation errors for ${assessmentId}:`,
      data.validation.errors.join(" | "),
    );
  }
  if (data.validation.warnings.length > 0) {
    console.info(
      `[one-page-report] validation warnings for ${assessmentId}:`,
      data.validation.warnings.join(" | "),
    );
  }

  return (
    <>
      <OnePageReportActions
        assessmentId={assessmentId}
        patientName={data.patient?.name ?? null}
        clinicName={data.clinic?.name ?? null}
        patientWhatsapp={data.patient?.phone ?? null}
      />
      <OnePageHairReport data={data} />
    </>
  );
}

async function readReportData(assessmentId: string, reviewToken: string | null) {
  try {
    return await loadOnePageReportData(assessmentId, { reviewToken });
  } catch (err) {
    if (err instanceof ReportAccessError) {
      if (err.status === 404) notFound();
      if (err.status === 401 || err.status === 403) {
        redirect(`/login?next=${encodeURIComponent(`/reports/${assessmentId}/one-page`)}`);
      }
    }
    throw err;
  }
}

