import Link from "next/link";
import { ClipboardList, Stethoscope, CircleCheck, FileText, Send } from "lucide-react";
import { AUTH_PROVIDER_LABEL } from "@/lib/admin/clinicMonitor/authProvider";
import { USAGE_LABEL, type ClinicOpsRow } from "@/lib/admin/clinicMonitor/model";
import type { ClinicDetail } from "@/lib/admin/clinicMonitor/detailModel";
import type { ClinicSection } from "./ClinicOpsDrawer";

const date = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });
const timestamp = (value: string) => Date.parse(/(?:Z|[+-]\d\d:\d\d)$/.test(value) ? value : `${value}Z`);
const recorded = (value: string | null) => value ? date.format(timestamp(value)) : "Not recorded";
const label = (value: string) => /^[A-Z_]+$/.test(value) ? value.toLowerCase().replaceAll("_", " ").replace(/^./, (s) => s.toUpperCase()) : value;
type Stat = [string, string | number];

function Stats({ items }: { items: Stat[] }) {
  return <dl className="divide-y rounded-lg border px-3 text-sm">{items.map(([key, value]) => (
    <div key={key} className="grid grid-cols-[1fr_auto] items-start gap-3 py-2">
      <dt className="text-muted-foreground">{key}</dt><dd className="max-w-[13rem] text-right font-medium tabular-nums">{value}</dd>
    </div>
  ))}</dl>;
}

function Workflow({ metrics }: { metrics: ClinicDetail["metrics"] }) {
  const stages = [
    ["Assessment", metrics.assessed, ClipboardList], ["Consultation", metrics.consultations, Stethoscope],
    ["Doctor review", metrics.reviewed, CircleCheck], ["PDF ready", metrics.ready, FileText],
    ["Report delivered", metrics.delivered, Send],
  ] as const;
  return <section aria-labelledby="workflow-heading" className="rounded-lg border p-3 sm:p-4">
    <h2 id="workflow-heading" className="font-semibold">Patient workflow</h2>
    <ol className="mt-3 grid grid-cols-5 gap-1.5 sm:gap-3">{stages.map(([title, count, Icon]) => (
      <li key={title} className="min-w-0 text-center">
        <span className="flex min-h-12 items-center justify-center gap-1 rounded-md bg-muted text-base font-semibold tabular-nums">
          <Icon aria-hidden="true" className="hidden size-4 text-muted-foreground sm:block" />{count}
        </span>
        <span className="mt-1 block break-words text-[0.6875rem] leading-tight sm:text-xs">{title}</span>
      </li>
    ))}</ol>
    <p className="mt-3 text-xs text-muted-foreground">Counts are per submitted assessment in this clinic. Each stage uses its own recorded evidence; delivery can be confirmed without a linked PDF. Distinct patients are counted separately.</p>
  </section>;
}

