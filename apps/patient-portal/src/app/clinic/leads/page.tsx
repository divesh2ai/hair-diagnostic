"use client";

import { useEffect, useState } from "react";
import { Loader2, UserPlus, MessageCircle } from "lucide-react";
import { PageContainer } from "@/components/app-shell";

type Lead = {
  id: string;
  createdAt: string;
  clinicSlug: string | null;
  name: string;
  phone: string;
  language: string | null;
  source: string;
  notes: string | null;
};

export default function ClinicLeadsPage() {
  const [items, setItems] = useState<Lead[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/clinic/leads", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => setItems(d.items ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <PageContainer className="space-y-6 max-w-5xl">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-700">
          Clinic · Leads
        </p>
        <h1 className="font-serif text-3xl font-medium tracking-tight text-slate-900">
          Inbound leads
        </h1>
        <p className="text-sm text-slate-500">
          Submissions from your ad landing page{" "}
          <code className="rounded bg-stone-100 px-1 py-0.5 text-[11px]">/lead/{"{clinicSlug}"}</code>.
          Reach out on WhatsApp and send the assessment link.
        </p>
      </div>

      <section className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-stone-500">
            <Loader2 className="size-4 animate-spin" />
          </div>
        ) : !items || items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-stone-500">
            <UserPlus className="size-8 mb-3 text-stone-300" />
            <p className="text-sm">No leads yet.</p>
            <p className="text-xs mt-1">
              Share your ad landing page to start collecting.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-[11px] uppercase tracking-wider text-stone-500">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Name</th>
                <th className="px-4 py-2.5 text-left font-medium">Phone</th>
                <th className="px-4 py-2.5 text-left font-medium">Language</th>
                <th className="px-4 py-2.5 text-left font-medium">Source</th>
                <th className="px-4 py-2.5 text-left font-medium">Received</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {items.map((l) => {
                const digits = l.phone.replace(/[^0-9]/g, "");
                const waMsg = encodeURIComponent(
                  `Hi ${l.name.split(" ")[0]}, thanks for reaching out. Please tap here to start your Dr FACT assessment: ${typeof window !== "undefined" ? window.location.origin : ""}/q/${l.clinicSlug ?? ""}`,
                );
                return (
                  <tr key={l.id} className="hover:bg-stone-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{l.name}</td>
                    <td className="px-4 py-3 text-stone-600 tabular-nums">{l.phone}</td>
                    <td className="px-4 py-3 text-stone-600 uppercase text-xs">{l.language ?? "—"}</td>
                    <td className="px-4 py-3 text-stone-500 text-xs">{l.source}</td>
                    <td className="px-4 py-3 text-stone-500 text-xs">{fmtDate(l.createdAt)}</td>
                    <td className="px-4 py-3">
                      <a
                        href={`https://wa.me/${digits}?text=${waMsg}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-800 ring-1 ring-emerald-200 hover:bg-emerald-100"
                      >
                        <MessageCircle className="size-3" />
                        WhatsApp
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </PageContainer>
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
