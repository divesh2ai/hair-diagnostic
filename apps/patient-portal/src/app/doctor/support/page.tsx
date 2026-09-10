"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { HelpCircle, Plus, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { PageContainer } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { LoadingState, ErrorState } from "@/components/ui/states";

// Support ticket categories the doctor can choose from.
const CATEGORIES = [
  { value: "PATIENT_ASSESSMENT", label: "Patient / Assessment" },
  { value: "REPORT", label: "Report" },
  { value: "KIT_PRESCRIPTION", label: "Kit / Prescription" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "LOGIN_ACCESS", label: "Login / Access" },
  { value: "TECHNICAL_ISSUE", label: "Technical Issue" },
  { value: "OTHER", label: "Other" },
] as const;

type Category = (typeof CATEGORIES)[number]["value"];

type Ticket = {
  id: string;
  category: Category;
  priority: "NORMAL" | "HIGH" | "URGENT";
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  subject: string;
  createdAt: string;
  updatedAt: string;
  lastMessage: { body: string; authorRole: string; createdAt: string } | null;
  messageCount: number;
  unreadCount: number;
};

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

const STATUS_TONE: Record<string, string> = {
  OPEN: "bg-amber-50 text-amber-800 border-amber-200",
  IN_PROGRESS: "bg-sky-50 text-sky-800 border-sky-200",
  RESOLVED: "bg-emerald-50 text-emerald-800 border-emerald-200",
  CLOSED: "bg-stone-100 text-stone-600 border-stone-200",
};

const PRIORITY_TONE: Record<string, string> = {
  NORMAL: "",
  HIGH: "text-amber-700",
  URGENT: "text-rose-700 font-medium",
};

function relative(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  if (d < 30) return `${d} days ago`;
  return new Date(iso).toLocaleDateString();
}

function NewTicketForm({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [category, setCategory] = useState<Category>("TECHNICAL_ISSUE");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState("NORMAL");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/doctor/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, subject, message, priority }),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error ?? "Failed to create ticket");
      }
      const { ticket } = await res.json();
      onCreated(ticket.id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-background p-6 shadow-sm">
      <h2 className="mb-4 text-base font-semibold">New support request</h2>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
            className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Priority</label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
          >
            <option value="NORMAL">Normal</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Subject</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Brief description of the issue"
            maxLength={200}
            required
            className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Describe the issue in detail. Do not include passwords or tokens."
            rows={5}
            maxLength={5000}
            required
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
          />
        </div>
        {error && (
          <p className="text-sm text-rose-600">{error}</p>
        )}
        <div className="flex gap-3">
          <Button type="submit" disabled={submitting || !subject.trim() || !message.trim()}>
            {submitting ? "Sending…" : "Send request"}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function DoctorSupportPage() {
  const router = useRouter();
  const [data, setData] = useState<{ tickets: Ticket[]; totalUnread: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/doctor/support", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j) => { setData(j); setError(null); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading && !data) {
    return (
      <PageContainer>
        <LoadingState />
      </PageContainer>
    );
  }

  if (error && !data) {
    return (
      <PageContainer>
        <ErrorState title="Couldn't load support requests" description={error} />
      </PageContainer>
    );
  }

  const tickets = data?.tickets ?? [];
  const open = tickets.filter((t) => t.status === "OPEN" || t.status === "IN_PROGRESS");
  const closed = tickets.filter((t) => t.status === "RESOLVED" || t.status === "CLOSED");

  return (
    <PageContainer className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <HelpCircle className="size-6" />
            Help &amp; Support
          </h1>
          <p className="text-sm text-muted-foreground">
            Your support requests with the FACT operations team.
          </p>
        </div>
        {!showNew && (
          <Button onClick={() => setShowNew(true)}>
            <Plus className="mr-1 size-4" />
            New request
          </Button>
        )}
      </div>

      {showNew && (
        <NewTicketForm
          onClose={() => setShowNew(false)}
          onCreated={(id) => {
            setShowNew(false);
            router.push(`/doctor/support/${id}`);
          }}
        />
      )}

      {tickets.length === 0 && !showNew && (
        <div className="rounded-xl border border-border bg-muted/30 py-12 text-center text-sm text-muted-foreground">
          No support requests yet. Use &ldquo;New request&rdquo; to get help.
        </div>
      )}

      {open.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Open / In Progress
          </h2>
          <div className="space-y-2">
            {open.map((t) => (
              <TicketRow key={t.id} ticket={t} />
            ))}
          </div>
        </section>
      )}

      {closed.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Resolved / Closed
          </h2>
          <div className="space-y-2">
            {closed.map((t) => (
              <TicketRow key={t.id} ticket={t} />
            ))}
          </div>
        </section>
      )}
    </PageContainer>
  );
}

function TicketRow({ ticket: t }: { ticket: Ticket }) {
  const router = useRouter();
  const categoryLabel =
    CATEGORIES.find((c) => c.value === t.category)?.label ?? t.category;

  return (
    <button
      type="button"
      onClick={() => router.push(`/doctor/support/${t.id}`)}
      className="w-full rounded-xl border border-border bg-background p-4 text-left transition-colors hover:bg-muted/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium truncate">{t.subject}</span>
            {t.unreadCount > 0 && (
              <span className="shrink-0 rounded-full bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 font-medium">
                {t.unreadCount} new
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
            <span>{categoryLabel}</span>
            <span>·</span>
            <span>{relative(t.createdAt)}</span>
            {t.priority !== "NORMAL" && (
              <>
                <span>·</span>
                <span className={PRIORITY_TONE[t.priority]}>
                  {t.priority === "URGENT" ? "Urgent" : "High priority"}
                </span>
              </>
            )}
          </div>
          {t.lastMessage && (
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {t.lastMessage.authorRole === "DOCTOR" ? "You" : "Support"}: {t.lastMessage.body}
            </p>
          )}
        </div>
        <span
          className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${STATUS_TONE[t.status]}`}
        >
          {STATUS_LABEL[t.status]}
        </span>
      </div>
    </button>
  );
}