function Overview({ d, usage, clinicId }: { d: ClinicDetail; usage: ClinicOpsRow["usage"]; clinicId: string }) {
  const m = d.metrics;
  const missingLinks = d.doctors.filter((doctor) => !doctor.linked && doctor.authProvider !== "UNKNOWN").length;
  const logins = d.doctors.flatMap((doctor) => doctor.lastSignIn ? [doctor.lastSignIn] : []).sort();
  const actions = d.doctors.flatMap((doctor) => doctor.lastAction ? [doctor.lastAction] : []).sort();
  const issues: [string, string, string, string?][] = [];
  if (missingLinks) issues.push(["High", `${missingLinks} active doctor accounts not linked`, "Verify the doctor’s identity and onboarding readiness.", "/admin/people"]);
  if (m.missing) issues.push(["High", `${m.missing} completed assessments have no consultation`, "Investigate consultation processing before assigning doctor follow-up.", "/admin/operations"]);
  if (d.reports.failed) issues.push(["High", `${d.reports.failed} failed report assets`, "Check the report processing queue.", "/admin/operations"]);
  if (d.delivery.failed) issues.push(["High", `${d.delivery.failed} failed report messages`, "Review the delivery records before contacting the clinic.", "/admin/operations"]);
  if (m.pending) issues.push(["Follow up", `${m.pending} consultations awaiting review`, "Ask the clinic to check its review queue.", "/admin/clinics"]);
  if (d.reports.queued) issues.push(["Monitor", `${d.reports.queued} report assets queued or processing`, "Check progress in the existing operations workspace.", "/admin/operations"]);
  if (!m.last7) issues.push(["Monitor", "No assessments submitted in the last 7 days", "Ask about recent patient intake; this is not a measure of doctor activity."]);
  return <div className="space-y-5">
    <Workflow metrics={m} />
    <section className="space-y-2"><h2 className="font-semibold">Clinic health</h2>
      <Stats items={[
        ["Usage classification", USAGE_LABEL[usage]], ["Last recorded assessment", recorded(m.lastAssessment)],
        ["Days since last assessment", m.lastAssessment ? Math.max(0, Math.floor((Date.now() - timestamp(m.lastAssessment)) / 86400000)) : "Not recorded"],
        ["Last doctor login", logins.length ? recorded(logins.at(-1)!) : d.doctors.some((doctor) => doctor.authProvider === "UNKNOWN") ? "Unknown" : "Not recorded"],
        ["Last recorded clinical action", recorded([actions.at(-1), m.lastReview].filter((v): v is string => !!v).sort().at(-1) ?? null)],
      ]} />
    </section>
    <section className="space-y-2"><h2 className="font-semibold">Needs attention</h2>
      {issues.length ? <ul className="divide-y rounded-lg border px-3">{issues.map(([severity, evidence, next, href]) =>
        <li key={evidence} className="space-y-1 py-2.5 text-sm">
          <p><span className="mr-2 text-xs font-semibold text-muted-foreground">{severity}</span><strong className="font-medium">{evidence}</strong></p>
          <p className="text-muted-foreground">{next} {href && <Link className="underline" href={href}>Open workspace</Link>}</p>
        </li>)}</ul> : <p className="text-sm text-muted-foreground">No issues found in the connected records.</p>}
    </section>
    <section className="space-y-2"><h2 className="font-semibold">Doctor adoption</h2>
      {!d.doctors.length && <p className="text-sm text-muted-foreground">No active doctors recorded.</p>}
      {d.doctors.map((doctor, i) => <div key={i} className="space-y-2">
        <h3 className="text-sm font-medium">{doctor.name}{doctor.isPrimary ? " · Primary" : ""}</h3>
        <Stats items={[
          ["Login method", AUTH_PROVIDER_LABEL[doctor.authProvider]],
          ["Identity", doctor.authProvider === "UNKNOWN" ? "Unknown" : doctor.linked ? "Linked" : "Not linked"],
          ["Onboarding status", label(doctor.onboarding)],
          ["Last successful sign-in", doctor.authProvider === "UNKNOWN" ? "Unknown" : recorded(doctor.lastSignIn)],
          ["Last recorded clinical action", recorded(doctor.lastAction)], ["Reviews attributed", doctor.reviews],
        ]} />
      </div>)}
      <p className="text-sm text-muted-foreground">{m.pending} pending reviews in the clinic queue. Pending reviews aren’t attributed to individual doctors here.</p>
    </section>
    <section className="space-y-2"><h2 className="font-semibold">Branches</h2>
      {d.branches.length ? <Stats items={d.branches.map((b) => [
        [b.name, b.city, b.primary ? "Primary" : null].filter(Boolean).join(" · "), `${b.assessments} assessments · ${label(b.status)}`,
      ])} /> : <p className="text-sm text-muted-foreground">No branch locations recorded.</p>}
      {d.unattributed > 0 && <p className="text-sm text-muted-foreground">{d.unattributed} assessments have no verified branch attribution.</p>}
      <Link className="text-sm underline" href={`/admin/clinics/${encodeURIComponent(clinicId)}/edit`}>Open clinic settings</Link>
    </section>
  </div>;
}

