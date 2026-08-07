"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Package, ChevronRight, Loader2, IndianRupee, Users, TrendingUp } from "lucide-react";
import { PageContainer } from "@/components/app-shell";
import { totalRevenueInr, formatInr } from "@/lib/pricing/kitPrices";

type Order = {
  id: string;
  status: "READY_FOR_FULFILMENT" | "CANCELLED";
  kitCount: number;
  kitIds: string[];
  patientName: string;
  assessmentId: string | null;
  doctorName: string;
  clinicName: string;
  createdAt: string;
};

export default function ClinicOrdersPage() {
  const [items, setItems] = useState<Order[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/doctor/orders")
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data) => setItems(data.items ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const metrics = useMemo(() => {
    const list = items ?? [];
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const active = list.filter((i) => i.status === "READY_FOR_FULFILMENT");
    const thisMonth = active.filter((i) => new Date(i.createdAt).getTime() >= monthStart);
    const revenueMonth = thisMonth.reduce((s, i) => s + totalRevenueInr(i.kitIds), 0);
    const revenueAll = active.reduce((s, i) => s + totalRevenueInr(i.kitIds), 0);
    const uniquePatients = new Set(thisMonth.map((i) => i.patientName)).size;
    const avgPerPatient = uniquePatients > 0 ? Math.round(revenueMonth / uniquePatients) : 0;
    const fulfillRate = list.length > 0 ? Math.round((active.length / list.length) * 100) : 0;
    return {
      ordersMonth: thisMonth.length,
      revenueMonth,
      revenueAll,
      avgPerPatient,
      fulfillRate,
      uniquePatients,
    };
  }, [items]);

  return (
    <PageContainer className="space-y-6 max-w-5xl">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-700">
          Clinic · Kit orders
        </p>
        <h1 className="font-serif text-3xl font-medium tracking-tight text-slate-900">
          Orders & revenue
        </h1>
        <p className="text-sm text-slate-500">
          Every doctor-approved consultation creates an order intent. Revenue
          shown is estimated from the ops price sheet — actuals reconcile via
          Instamojo when the fulfilment integration lands.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Kits this month"
          value={String(metrics.ordersMonth)}
          hint={`${metrics.uniquePatients} unique patients`}
          icon={Package}
          tone="teal"
        />
        <MetricCard
          label="Revenue this month"
          value={formatInr(metrics.revenueMonth)}
          hint="Estimated · pre-fulfilment"
          icon={IndianRupee}
          tone="amber"
        />
        <MetricCard
          label="Avg per patient"
          value={formatInr(metrics.avgPerPatient)}
          hint="This month"
          icon={Users}
          tone="slate"
        />
        <MetricCard
          label="Fulfilment rate"
          value={`${metrics.fulfillRate}%`}
          hint="Active vs cancelled"
          icon={TrendingUp}
          tone="slate"
        />
      </div>

      <section className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
        <header className="border-b border-stone-100 px-4 py-3">
          <h2 className="font-serif text-lg text-slate-900">All orders</h2>
        </header>
        {loading ? (
          <div className="flex items-center justify-center py-12 text-stone-500">
            <Loader2 className="size-4 animate-spin" />
          </div>
        ) : !items || items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-stone-500">
            <Package className="size-8 mb-3 text-stone-300" />
            <p className="text-sm">No kit orders yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-[11px] uppercase tracking-wider text-stone-500">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Patient</th>
                <th className="px-4 py-2.5 text-left font-medium">Kits</th>
                <th className="px-4 py-2.5 text-left font-medium">Revenue</th>
                <th className="px-4 py-2.5 text-left font-medium">Doctor</th>
                <th className="px-4 py-2.5 text-left font-medium">Status</th>
                <th className="px-4 py-2.5 text-left font-medium">Approved</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {items.map((o) => (
                <tr key={o.id} className="hover:bg-stone-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{o.patientName}</td>
                  <td className="px-4 py-3 text-stone-600">
                    {o.kitCount} {o.kitCount === 1 ? "kit" : "kits"}
                  </td>
                  <td className="px-4 py-3 text-slate-800 tabular-nums">
                    {formatInr(totalRevenueInr(o.kitIds))}
                  </td>
                  <td className="px-4 py-3 text-stone-600">{o.doctorName}</td>
                  <td className="px-4 py-3">
                    <StatusPill status={o.status} />
                  </td>
                  <td className="px-4 py-3 text-stone-500 text-xs">{fmtDate(o.createdAt)}</td>
                  <td className="px-4 py-3">
                    {o.assessmentId && (
                      <Link
                        href={`/doctor/reports/${o.assessmentId}`}
                        className="inline-flex items-center gap-1 text-xs text-teal-700 hover:text-teal-900"
                      >
                        View
                        <ChevronRight className="size-3" />
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </PageContainer>
  );
}

function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "teal" | "amber" | "slate";
}) {
  const toneCls =
    tone === "teal"
      ? "border-teal-200 bg-teal-50/70 text-teal-900"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50/70 text-amber-900"
        : "border-stone-200 bg-white text-slate-800";
  return (
    <div className={`rounded-2xl border ${toneCls} p-4 space-y-2`}>
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider opacity-80">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className="font-serif text-2xl leading-tight tabular-nums">{value}</div>
      <div className="text-[11px] opacity-70">{hint}</div>
    </div>
  );
}

function StatusPill({ status }: { status: Order["status"] }) {
  if (status === "READY_FOR_FULFILMENT") {
    return (
      <span className="inline-flex items-center rounded-full bg-teal-100 px-2 py-0.5 text-[11px] font-medium text-teal-800 ring-1 ring-teal-200">
        Ready for fulfilment
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-700 ring-1 ring-stone-200">
      Cancelled
    </span>
  );
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}
