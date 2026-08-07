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

  return (
    <>
      {!data.validation.ok ? (
        <aside className="op-validation" aria-label="Report validation">
          <strong>One-page validation</strong>
          {data.validation.errors.map((error) => (
            <div key={error}>Error: {error}</div>
          ))}
        </aside>
      ) : null}
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