export function ClinicDetailSections({ section, detail: d, usage, clinicId }: {
  section: ClinicSection; detail: ClinicDetail; usage: ClinicOpsRow["usage"]; clinicId: string;
}) {
  const m = d.metrics;
  if (section === "Overview") return <Overview d={d} usage={usage} clinicId={clinicId} />;
  if (section === "Patients") return <div className="space-y-4">
    <Workflow metrics={m} />
    <Stats items={[
      ["Distinct patients assessed", m.patients], ["Submitted in last 7 days", m.last7], ["Submitted in last 30 days", m.last30],
      ["Completed assessments", m.completed], ["Completed without consultation", m.missing],
      ["Awaiting doctor review", m.pending], ["Approved consultations", m.approved],
    ]} />
    <section className="space-y-2"><h2 className="font-semibold">Recent cases</h2>
      {d.recent.length ? <table aria-label="Recent cases without patient identifiers" className="w-full table-fixed break-words text-left text-xs sm:text-sm">
        <thead className="bg-muted"><tr>{["Assessment", "Processing", "Review", "PDF"].map((col) => <th key={col} scope="col" className="p-1.5 font-medium sm:p-2">{col}</th>)}</tr></thead>
        <tbody className="divide-y">{d.recent.map((item, i) => <tr key={i}>
          <td className="p-1.5 sm:p-2">{recorded(item.at)}<span className="block text-xs text-muted-foreground">{item.branch ?? "Branch unrecorded"}</span></td>
          <td className="p-1.5 sm:p-2">{label(item.processing)}</td><td className="p-1.5 sm:p-2">{label(item.review)}</td><td className="p-1.5 sm:p-2">{item.report}</td>
        </tr>)}</tbody>
      </table> : <p className="text-sm text-muted-foreground">No submitted assessments recorded.</p>}
    </section>
  </div>;
  if (section === "Reports & Kits") return <div className="space-y-4">
    <section className="space-y-2"><h2 className="font-semibold">Reports</h2><Stats items={[
      ["Approved consultations", m.approved], ["Assessments with PDF marked ready", m.ready],
      ["Report assets queued or processing", d.reports.queued], ["Failed report assets", d.reports.failed],
      ["PDF retrieval verification", "Not connected"],
    ]} /><p className="text-xs text-muted-foreground">Readiness uses the stored PDF asset status for the current approved version. Queue totals also include one-page images. File bytes are not fetched here.</p></section>
    <section className="space-y-2"><h2 className="font-semibold">Kits</h2><Stats items={[
      ["Recorded order intents", d.kits.intents], ["Cancelled intents", d.kits.cancelled],
      ["Confirmed paid orders", "Not connected"], ["Verified revenue", "Not connected"],
    ]} /></section>
    <section className="space-y-2"><h2 className="font-semibold">WhatsApp report delivery</h2><Stats items={[
      ["Messages sent", d.delivery.sent], ["Provider-confirmed deliveries", d.delivery.confirmed],
      ["Failed messages", d.delivery.failed], ["Latest recorded status", d.delivery.latest ? label(d.delivery.latest) : "Not recorded"],
    ]} /><p className="text-xs text-muted-foreground">Message totals can include multiple sends for one assessment. Manual sharing without a provider receipt is not counted as delivery.</p></section>
  </div>;
  const activity = [...d.activity, ...d.doctors.flatMap((doctor) => doctor.lastSignIn ? [
    { label: `Latest sign-in · ${doctor.name}`, at: doctor.lastSignIn, branch: null },
  ] : [])].sort((a, b) => timestamp(b.at) - timestamp(a.at)).slice(0, 12);
  return <section className="space-y-2"><h2 className="font-semibold">Recent activity</h2>
    <p className="text-xs text-muted-foreground">Recorded events · India Standard Time</p>
    {activity.length ? <ol className="divide-y rounded-lg border px-3">{activity.map((event, i) => <li key={i} className="py-2.5 text-sm">
      <p className="font-medium">{event.label}</p><p className="text-muted-foreground">{recorded(event.at)}{event.branch ? ` · ${event.branch}` : ""}</p>
    </li>)}</ol> : <p className="text-sm text-muted-foreground">No activity recorded.</p>}
  </section>;
}
