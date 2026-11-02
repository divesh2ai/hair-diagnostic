import Link from "next/link";
import { getMonitorData } from "@/lib/data";
import { requireSuperAdmin } from "@/lib/auth";
import {
  FILTERS,
  STAGE_LABEL,
  matchesFilter,
  labelProvisioning,
  type ClinicMetric,
  type FilterKey,
} from "@/lib/metrics";

export const dynamic = "force-dynamic";

function fmtDate(d: string | null): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function stageBadge(c: ClinicMetric) {
  const cls = c.adoptionStage === "USING_HAIROS" ? "using" : c.adoptionStage === "LOGGED_IN_NO_REVIEWS" ? "logged" : "never";
  return <span className={`badge ${cls}`}>{STAGE_LABEL[c.adoptionStage]}</span>;
}

function Metric({ label, value, tone }: { label: string; value: number; tone?: "warn" | "danger" }) {
  const zero = value === 0;
  return (
    <div className="metric">
      <div className={`m ${zero ? "zero" : ""}`} style={tone && !zero ? { color: `var(--${tone})` } : undefined}>{value}</div>
      <div className="mk">{label}</div>
    </div>
  );
}

export default async function AdminPage({ searchParams }: { searchParams: { filter?: string } }) {
  const admin = await requireSuperAdmin();
  const data = await getMonitorData();
  const active: FilterKey = (FILTERS.find((f) => f.key === searchParams.filter)?.key ?? "ALL") as FilterKey;

  const counts: Record<FilterKey, number> = Object.fromEntries(
    FILTERS.map((f) => [f.key, data.clinics.filter((c) => matchesFilter(c, f.key)).length]),
  ) as Record<FilterKey, number>;

  const shown = data.clinics.filter((c) => matchesFilter(c, active));
  const t = data.totals;

  const seg = (k: ClinicMetric["adoptionStage"]) => data.clinics.filter((c) => c.adoptionStage === k).length;
  const never = seg("NEVER_LOGGED_IN"), loggedNo = seg("LOGGED_IN_NO_REVIEWS"), using = seg("USING_HAIROS");

  return (
    <main className="wrap">
      <div className="topbar">
        <div>
          <h1>Clinic Usage &amp; Adoption Monitor</h1>
          <div className="subtitle">HairOS Super Admin · who has logged in, who is reviewing patients, and where the workflow is blocked</div>
        </div>
        <div className="sourcetag">
          <span><span className={`dot ${data.meta.live ? "live" : "snap"}`} /> {data.meta.live ? "Live production" : "Read-only snapshot"}</span>
          <span>· {data.meta.source}</span>
          <span>· as of {fmtDate(data.meta.extractedAt)}</span>
          <span>· auth: {admin.mode === "live" ? admin.name ?? "super admin" : "resolved server-side"}</span>
        </div>
      </div>

      {!data.meta.live && (
        <div className="note">
          Showing the verified read-only production snapshot (no service-role key configured in this environment). The live
          path queries the same tables server-side and renders identically when <code>SUPABASE_SERVICE_ROLE_KEY</code> is set.
        </div>
      )}

      {/* Separate database activation from real doctor adoption */}
      <div className="kpis">
        <div className="kpi">
          <div className="v">{t.dbActivated}<span style={{ fontSize: 15, color: "var(--muted)" }}> / {t.clinics}</span></div>
          <div className="l">Clinics activated in database</div>
          <div className="sub">Provisioned on the platform</div>
        </div>
        <div className="kpi accent">
          <div className="v ok">{t.doctorsAdopted}</div>
          <div className="l">Clinics with real doctor adoption</div>
          <div className="sub">Signed in <b>and</b> reviewing patients</div>
        </div>
        <div className="kpi">
          <div className="v">{t.doctorsWithSignIn}</div>
          <div className="l">Doctors with a recorded sign-in</div>
          <div className="sub">{never} never logged in</div>
        </div>
        <div className="kpi">
          <div className="v warn">{t.pending}</div>
          <div className="l">Assessments pending review</div>
          <div className="sub">{t.approved} doctor-approved of {t.submitted} submitted</div>
        </div>
      </div>

      <div className="split">
        <div className="panel">
          <h3>Database activation → doctor adoption</h3>
          <div className="bar">
            <span style={{ width: `${(using / t.clinics) * 100}%`, background: "var(--ok)" }} />
            <span style={{ width: `${(loggedNo / t.clinics) * 100}%`, background: "var(--warn)" }} />
            <span style={{ width: `${(never / t.clinics) * 100}%`, background: "var(--muted)" }} />
          </div>
          <div className="legend">
            <span><span className="sw" style={{ background: "var(--ok)" }} /><b>{using}</b> using HairOS</span>
            <span><span className="sw" style={{ background: "var(--warn)" }} /><b>{loggedNo}</b> logged in, no reviews</span>
            <span><span className="sw" style={{ background: "var(--muted)" }} /><b>{never}</b> never logged in</span>
          </div>
        </div>
        <div className="panel">
          <h3>Patient output &amp; delivery</h3>
          <div className="legend" style={{ gap: 18, fontSize: 13 }}>
            <span><b style={{ color: "var(--info)" }}>{t.reportReady}</b> reports ready</span>
            <span><b>{t.reportQueued}</b> queued</span>
            <span><b style={{ color: "var(--danger)" }}>{t.reportFailed}</b> failed</span>
            <span><b>{t.kitIntents}</b> kit order intents</span>
            <span><b style={{ color: t.undelivered ? "var(--warn)" : "var(--muted)" }}>{t.waSent}</b> delivered on WhatsApp</span>
          </div>
          <div className="sub" style={{ marginTop: 10, color: "var(--muted)", fontSize: 12 }}>
            {t.undelivered} ready report{t.undelivered === 1 ? "" : "s"} not yet delivered to patients.
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="filters">
        {FILTERS.map((f) => (
          <Link key={f.key} href={f.key === "ALL" ? "/admin" : `/admin?filter=${f.key}`} className={`chip ${active === f.key ? "active" : ""}`} title={f.help}>
            {f.label} <span className="n">{counts[f.key]}</span>
          </Link>
        ))}
      </div>

      {/* Clinic list */}
      <div className="clinic-list">
        {shown.map((c) => (
          <div className="clinic" key={c.slug}>
            <div className="clinic-head">
              <div className="clinic-id">
                <div className="name">{c.name}</div>
                <div className="doc">
                  {c.doctorName ?? "No doctor"} · {labelProvisioning(c.provisioning)}
                  {c.provider ? ` · ${c.provider} auth` : ""}
                  {" "}{stageBadge(c)}
                </div>
              </div>
              <Metric label="Submitted" value={c.submitted} />
              <Metric label="Approved" value={c.approved} />
              <Metric label="Pending" value={c.pending} tone="warn" />
              <Metric label="Reports" value={c.reportReady} />
              <Metric label="Kits" value={c.kitIntents} />
            </div>

            {c.issues.length > 0 && (
              <div className="issues">
                {c.issues.map((i, idx) => (
                  <div key={idx} className={`issue ${i.level}`}>
                    <span className="tag">{i.level === "blocked" ? "Blocked" : "Watch"}</span>
                    <span>{i.label}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="meta-row">
              <span>Last sign-in: <b>{fmtDate(c.lastSignInAt)}</b></span>
              <span>Last review: <b>{fmtDate(c.lastReviewAt)}</b></span>
              <span>WhatsApp delivered: <b>{c.waSent}</b></span>
              <Link className="view" href={`/admin/clinic/${c.slug}`}>Patient workflow →</Link>
            </div>
          </div>
        ))}
        {shown.length === 0 && <div className="panel">No clinics match this filter.</div>}
      </div>

      <div className="footer">
        Definitions · <b>Submitted</b> = assessment submitted by patient. <b>Approved</b> = doctor review decision
        APPROVED (not merely processing COMPLETED). <b>Pending</b> = awaiting a doctor decision. <b>Sign-in</b> resolved
        server-side from the auth provider. A QR scan or completed processing is not counted as doctor usage.
      </div>
    </main>
  );
}
