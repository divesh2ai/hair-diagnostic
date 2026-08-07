"use client";

import { FormEvent, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, BookOpen, FlaskConical, IndianRupee, LoaderCircle, PackageSearch, Scale, Send, ShieldCheck, Sparkles, Stethoscope, ThumbsDown, ThumbsUp } from "lucide-react";

type Mode = "GENERAL_KNOWLEDGE" | "PERSONAL_PLAN";
type Source = { sourceId: string; label: string; field?: string; version?: number; effectiveFrom?: string | null; approvalStatus?: string; url?: string; knowledgeSystem?: string; authorityScore?: number };
type Trace = { intent: string; authorities: string[]; tools: Array<{ name: string; status: string; sourceIds: string[] }>; sources: Source[]; provisional: boolean; safetyDecision: string; escalationState: string | null };
type Message = { id: string; role: "user" | "assistant"; content: string; action?: string; sources?: Source[]; trace?: Trace; releaseMode?: string; mode: Mode };

const sourceKey = (source: Source) => `${source.sourceId}:${source.field ?? ""}`;
const uniqueSources = (sources: Source[]) => sources.filter((source, index, all) =>
  all.findIndex((candidate) => sourceKey(candidate) === sourceKey(source)) === index,
);

const STARTERS: Array<{ title: string; description: string; prompt: string; mode: Mode; icon: typeof BookOpen }> = [
  { title: "Ask about hair health", description: "Conditions, biology, care and safety", prompt: "Why can hair shedding increase after stress?", mode: "GENERAL_KNOWLEDGE", icon: BookOpen },
  { title: "Explore kits", description: "See documented kit contents", prompt: "What comes in Hair Fact TE Gold?", mode: "GENERAL_KNOWLEDGE", icon: PackageSearch },
  { title: "Compare products", description: "Compare exact approved catalogue facts", prompt: "Compare F-TRICHORISE and F-TRICHO STRONG", mode: "GENERAL_KNOWLEDGE", icon: Scale },
  { title: "Check ingredients", description: "Look up exact formulation fields", prompt: "What are the ingredients in F-TRICHORISE?", mode: "GENERAL_KNOWLEDGE", icon: FlaskConical },
  { title: "View current MRP", description: "Prices only from published records", prompt: "What is the current MRP of TE Gold?", mode: "GENERAL_KNOWLEDGE", icon: IndianRupee },
  { title: "Understand my approved plan", description: "Private, sign-in required", prompt: "Explain my doctor-approved treatment plan", mode: "PERSONAL_PLAN", icon: Stethoscope },
];

