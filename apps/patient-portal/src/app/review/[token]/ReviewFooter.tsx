"use client";

import { useState } from "react";
import { Check, MessageCircle, X } from "lucide-react";
import { toast } from "sonner";

export type ReviewDecision = "PENDING" | "APPROVED" | "EDITS_REQUESTED" | "REJECTED";

export interface ReviewMeta {
  decision: ReviewDecision;
  reviewerName: string;
  reviewerEmail: string;
  notes: string;
  reviewedAt: string | null;
  patientName: string | null;
  clinicName: string | null;
}

interface Props {
  token: string;
  meta: ReviewMeta;
  onSubmitted: (next: ReviewMeta) => void;
}

// Sticky footer card with the three decision actions + reviewer identity
// + notes. Approve allows empty notes; Edits/Reject require a note (also
// enforced server-side in /api/review/[token]).
export function ReviewFooter({ token, meta, onSubmitted }: Props) {
  const [name, setName] = useState(meta.reviewerName);
  const [email, setEmail] = useState(meta.reviewerEmail);
  const [notes, setNotes] = useState(meta.notes);
  const [submitting, setSubmitting] = useState<ReviewDecision | null>(null);

  const alreadyDecided = meta.decision !== "PENDING";

  const submit = async (decision: Exclude<ReviewDecision, "PENDING">) => {
    if (!name.trim()) {
      toast.error("Please enter your name first.");
      return;
    }
    if (decision !== "APPROVED" && !notes.trim()) {
      toast.error("Please add a note explaining the decision.");
      return;
    }

    setSubmitting(decision);
    try {
      const res = await fetch(`/api/review/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, reviewerName: name, reviewerEmail: email, notes }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? `Request failed (HTTP ${res.status})`);
      }
      toast.success(
        decision === "APPROVED" ? "Approved — thank you."
        : decision === "EDITS_REQUESTED" ? "Edits requested. The clinic has been notified."
        : "Rejected. The clinic has been notified.",
      );
      onSubmitted({
        ...meta,
        decision,
        reviewerName: name,
        reviewerEmail: email,
        notes,
        reviewedAt: new Date().toISOString(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error("Could not submit", { description: message });
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 border-t border-stone-200 bg-white/95 backdrop-blur-xl shadow-[0_-18px_50px_-20px_rgba(15,23,42,0.18)]">
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
        {alreadyDecided ? (
          <p className="text-sm text-stone-600">
            This case was reviewed by{" "}
            <span className="font-semibold text-slate-900">{meta.reviewerName || "—"}</span>{" "}
            on{" "}
            <span className="font-semibold text-slate-900">
              {meta.reviewedAt ? new Date(meta.reviewedAt).toLocaleString() : "—"}
            </span>
            . You can submit a new decision below.
          </p>
        ) : null}

        <div className="mt-2 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_1fr_2fr_auto] lg:items-end">
          <Field label="Your name" required>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Dr. Full Name"
              className="h-10 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm focus:border-slate-900 focus:outline-none"
            />
          </Field>
          <Field label="Email (optional)">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="doctor@clinic.com"
              className="h-10 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm focus:border-slate-900 focus:outline-none"
            />
          </Field>
          <Field label="Notes (required for Edits / Reject)">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What should change? Anything missing?"
              rows={2}
              className="w-full resize-none rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
            />
          </Field>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <DecisionButton
              tone="reject"
              icon={<X className="h-4 w-4" />}
              label="Reject"
              disabled={!!submitting}
              loading={submitting === "REJECTED"}
              onClick={() => submit("REJECTED")}
            />
            <DecisionButton
              tone="edits"
              icon={<MessageCircle className="h-4 w-4" />}
              label="Request edits"
              disabled={!!submitting}
              loading={submitting === "EDITS_REQUESTED"}
              onClick={() => submit("EDITS_REQUESTED")}
            />
            <DecisionButton
              tone="approve"
              icon={<Check className="h-4 w-4" />}
              label="Approve"
              disabled={!!submitting}
              loading={submitting === "APPROVED"}
              onClick={() => submit("APPROVED")}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-stone-500">
        {label}
        {required && <span className="ml-1 text-rose-600">*</span>}
      </span>
      {children}
    </label>
  );
}

function DecisionButton({
  tone,
  icon,
  label,
  disabled,
  loading,
  onClick,
}: {
  tone: "approve" | "edits" | "reject";
  icon: React.ReactNode;
  label: string;
  disabled: boolean;
  loading: boolean;
  onClick: () => void;
}) {
  const palette: Record<string, string> = {
    approve: "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700",
    edits:   "bg-amber-500 hover:bg-amber-600 text-white border-amber-600",
    reject:  "bg-white hover:bg-rose-50 text-rose-700 border-rose-300",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition disabled:opacity-50 ${palette[tone]}`}
    >
      {loading ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        icon
      )}
      {label}
    </button>
  );
}
