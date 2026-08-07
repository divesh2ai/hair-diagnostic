"use client";

import { use, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, CheckCircle2, Send } from "lucide-react";

// Public lead-capture landing. Meta / Instagram ad → /lead/[clinicSlug] →
// short form → confirmation with the clinic-branded assessment link.

const LANGUAGES: { code: string; label: string }[] = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
  { code: "mr", label: "मराठी" },
  { code: "gu", label: "ગુજરાતી" },
  { code: "pa", label: "ਪੰਜਾਬੀ" },
  { code: "ta", label: "தமிழ்" },
  { code: "te", label: "తెలుగు" },
];

export default function LeadCapturePage({
  params,
}: {
  params: Promise<{ clinicSlug: string }>;
}) {
  const { clinicSlug } = use(params);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [language, setLanguage] = useState("en");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ assessmentUrl: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clinicSlug,
          name: name.trim(),
          phone: phone.trim(),
          language,
          source: new URLSearchParams(window.location.search).get("src") ?? "web",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Submission failed");
      setDone({ assessmentUrl: data.assessmentUrl });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Please try again");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 via-white to-teal-50/40 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-stone-200 bg-white p-6 sm:p-8 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.15)]">
        {!done ? (
          <>
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-700">
                Free consultation
              </p>
              <h1 className="font-serif text-2xl leading-tight text-slate-900">
                Talk to a hair specialist
              </h1>
              <p className="text-sm text-stone-500">
                Answer a few questions, get an AI-assisted plan reviewed by a
                dermatologist. No cost.
              </p>
            </div>
            <form onSubmit={submit} className="mt-6 space-y-4">
              <Field label="Your name">
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full name"
                  className={INPUT}
                  autoComplete="name"
                />
              </Field>
              <Field label="WhatsApp number">
                <input
                  required
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98200 00000"
                  className={INPUT}
                  autoComplete="tel"
                />
              </Field>
              <Field label="Preferred language">
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className={INPUT}
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </Field>
              <button
                type="submit"
                disabled={submitting || !name.trim() || phone.trim().length < 6}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                {submitting ? "Sending…" : "Start free consultation"}
              </button>
              <p className="text-[11px] text-stone-500 text-center">
                By submitting, you agree to be contacted by the clinic team.
              </p>
            </form>
          </>
        ) : (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-teal-100 text-teal-700">
              <CheckCircle2 className="size-6" />
            </div>
            <h2 className="font-serif text-xl text-slate-900">You're in.</h2>
            <p className="text-sm text-stone-600">
              We'll reach you on WhatsApp shortly. Want to start now?
            </p>
            <Link
              href={done.assessmentUrl}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-teal-600 px-5 py-2.5 text-sm font-medium text-white shadow hover:bg-teal-700"
            >
              Take the assessment
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">
        {label}
      </span>
      {children}
    </label>
  );
}

const INPUT =
  "block w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10";
