"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Send } from "lucide-react";
import { PageContainer } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { LoadingState, ErrorState } from "@/components/ui/states";

const STATUS_TONE: Record<string, string> = {
  OPEN: "bg-amber-50 text-amber-800 border-amber-200",
  IN_PROGRESS: "bg-sky-50 text-sky-800 border-sky-200",
  RESOLVED: "bg-emerald-50 text-emerald-800 border-emerald-200",
  CLOSED: "bg-stone-100 text-stone-600 border-stone-200",
};

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

const CATEGORY_LABEL: Record<string, string> = {
  PATIENT_ASSESSMENT: "Patient / Assessment",
  REPORT: "Report",
  KIT_PRESCRIPTION: "Kit / Prescription",
  WHATSAPP: "WhatsApp",
  LOGIN_ACCESS: "Login / Access",
  TECHNICAL_ISSUE: "Technical Issue",
  OTHER: "Other",
};

type Message = {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  body: string;
  createdAt: string;
};

type Ticket = {
  id: string;
  category: string;
  priority: string;
  status: string;
  subject: string;
  assessmentId: string | null;
  consultationId: string | null;
  createdAt: string;
  messages: Message[];
};

function MessageBubble({ msg, isDoctor }: { msg: Message; isDoctor: boolean }) {
  return (
    <div className={`flex ${isDoctor ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[78%] rounded-xl px-4 py-3 text-sm ${
          isDoctor
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        }`}
      >
        <p className="whitespace-pre-wrap">{msg.body}</p>
        <p
          className={`mt-1 text-[11px] ${
            isDoctor ? "text-primary-foreground/70" : "text-muted-foreground"
          }`}
        >
          {isDoctor ? "You" : "FACT Support"} ·{" "}
          {new Date(msg.createdAt).toLocaleString()}
        </p>
      </div>
    </div>
  );
}

export default function DoctorSupportThreadPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    fetch(`/api/doctor/support/${id}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j) => { setTicket(j.ticket); setError(null); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [ticket?.messages.length]);

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim() || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch(`/api/doctor/support/${id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: reply.trim() }),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error ?? "Failed to send reply");
      }
      setReply("");
      load();
    } catch (err) {
      setSendError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <PageContainer>
        <LoadingState />
      </PageContainer>
    );
  }

  if (error || !ticket) {
    return (
      <PageContainer>
        <ErrorState
          title="Couldn't load this request"
          description={error ?? "Not found"}
        />
      </PageContainer>
    );
  }

  const canReply = ticket.status === "OPEN" || ticket.status === "IN_PROGRESS";

  return (
    <PageContainer className="flex flex-col space-y-0 max-h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-start gap-3 border-b border-border bg-background pb-4 pt-2">
        <button
          type="button"
          onClick={() => router.push("/doctor/support")}
          className="mt-0.5 rounded-md p-1 hover:bg-muted"
          aria-label="Back to support"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="truncate text-base font-semibold">{ticket.subject}</h1>
            <span
              className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${STATUS_TONE[ticket.status]}`}
            >
              {STATUS_LABEL[ticket.status]}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {CATEGORY_LABEL[ticket.category] ?? ticket.category} ·{" "}
            {new Date(ticket.createdAt).toLocaleDateString()}
            {ticket.assessmentId && ` · Assessment ${ticket.assessmentId.slice(-6)}`}
          </p>
        </div>
      </div>

      {/* Thread */}
      <div className="flex-1 overflow-y-auto space-y-3 py-4">
        {ticket.messages.map((m) => (
          <MessageBubble
            key={m.id}
            msg={m}
            isDoctor={m.authorRole === "DOCTOR"}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Reply bar */}
      {canReply ? (
        <form
          onSubmit={sendReply}
          className="sticky bottom-0 border-t border-border bg-background pt-3 pb-2"
        >
          {sendError && (
            <p className="mb-2 text-xs text-rose-600">{sendError}</p>
          )}
          <div className="flex gap-2">
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Reply to FACT Support…"
              rows={2}
              maxLength={5000}
              className="flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!reply.trim() || sending}
              className="self-end"
            >
              <Send className="size-4" />
            </Button>
          </div>
        </form>
      ) : (
        <div className="border-t border-border pt-3 pb-2 text-center text-xs text-muted-foreground">
          This request is {STATUS_LABEL[ticket.status].toLowerCase()}.
          {ticket.status === "RESOLVED" &&
            " Contact support if the issue recurs."}
        </div>
      )}
    </PageContainer>
  );
}
