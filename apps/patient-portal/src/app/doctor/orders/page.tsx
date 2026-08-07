"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Package, ChevronRight, Loader2 } from "lucide-react";
import { PageContainer } from "@/components/app-shell";

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

export default function DoctorOrdersPage() {
  const [items, setItems] = useState<Order[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/doctor/orders")
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data) => setItems(data.items ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const ready = useMemo(
    () => items?.filter((i) => i.status === "READY_FOR_FULFILMENT").length ?? 0,
    [items],
  );
  const cancelled = useMemo(
    () => items?.filter((i) => i.status === "CANCELLED").length ?? 0,
    [items],
  );

  return (
    <PageContainer className="space-y-6 max-w-5xl">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-700">
          Doctor · Kit orders
        </p>
        <h1 className="font-serif text-3xl font-medium tracking-tight text-slate-900">
          Kit orders
        </h1>
        <p className="text-sm text-slate-500">
          Every consultation you approve creates an order intent for the ops
          team. Fulfillment status shown below.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <StatChip label="Ready for fulfillment" value={ready} tone="teal" />
        <StatChip label="Cancelled" value={cancelled} tone="slate" />
      </div>

      <section className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-stone-500">
            <Loader2 className="size-4 animate-spin" />
          </div>
        ) : !items || items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-stone-500">
            <Package className="size-8 mb-3 text-stone-300" />
            <p className="text-sm">No kit orders yet.</p>
            <p className="text-xs mt-1">
              Approve a consultation from the inbox to create your first order.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-[11px] uppercase tracking-wider text-stone-500">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Patient</th>
                <th className="px-4 py-2.5 text-left font-medium">Kits</th>
                <th className="px-4 py-2.5 text-left font-medium">Doctor</th>
                <th className="px-4 py-2.5 text-left font-medium">Status</th>
                <th className="px-4 py-2.5 text-left font-medium">Approved</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {items.map((o) => (
                <tr key={o.id} className="hover:bg-stone-50">
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {o.patientName}
                  </td>
                  <td className="px-4 py-3 text-stone-600">
                    {o.kitCount} {o.kitCount === 1 ? "kit" : "kits"}
                  </td>
                  <td className="px-4 py-3 text-stone-600">{o.doctorName}</td>
                  <td className="px-4 py-3">
                    <StatusPill status={o.status} />
                  </td>
                  <td className="px-4 py-3 text-stone-500 text-xs">
                    {fmtDate(o.createdAt)}
                  </td>
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

function StatChip({ label, value, tone }: { label: string; value: number; tone: "teal" | "slate" }) {
  const cls =
    tone === "teal"
      ? "border-teal-200 bg-teal-50/70 text-teal-900"
      : "border-stone-200 bg-stone-50 text-slate-800";
  return (
    <div className={`rounded-xl border ${cls} px-4 py-3 flex items-baseline justify-between`}>
      <span className="text-[10px] uppercase tracking-wider">{label}</span>
      <span className="font-serif text-2xl">{value}</span>
    </div>
  );
}

function StatusPill({ status }: { status: Order["status"] }) {
  if (status === "READY_FOR_FULFILMENT") {
    return (
      <span className="inline-flex items-center rounded-full bg-teal-100 px-2 py-0.5 text-[11px] font-medium text-teal-800 ring-1 ring-teal-200">
        Ready for fulfillment
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
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}