export function AssistantChat() {
  const [mode, setMode] = useState<Mode>("GENERAL_KNOWLEDGE");
  const [messages, setMessages] = useState<Message[]>([]);
  const [query, setQuery] = useState("");
  const [threadId, setThreadId] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  function chooseStarter(starter: (typeof STARTERS)[number]) {
    setMode(starter.mode); setQuery(starter.prompt); setError(undefined); setNeedsSignIn(false); inputRef.current?.focus();
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); const text = query.trim(); if (!text || busy) return;
    const userMessage: Message = { id: crypto.randomUUID(), role: "user", content: text, mode };
    setMessages((items) => [...items, userMessage]);
    setQuery(""); setBusy(true); setError(undefined); setNeedsSignIn(false);
    try {
      const generalHistory = messages.filter((item) => item.mode === "GENERAL_KNOWLEDGE").slice(-6).map(({ role, content }) => ({ role, content }));
      const response = await fetch(mode === "GENERAL_KNOWLEDGE" ? "/api/assistant/general" : "/api/assistant/chat", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(mode === "GENERAL_KNOWLEDGE" ? { mode, query: text, history: generalHistory } : { mode, query: text, threadId }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (mode === "PERSONAL_PLAN" && (response.status === 401 || response.status === 403)) setNeedsSignIn(true);
        throw new Error(data.error ?? "The assistant request failed");
      }
      if (mode === "PERSONAL_PLAN") setThreadId(data.threadId);
      setMessages((items) => [...items, { id: data.messageId ?? data.requestId ?? crypto.randomUUID(), role: "assistant", content: data.answer, action: data.action, sources: data.sources, trace: data.trace, releaseMode: data.releaseMode, mode }]);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The assistant request failed"); }
    finally { setBusy(false); inputRef.current?.focus(); }
  }

  async function feedback(messageId: string, helpful: boolean) {
    if (!threadId) return;
    await fetch("/api/assistant/feedback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ threadId, messageId, helpful }) });
  }

  return (
    <section className="mx-auto flex min-h-[calc(100dvh-2rem)] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm" aria-label="Dr. FACT hair health assistant">
      <header className="bg-slate-950 px-5 py-5 text-white sm:px-8 sm:py-6">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div className="max-w-2xl"><div className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300"><Sparkles className="size-4" aria-hidden="true" />Dr. FACT</div><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Your hair health knowledge assistant</h1><p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">Ask general questions without signing in. Personal records are opened only when you explicitly choose your approved plan.</p></div>
          <div className="inline-flex rounded-xl border border-slate-700 bg-slate-900 p-1" role="group" aria-label="Assistant mode">
            <button type="button" onClick={() => setMode("GENERAL_KNOWLEDGE")} aria-pressed={mode === "GENERAL_KNOWLEDGE"} className={`min-h-11 rounded-lg px-4 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 ${mode === "GENERAL_KNOWLEDGE" ? "bg-white text-slate-950" : "text-slate-300 hover:bg-slate-800"}`}>General knowledge</button>
            <button type="button" onClick={() => setMode("PERSONAL_PLAN")} aria-pressed={mode === "PERSONAL_PLAN"} className={`min-h-11 rounded-lg px-4 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 ${mode === "PERSONAL_PLAN" ? "bg-white text-slate-950" : "text-slate-300 hover:bg-slate-800"}`}>My approved plan</button>
          </div>
        </div>
      </header>

      {!messages.length && <div className="border-b border-slate-200 bg-gradient-to-b from-emerald-50 to-white p-4 sm:p-8">
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-white p-4 text-sm text-slate-700"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-700" aria-hidden="true" /><p><span className="font-semibold text-slate-950">General mode is private-data free.</span> It retrieves only active, effective, patient-published Hair knowledge and uses structured catalogue records for exact facts.</p></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{STARTERS.map((starter) => { const Icon = starter.icon; return <button key={starter.title} type="button" onClick={() => chooseStarter(starter)} className="group min-h-28 cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 text-left transition duration-200 hover:border-emerald-400 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"><span className="mb-3 grid size-10 place-items-center rounded-xl bg-slate-100 text-slate-800 transition group-hover:bg-emerald-100 group-hover:text-emerald-800"><Icon className="size-5" aria-hidden="true" /></span><span className="block font-semibold text-slate-950">{starter.title}</span><span className="mt-1 block text-sm leading-5 text-slate-600">{starter.description}</span></button>; })}</div>
      </div>}

      <div className="flex-1 space-y-5 bg-slate-50 p-4 sm:p-7" aria-live="polite" aria-busy={busy}>
        {messages.map((message) => <article key={message.id} className={`max-w-[94%] rounded-2xl px-4 py-3 text-base leading-7 sm:max-w-[82%] ${message.role === "user" ? "ml-auto bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-800 shadow-sm"}`}>
          {message.role === "assistant" && <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-emerald-700">{message.mode === "GENERAL_KNOWLEDGE" ? "General knowledge" : "Personal approved plan"}</p>}
          {message.action && message.action !== "ANSWER" && <div className="mb-2 flex items-center gap-2 font-semibold text-amber-800"><AlertTriangle className="size-4" aria-hidden="true" />{message.action.replaceAll("_", " ")}</div>}
          <p className="whitespace-pre-wrap">{message.content}</p>
          {message.sources?.length ? <details className="mt-4 border-t border-slate-100 pt-3"><summary className="cursor-pointer font-medium text-emerald-800">Sources ({uniqueSources(message.sources).length})</summary><ol className="mt-2 space-y-2">{uniqueSources(message.sources).map((source, index) => <li key={sourceKey(source)} className="rounded-lg bg-slate-50 p-3 text-sm"><span className="mr-2 font-semibold">[{index + 1}]</span>{source.url?.startsWith("http") ? <a href={source.url} target="_blank" rel="noreferrer" className="font-medium text-emerald-800 underline decoration-emerald-300 underline-offset-2">{source.label}</a> : <span className="font-medium">{source.label}</span>}{source.knowledgeSystem ? <span className="mt-1 block text-xs text-slate-600">Knowledge system: {source.knowledgeSystem.replaceAll("_", " ")}</span> : null}{source.approvalStatus ? <span className="mt-1 block text-xs text-slate-600">Publication: {source.approvalStatus.replaceAll("_", " ")}</span> : null}</li>)}</ol></details> : null}
          {message.trace ? <details className="mt-4 border-t border-slate-100 pt-3"><summary className="cursor-pointer font-medium text-indigo-800">Internal execution trace</summary><dl className="mt-2 grid gap-3 rounded-xl bg-indigo-50 p-3 text-xs text-slate-800 sm:grid-cols-2"><div><dt className="font-semibold">Release mode</dt><dd>{message.releaseMode}</dd></div><div><dt className="font-semibold">Detected intent</dt><dd>{message.trace.intent}</dd></div><div><dt className="font-semibold">Selected authority</dt><dd>{message.trace.authorities.join(", ") || "None"}</dd></div><div><dt className="font-semibold">Provisional status</dt><dd>{message.trace.provisional ? "Yes - internal preview only" : "No"}</dd></div><div><dt className="font-semibold">Safety decision</dt><dd>{message.trace.safetyDecision}</dd></div><div><dt className="font-semibold">Escalation state</dt><dd>{message.trace.escalationState ?? "None"}</dd></div><div className="sm:col-span-2"><dt className="font-semibold">Tools called</dt><dd>{message.trace.tools.length ? message.trace.tools.map((tool) => `${tool.name} (${tool.status})`).join(", ") : "None"}</dd></div></dl></details> : null}
          {message.role === "assistant" && message.mode === "PERSONAL_PLAN" && <div className="mt-3 flex gap-2"><button className="grid min-h-11 min-w-11 cursor-pointer place-items-center rounded-xl border border-slate-200 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700" onClick={() => feedback(message.id, true)} aria-label="Mark answer helpful"><ThumbsUp className="size-4" /></button><button className="grid min-h-11 min-w-11 cursor-pointer place-items-center rounded-xl border border-slate-200 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700" onClick={() => feedback(message.id, false)} aria-label="Mark answer not helpful"><ThumbsDown className="size-4" /></button></div>}
        </article>)}
        {busy && <div className="flex min-h-12 items-center gap-2 text-sm text-slate-700"><LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />{mode === "GENERAL_KNOWLEDGE" ? "Checking approved knowledge and catalogue records…" : "Checking your approved plan…"}</div>}
        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"><p>{error}</p>{needsSignIn && <Link href="/login?next=/assistant" className="mt-3 inline-flex min-h-11 items-center rounded-lg bg-slate-950 px-4 font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700">Sign in to view my approved plan</Link>}</div>}
      </div>

      <form onSubmit={submit} className="border-t border-slate-200 bg-white p-4 sm:p-5">
        <div className="mb-2 flex items-center justify-between gap-3"><label htmlFor="assistant-query" className="text-sm font-medium text-slate-900">{mode === "GENERAL_KNOWLEDGE" ? "Ask a hair health question" : "Ask about your approved plan"}</label><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{mode === "GENERAL_KNOWLEDGE" ? "No sign-in needed" : "Sign-in required"}</span></div>
        <div className="flex items-end gap-2"><textarea ref={inputRef} id="assistant-query" value={query} onChange={(event) => setQuery(event.target.value)} rows={2} maxLength={4000} className="min-h-12 flex-1 resize-none rounded-xl border border-slate-300 px-4 py-3 text-base outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100" placeholder={mode === "GENERAL_KNOWLEDGE" ? "Ask about shedding, kits, products, ingredients, topicals or lifestyle…" : "For example: Why is this kit first in my approved sequence?"} /><button disabled={busy || !query.trim()} className="grid min-h-12 min-w-12 cursor-pointer place-items-center rounded-xl bg-emerald-700 text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:cursor-not-allowed disabled:opacity-50" aria-label="Send question"><Send className="size-5" /></button></div>
        <p className="mt-2 text-xs leading-5 text-slate-600">Educational information only. Not for emergencies, diagnosis, dosage changes, or replacing doctor advice.</p>
      </form>
    </section>
  );
}