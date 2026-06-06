"use client";

import { useEffect, useState } from "react";
import { Building2, Stethoscope, Activity, AlertTriangle } from "lucide-react";

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState({
    clinics: 0,
    doctors: 0,
    assessments: 0,
    failures: 0,
    avgOrchestrationMs: 0,
  });

  useEffect(() => {
    fetch("/api/admin/metrics")
      .then((r) => r.json())
      .then(setMetrics)
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0f14] text-white">
      <header className="border-b border-white/10 px-6 py-5">
        <h1 className="text-xl font-semibold">Admin · HairOS</h1>
        <p className="text-sm text-white/45">Clinics · orchestration · system health</p>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {[
            { icon: Building2, label: "Clinics", value: metrics.clinics },
            { icon: Stethoscope, label: "Doctors", value: metrics.doctors },
            { icon: Activity, label: "Assessments", value: metrics.assessments },
            { icon: AlertTriangle, label: "Failures (24h)", value: metrics.failures },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <Icon className="h-5 w-5 text-sky-400 mb-3" />
              <p className="text-3xl font-semibold">{value}</p>
              <p className="text-xs text-white/40 mt-1">{label}</p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <h2 className="font-semibold mb-2">Orchestration timing</h2>
          <p className="text-3xl font-mono text-sky-300">
            {metrics.avgOrchestrationMs > 0 ? `${metrics.avgOrchestrationMs}ms` : "—"}
          </p>
          <p className="text-xs text-white/35 mt-2">Average pipeline duration (from OrchestrationLog)</p>
        </div>
      </main>
    </div>
  );
}
