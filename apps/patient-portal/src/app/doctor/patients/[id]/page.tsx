"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, User, Phone, Mail, Stethoscope, Building2 } from "lucide-react";
import { SeverityBadge } from "@/components/ui/StatusBadges";
import { standingOf } from "@/lib/doctor/clinicalStanding";

interface PatientDetail {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  age: number | null;
  gender: string | null;
  clinic: { id: string; name: string } | null;
  doctor: { id: string; name: string } | null;
  assessments: {
    id: string;
    status: string;
    reviewDecision: string | null;
    submittedAt: string | null;
    primaryDiagnosis: string | null;
    severity: string | null;
  }[];
}

export default function PatientTimelinePage() {
  const params = useParams();
  const id = String(params.id ?? "");
  const [patient, setPatient] = useState<PatientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/doctor/patients/${id}`)
      .then(async (r) => {
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error(j.error ?? "Failed to load patient");
        }
        return r.json();
      })
      .then((d) => setPatient(d.patient))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="text-sm text-slate-400">Loading…</p>;
  if (error || !patient)
    return (
      <div className="space-y-3">
        <Link href="/doctor/patients" className="text-sm text-sky-600 inline-flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Back to patients
        </Link>
        <p className="text-sm text-rose-600">{error ?? "Patient not found"}</p>
      </div>
    );

  return (
    <div className="space-y-6">
      <Link href="/doctor/patients" className="text-sm text-sky-600 inline-flex items-center gap-1">
        <ArrowLeft className="h-4 w-4" /> Back to patients
      </Link>

      <section className="rounded-2xl bg-white border shadow-sm p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
              <User className="h-5 w-5 text-slate-500" /> {patient.name || "(unnamed)"}
            </h2>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600">
              {patient.phone && <span className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> {patient.phone}</span>}
              {patient.email && <span className="inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> {patient.email}</span>}
              {patient.age != null && <span>{patient.age} yrs</span>}
              {patient.gender && <span>{patient.gender}</span>}
            </div>
          </div>
          <div className="text-sm space-y-1">
            {patient.clinic && (
              <p className="inline-flex items-center gap-1.5 text-slate-600">
                <Building2 className="h-3.5 w-3.5" /> {patient.clinic.name}
              </p>
            )}
            {patient.doctor && (
              <p className="inline-flex items-center gap-1.5 text-slate-600">
                <Stethoscope className="h-3.5 w-3.5" /> {patient.doctor.name}
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-white border shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b">
          <h3 className="font-semibold text-slate-800">Assessment timeline</h3>
          <p className="text-xs text-slate-500">{patient.assessments.length} assessment{patient.assessments.length === 1 ? "" : "s"}</p>
        </div>
        <ul className="divide-y">
          {patient.assessments.length === 0 && (
            <li className="px-5 py-8 text-sm text-slate-400 text-center">No assessments yet.</li>
          )}
          {patient.assessments.map((a) => (
            <li key={a.id} className="px-5 py-4 flex items-center justify-between hover:bg-slate-50">
              <div>
                <p className="font-medium text-slate-800">
                  {a.submittedAt ? new Date(a.submittedAt).toLocaleString() : "—"}
                </p>
                <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-600">
                  <StandingChip
                    status={a.status}
                    reviewDecision={a.reviewDecision}
                  />
                  {a.primaryDiagnosis && (
                    <span className="inline-flex items-center rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">
                      {a.primaryDiagnosis}
                    </span>
                  )}
                  <SeverityBadge severity={a.severity} />
                </div>
              </div>
              <Link
                href={`/doctor/reports/${a.id}`}
                className="text-sm text-sky-600 font-medium"
              >
                Open report →
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/**
 * Where this assessment stands, said the same way the registry says it.
 *
 * This replaced `StatusBadge status={a.status}`, which coloured any COMPLETED
 * assessment green — including ones still sitting unread in the review queue.
 * The same patient then read as "done" here and "awaiting review" in the
 * registry. The label and the colour now both come from
 * lib/doctor/clinicalStanding, so the two screens cannot disagree again.
 *
 * The tones are this page's own slate-family classes rather than the doctor
 * token layer: restyling the whole detail screen is not part of this change,
 * and a half-converted page would look worse than a consistent one. What
 * matters is that the MEANING is shared, not the stylesheet.
 */
function StandingChip({
  status,
  reviewDecision,
}: {
  status: string;
  reviewDecision: string | null;
}) {
  const { standing, label, detail } = standingOf({
    assessmentCount: 1,
    lastStatus: status,
    lastReviewDecision: reviewDecision,
  });

  const tone = {
    REVIEWED: "bg-emerald-50 text-emerald-700 border-emerald-200",
    AWAITING_REVIEW: "bg-amber-50 text-amber-800 border-amber-200",
    PROCESSING: "bg-cyan-50 text-cyan-800 border-cyan-200",
    ATTENTION: "bg-rose-50 text-rose-700 border-rose-200",
    NONE: "bg-slate-50 text-slate-600 border-slate-200",
  }[standing];

  return (
    <span
      aria-label={detail}
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${tone}`}
    >
      {label}
    </span>
  );
}
