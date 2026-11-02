import Link from "next/link";
import { notFound } from "next/navigation";
import { getMonitorData } from "@/lib/data";
import { requireSuperAdmin } from "@/lib/auth";
import { STAGE_LABEL, labelProvisioning, type RawAssessment } from "@/lib/metrics";

export const dynamic = "force-dynamic";

function fmtDate(d: string | null): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function decisionPill(a: RawAssessment) {
  if (a.reviewDecision === "APPROVED") return <span className="pill ap">Approved</span>;
  if (a.reviewDecision === "PENDING") return <span className="pill pe">Pending review</span>;
  return <span className="pill no">{a.reviewDecision ?? "—"}</span>;
}

function reportPill(a: RawAssessment) {
  const s = a.reportStatuses ?? "";
  if (s.includes("READY")) return <span className="pill rd">Ready</span>;
  if (s.includes("QUEUED")) return <span className="pill qd">Queued</span>;
  if (s.includes("FAILED")) return <span className="pill pe">Failed</span>;
  return <span className="pill no">None</span>;
}

/** Per-patient actionable issue for the drilldown. */
function rowIssue(a: RawAssessment): string | null {
  if (a.reviewDecision === "PENDING") return "Awaiting doctor review";
  if (a.reviewDecision === "APPROVED" && (a.reportStatuses ?? "").includes("READY") && a.waSent === 0)
    return "Approved & report ready — not delivered on WhatsApp";
  if (a.reviewDecision === "APPROVED" && a.reportStatuses && !a.reportStatuses.includes("READY"))
    return "Approved — report still rendering";
  if (a.reviewDecision === "PENDING" && a.consultApproval === "APPROVED")
    return "Report approved but assessment review still pending — reconcile";
  return null;
}

export default async function ClinicDrilldown({ params }: { params: { slug: string } }) {
  await requireSuperAdmin();
  const data = await getMonitorData();
  const clinic = data.clinics.find((c) => c.slug === params.slug);
  if (!clinic) notFound();

  const rows = data.assessments.filter((a) => a.clinicSlug === params.slug);

  return (
    <main className="wrap">
      <Link className="back" href="/admin">← All clinics</Link>
      <div className="topbar" style={{ marginTop: 10 }}>
        <div>
          <h1>{clinic.name}</h1>
          <div className="subtitle">
            {clinic.doctorName ?? "No doctor"} · {clinic.provider ? `${clinic.provider} auth` : "no auth provider"}
            {clinic.authIdentifier ? ` (${clinic.authIdentifier})` : ""}
          </div>
        </div>
        <div className="sourcetag">
          <span className={`badge ${clinic.adoptionStage === "USING_HAIROS" ? "using" : clinic.adoptionStage === "LOGGED_IN_NO_REVIEWS" ? "logged" : "never"}`}>
            {STAGE_LABEL[clinic.adoptionStage]}
          </span>
        </div>
      </div>

      <div className="kpis" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
        <div className="kpi"><div className="v">{clinic.submitted}</div><div className="l">Submitted</div></div>
        <div className="kpi"><div className="v ok">{clinic.approved}</div><div className="l">Doctor-approved</div></div>
        <div className="kpi"><div className="v warn">{clinic.pending}</div><div className="l">Pending review</div></div>
        <div className="kpi"><div className="v">{clinic.reportReady}/{clinic.reportReady + clinic.reportQueued}</div><div className="l">Reports ready</div></div>
      </div>

      <div className="split">
        <div className="panel">
          <h3>Identity &amp; authentication</h3>
          <div className="meta-row" style={{ border: 0, padding: 0, flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
            <span>Clinic status: <b>{clinic.clinicStatus}</b></span>
            <span>Provisioning: <b>{labelProvisioning(clinic.provisioning)}</b></span>
            <span>Auth provider: <b>{clinic.provider ?? "—"}</b></span>
            <span>Last successful sign-in: <b>{fmtDate(clinic.lastSignInAt)}</b></span>
            <span>Last review: <b>{fmtDate(clinic.lastReviewAt)}</b></span>
          </div>
        </div>
        <div className="panel">
          <h3>Actionable issues</h3>
          {clinic.issues.length === 0 ? (
            <div className="issue ok">No blocking issues.</div>
          ) : (
            <div className="issues" style={{ border: 0, padding: 0, background: "transparent" }}>
              {clinic.issues.map((i, idx) => (
                <div key={idx} className={`issue ${i.level}`}>
                  <span className="tag">{i.level === "blocked" ? "Blocked" : "Watch"}</span>
                  <span>{i.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="panel" style={{ padding: 0, overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Patient</th><th>Submitted</th><th>Processing</th><th>Doctor decision</th>
              <th>Reviewed</th><th>Report</th><th>Kit</th><th>WhatsApp</th><th>Needs action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a, idx) => {
              const issue = rowIssue(a);
              return (
                <tr key={idx}>
                  <td><b>{a.patient}</b><div style={{ color: "var(--muted)", fontSize: 11 }}>{a.age ?? "—"} · {a.gender ?? "—"}</div></td>
                  <td>{fmtDate(a.submitted)}</td>
                  <td><span className="pill no">{a.procStatus ?? "—"}</span></td>
                  <td>{decisionPill(a)}</td>
                  <td>{fmtDate(a.reviewedAt)}</td>
                  <td>{reportPill(a)}</td>
                  <td>{a.kit > 0 ? "Yes" : "—"}</td>
                  <td>{a.waSent > 0 ? <span className="pill ap">Sent</span> : <span className="pill no">—</span>}</td>
                  <td style={{ color: issue ? "var(--warn)" : "var(--muted)", fontSize: 12 }}>{issue ?? "—"}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={9} style={{ color: "var(--muted)" }}>No patient assessments submitted yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="footer">
        Clinic-level isolation preserved: only a platform Super Admin reaches this view, and patient names are shown as
        initials only. Approval reflects the doctor review decision, not automated processing status.
      </div>
    </main>
  );
}
