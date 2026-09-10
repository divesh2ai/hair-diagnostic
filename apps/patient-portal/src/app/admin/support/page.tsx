"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { HelpCircle } from "lucide-react";
import { PageContainer } from "@/components/app-shell";
import { MetricCard } from "@/components/ui/metric-card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { SearchBox } from "@/components/ui/search-box";
import { FilterBar } from "@/components/ui/filter-bar";
import { ErrorState, LoadingState } from "@/components/ui/states";

const CATEGORY_LABEL: Record<string, string> = {
  PATIENT_ASSESSMENT: "Patient / Assessment",
  REPORT: "Report",
  KIT_PRESCRIPTION: "Kit / Prescription",
  WHATSAPP: "WhatsApp",
  LOGIN_ACCESS: "Login / Access",
  TECHNICAL_ISSUE: "Technical Issue",
  OTHER: "Other",
};

const STATUS_TONE: Record<string, string> = {
  OPEN: "bg-amber-50 text-amber-800 border-amber-200",
  IN_PROGRESS: "bg-sky-50 text-sky-800 border-sky-200",
  RESOLVED: "bg-emerald-50 text-emerald-800 border-emerald-200",
  CLOSED: "bg-stone-100 text-stone-600 border-stone-200",
};

const PRIORITY_TONE: Record<string, string> = {
  NORMAL: "text-muted-foreground",
  HIGH: "text-amber-700",
  URGENT: "text-rose-700 font-medium",
};

type Ticket = {
  id: string;
  category: string;
  priority: string;
  status: string;
  subject: string;
  doctor: { id: string; name: string; email: string | null };
  clinic: { id: string; name: string };
  assessmentId: string | null;
  createdAt: string;
  lastMessage: { body: string; authorRole: string; createdAt: string } | null;
  messageCount: number;
  unreadCount: number;
  ageHours: number;
};

type Summary = {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  closed: number;
  totalUnread: number;
};

function relative(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function AdminSupportPage() {
  const router = useRouter();
  const [data, setData] = useState<{ tickets: Ticket[]; summary: Summary } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [q, setQ] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (q) params.set("q", q);
    fetch(`/api/admin/support?${params}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j) => { setData(j); setError(null); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [statusFilter, q]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const columns = useMemo<Column<Ticket>[]>(
    () => [
      {
        key: "subject",
        header: "Request",
        cell: (t) => (
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="truncate font-medium">{t.subject}</span>
              {t.unreadCount > 0 && (
                <span className="shrink-0 rounded-full bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5">
                  {t.unreadCount} new
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {CATEGORY_LABEL[t.category] ?? t.category}
            </div>
          </div>
        ),
      },
      {
        key: "doctor",
        header: "Doctor",
        cell: (t) => (
          <div className="min-w-0">
            <div className="truncate text-sm">{t.doctor.name}</div>
            <div className="truncate text-xs text-muted-foreground">{t.clinic.name}</div>
          </div>
        ),
      },
      {
        key: "priority",
        header: "Priority",
        width: "90px",
        cell: (t) => (
          <span className={`text-sm ${PRIORITY_TONE[t.priority]}`}>
            {t.priority === "NORMAL" ? "Normal" : t.priority === "HIGH" ? "High" : "Urgent"}
          </span>
        ),
      },
      {
        key: "status",
        header: "Status",
        width: "120px",
        cell: (t) => (
          <span
            className={`rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${STATUS_TONE[t.status]}`}
          >
            {t.status === "IN_PROGRESS" ? "In Progress" : t.status.charAt(0) + t.status.slice(1).toLowerCase()}
          </span>
        ),
      },
      {
        key: "age",
        header: "Opened",
        width: "110px",
        cell: (t) => (
          <span className="text-xs text-muted-foreground">
            {relative(t.createdAt)}
          </span>
        ),
      },
      {
        key: "messages",
        header: "Replies",
        width: "80px",
        cell: (t) => (
          <span className="text-sm tabular-nums">{t.messageCount}</span>
        ),
      },
    ],
    [],
  );

  if (error && !data) {
    return (
      <PageContainer>
        <ErrorState title="Couldn't load support inbox" description={error} />
      </PageContainer>
    );
  }

  const s = data?.summary;

  return (
    <PageContainer className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <HelpCircle className="size-6" />
          FACT Support Inbox
        </h1>
        <p className="text-sm text-muted-foreground">
          Support requests from doctors across all clinics.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard label="Total" value={s?.total ?? "—"} />
        <MetricCard label="Open" value={s?.open ?? "—"} />
        <MetricCard label="In Progress" value={s?.inProgress ?? "—"} />
        <MetricCard label="Resolved" value={s?.resolved ?? "—"} />
        <MetricCard label="Unread" value={s?.totalUnread ?? "—"} hint="Doctor messages not yet seen" />
      </div>

      <FilterBar
        onClear={() => { setStatusFilter(""); setQ(""); }}
      >
        <SearchBox
          value={q}
          onChange={setQ}
          placeholder="Search subject, doctor, clinic"
          className="min-w-[260px]"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 rounded-lg border border-border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
        >
          <option value="">All statuses</option>
          <option value="OPEN">Open</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="RESOLVED">Resolved</option>
          <option value="CLOSED">Closed</option>
        </select>
      </FilterBar>

      <DataTable
        columns={columns}
        rows={data?.tickets ?? []}
        rowKey={(t) => t.id}
        loading={loading}
        onRowClick={(t) => router.push(`/admin/support/${t.id}`)}
        emptyTitle="No support requests"
        emptyDescription="When doctors raise support requests they appear here."
      />
    </PageContainer>
  );
}
