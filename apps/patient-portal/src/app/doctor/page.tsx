"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, FileText, Clock } from "lucide-react";

interface PatientRow {
  id: string;
  name: string;
  phone: string;
  assessmentCount: number;
  lastAssessment?: string;
}

export default function DoctorDashboardPage() {
  const [patients, setPatients] = useState<PatientRow[]>([]);

  useEffect(() => {
    fetch("/api/doctor/patients")
      .then((r) => r.json())
      .then((d) => setPatients(d.patients ?? []))
      .catch(() => setPatients([]));
  }, []);

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <header className="bg-white border-b px-6 py-5">
        <h1 className="text-xl font-semibold text-slate-900">Doctor dashboard</h1>
        <p className="text-sm text-slate-500">Your patients · assessments · reports</p>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="grid sm:grid-cols-3 gap-4 mb-8">
          {[
            { icon: Users, label: "Patients", value: patients.length },
            { icon: FileText, label: "Reports", value: "—" },
            { icon: Clock, label: "Pending", value: "—" },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="rounded-2xl bg-white border p-5 shadow-sm">
              <Icon className="h-5 w-5 text-sky-600 mb-2" />
              <p className="text-2xl font-semibold">{value}</p>
              <p className="text-xs text-slate-500">{label}</p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl bg-white border shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b">
            <h2 className="font-semibold text-slate-800">Patient list</h2>
          </div>
          <ul className="divide-y">
            {patients.length === 0 && (
              <li className="px-5 py-8 text-sm text-slate-400 text-center">
                No patients yet. Connect Supabase auth + DATABASE_URL for live data.
              </li>
            )}
            {patients.map((p) => (
              <li key={p.id} className="px-5 py-4 flex items-center justify-between hover:bg-slate-50">
                <div>
                  <p className="font-medium text-slate-800">{p.name}</p>
                  <p className="text-xs text-slate-500">{p.phone}</p>
                </div>
                <Link
                  href={`/doctor/patients/${p.id}`}
                  className="text-sm text-sky-600 font-medium"
                >
                  View history →
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
}
