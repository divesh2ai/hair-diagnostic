"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ListChecks,
  ClipboardCheck,
  CheckCircle2,
  Stethoscope,
  Users,
  Plus,
  Settings,
} from "lucide-react";
import { PageContainer } from "@/components/app-shell";
import { MetricCard } from "@/components/ui/metric-card";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/states";

type Payload = {
  metrics: {
    todayQueue: number;
    pendingReviews: number;
    approvedReports: number;
    doctors: number;
    patients: number;
  };
};

type ProductivityRow = {
  id: string;
  name: string;
  specialization: string | null;
  photoUrl: string | null;
  approvedMonth: number;
  revisionMonth: number;
  orderMonth: number;
  ordersAll: number;
  revisionRate: number;
};

export default function ClinicDashboardPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [productivity, setProductivity] = useState<ProductivityRow[] | null>(null);

  useEffect(() => {
    fetch("/api/clinic/dashboard", { cache: "no-store" })
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null));
    fetch("/api/clinic/productivity", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => setProductivity(d.items ?? []))
      .catch(() => setProductivity([]));
  }, []);

  if (!data)
    return (
      <PageContainer>
        <LoadingState />
      </PageContainer>
    );

  const m = data.metrics;
  return (
    <PageContainer className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Clinic dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Today's activity at a glance.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/clinic/doctors/new">
            <Button>
              <Plus />
              Add doctor
            </Button>
          </Link>
          <Link href="/doctor/reports">
            <Button variant="outline">
              <ListChecks />
              View queue
            </Button>
          </Link>
          <Link href="/clinic/settings">
            <Button variant="outline">
              <Settings />
              Settings
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard
          icon={<ListChecks className="size-4" />}
          label="Today's queue"
          value={m.todayQueue}
        />
        <MetricCard
          icon={<ClipboardCheck className="size-4" />}
          label="Pending reviews"
          value={m.pendingReviews}
        />
        <MetricCard
          icon={<CheckCircle2 className="size-4" />}
          label="Approved reports"
          value={m.approvedReports}
        />
        <MetricCard
          icon={<Stethoscope className="size-4" />}
          label="Doctors"
          value={m.doctors}
        />
        <MetricCard
          icon={<Users className="size-4" />}
          label="Patients"
          value={m.patients}
        />
      </div>

      <section className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
        <header className="flex items-baseline justify-between px-5 py-3 border-b border-stone-100">
          <h2 className="font-serif text-lg text-slate-900">Doctor productivity</h2>
          <p className="text-xs text-muted-foreground">This month · sorted by approved cases</p>
        </header>
        {productivity === null ? (
          <div className="px-5 py-8 text-sm text-muted-foreground">Loading…</div>
        ) : productivity.length === 0 ? (
          <div className="px-5 py-8 text-sm text-muted-foreground">No doctors yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-[11px] uppercase tracking-wider text-stone-500">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Doctor</th>
                <th className="px-4 py-2.5 text-right font-medium">Approved</th>
                <th className="px-4 py-2.5 text-right font-medium">Revisions</th>
                <th className="px-4 py-2.5 text-right font-medium">Revision %</th>
                <th className="px-4 py-2.5 text-right font-medium">Orders (mo)</th>
                <th className="px-4 py-2.5 text-right font-medium">Orders (all)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {productivity.map((d) => (
                <tr key={d.id} className="hover:bg-stone-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="size-8 shrink-0 overflow-hidden rounded-full bg-stone-100 ring-1 ring-stone-200">
                        {d.photoUrl && (
                          <img src={d.photoUrl} alt={d.name} className="h-full w-full object-cover" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-slate-800 truncate">{d.name}</div>
                        {d.specialization && (
                          <div className="text-[11px] text-stone-500 truncate">{d.specialization}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-800">{d.approvedMonth}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">{d.revisionMonth}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <RevisionRatePill rate={d.revisionRate} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">{d.orderMonth}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-stone-500">{d.ordersAll}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </PageContainer>
  );
}

function RevisionRatePill({ rate }: { rate: number }) {
  const tone =
    rate <= 10
      ? "bg-teal-100 text-teal-800 ring-teal-200"
      : rate <= 25
        ? "bg-amber-100 text-amber-800 ring-amber-200"
        : "bg-red-100 text-red-800 ring-red-200";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${tone}`}>
      {rate}%
    </span>
  );
}
