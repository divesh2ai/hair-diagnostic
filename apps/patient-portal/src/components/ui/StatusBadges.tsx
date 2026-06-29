// Shared status chips. Replaces three near-duplicate inline severityClass /
// decisionChip / statusClass helpers that lived in
//   - app/doctor/reports/page.tsx
//   - app/doctor/patients/[id]/page.tsx
//   - app/review/[token]/ReviewClient.tsx (decision style only)
//
// One vocabulary for severity/decision/status keeps the workspace visually
// consistent and centralizes future palette tweaks.

import * as React from "react";

type Severity = "MILD" | "LOW" | "MODERATE" | "HIGH" | "SEVERE" | string | null;
type Decision = "PENDING" | "APPROVED" | "EDITS_REQUESTED" | "REJECTED" | string | null;

function classNames(...x: (string | false | null | undefined)[]) {
  return x.filter(Boolean).join(" ");
}

const BASE =
  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap";

function severityTone(s: Severity) {
  switch (s) {
    case "HIGH":
    case "SEVERE":
      return "bg-rose-50 text-rose-700 border-rose-200";
    case "MODERATE":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "LOW":
    case "MILD":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    default:
      return "bg-slate-50 text-slate-600 border-slate-200";
  }
}

export function SeverityBadge({
  severity,
  className,
}: {
  severity: Severity;
  className?: string;
}) {
  if (!severity) return <span className="text-slate-400 text-xs">—</span>;
  return (
    <span className={classNames(BASE, severityTone(severity), className)}>
      {severity}
    </span>
  );
}

function decisionMeta(d: Decision) {
  switch (d) {
    case "APPROVED":
      return { label: "Approved", tone: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    case "EDITS_REQUESTED":
      return { label: "Edits requested", tone: "bg-amber-50 text-amber-700 border-amber-200" };
    case "REJECTED":
      return { label: "Rejected", tone: "bg-rose-50 text-rose-700 border-rose-200" };
    case "PENDING":
      return { label: "Pending", tone: "bg-stone-50 text-stone-600 border-stone-200" };
    default:
      return null;
  }
}

export function DecisionBadge({
  decision,
  className,
}: {
  decision: Decision;
  className?: string;
}) {
  const meta = decisionMeta(decision);
  if (!meta) return <span className="text-slate-400 text-xs">—</span>;
  return <span className={classNames(BASE, meta.tone, className)}>{meta.label}</span>;
}

function statusTone(s: string) {
  if (s === "COMPLETED" || s === "PUBLISHED_TO_PATIENT")
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (s === "FAILED" || s === "PARTIAL_FAILURE" || s === "REJECTED")
    return "bg-rose-50 text-rose-700 border-rose-200";
  if (s === "PENDING" || s === "QUEUED")
    return "bg-slate-50 text-slate-600 border-slate-200";
  return "bg-sky-50 text-sky-700 border-sky-200";
}

export function StatusBadge({
  status,
  className,
}: {
  status: string | null | undefined;
  className?: string;
}) {
  if (!status) return <span className="text-slate-400 text-xs">—</span>;
  return (
    <span className={classNames(BASE, statusTone(status), className)}>
      {status.replaceAll("_", " ").toLowerCase()}
    </span>
  );
}
