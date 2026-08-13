"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, BookOpen, FlaskConical, IndianRupee, LoaderCircle, Mic, MicOff, PackageSearch, Scale, Send, ShieldCheck, Sparkles, Stethoscope, ThumbsDown, ThumbsUp, Volume2, VolumeX } from "lucide-react";
import type { ResponseAction, ResponsePresentation } from "@hairos/packages/assistant-core";
import { useAssistantCompanion } from "./AssistantCompanion";
import { AssistantResponseCards } from "./AssistantResponseCards";
import { SourceDrawer, type AssistantSource } from "./SourceDrawer";

type Mode = "GENERAL_KNOWLEDGE" | "PERSONAL_PLAN";
type Source = AssistantSource;
type Trace = { intent: string; authorities: string[]; tools: Array<{ name: string; status: string; sourceIds: string[] }>; sources: Source[]; provisional: boolean; safetyDecision: string; escalationState: string | null };
type Message = { id: string; role: "user" | "assistant"; content: string; action?: string; sources?: Source[]; presentation?: ResponsePresentation; trace?: Trace; releaseMode?: string; mode: Mode };

interface BrowserSpeechRecognitionResult { readonly isFinal: boolean; readonly 0: { transcript: string } }
interface BrowserSpeechRecognitionEvent { readonly results: { readonly length: number; readonly [index: number]: BrowserSpeechRecognitionResult } }
interface BrowserSpeechRecognitionErrorEvent { readonly error: string }
interface BrowserSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;
type VoiceWindow = Window & { SpeechRecognition?: BrowserSpeechRecognitionConstructor; webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor };

const GREETING_PATTERN = /\b(hi|hello|hey)\b/i;
const GREETING_WAVE_HOLD_MS = 1600;

const STARTERS: Array<{ title: string; description: string; prompt: string; mode: Mode; icon: typeof BookOpen }> = [
  { title: "Check a clinical factor", description: "Fast impact and relevance summary", prompt: "Patient smokes heavily, will it impact hair?", mode: "GENERAL_KNOWLEDGE", icon: BookOpen },
  { title: "Explore kits", description: "See documented kit contents", prompt: "What comes in Hair Fact TE Gold?", mode: "GENERAL_KNOWLEDGE", icon: PackageSearch },
  { title: "Compare products", description: "Compare exact approved catalogue facts", prompt: "Compare F-TRICHORISE and F-TRICHO STRONG", mode: "GENERAL_KNOWLEDGE", icon: Scale },
  { title: "Check ingredients", description: "Look up exact formulation fields", prompt: "What are the ingredients in F-TRICHORISE?", mode: "GENERAL_KNOWLEDGE", icon: FlaskConical },
  { title: "View current MRP", description: "Prices only from published records", prompt: "What is the current MRP of TE Gold?", mode: "GENERAL_KNOWLEDGE", icon: IndianRupee },
  { title: "Review an approved plan", description: "Private patient context, sign-in required", prompt: "Explain this doctor-approved treatment plan", mode: "PERSONAL_PLAN", icon: Stethoscope },
];

export function AssistantChat() {
  const [mode, setMode] = useState<Mode>("GENERAL_KNOWLEDGE");
  const [messages, setMessages] = useState<Message[]>([]);
  const [query, setQuery] = useState("");
  const [threadId, setThreadId] = useState<string>();
  const [generalConversationId, setGeneralConversationId] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string>();
  const [speakingMessageId, setSpeakingMessageId] = useState<string>();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const retrievalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const voiceBaseQueryRef = useRef("");
  const greetingDetectedRef = useRef(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const cancelledUtterancesRef = useRef(new WeakSet<SpeechSynthesisUtterance>());
  const companion = useAssistantCompanion();

  useEffect(() => {
    const cancelledUtterances = cancelledUtterancesRef.current;
    return () => {
      if (retrievalTimerRef.current) clearTimeout(retrievalTimerRef.current);
      recognitionRef.current?.abort();
      if (utteranceRef.current) cancelledUtterances.add(utteranceRef.current);
      window.speechSynthesis?.cancel();
    };
  }, []);

  function chooseStarter(starter: (typeof STARTERS)[number]) {
    setMode(starter.mode); companion.setMode(starter.mode === "PERSONAL_PLAN" ? "patient" : "general"); setQuery(starter.prompt); setError(undefined); setNeedsSignIn(false); companion.listen("composer"); inputRef.current?.focus();
  }

  function toggleListening() {
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    const voiceWindow = window as VoiceWindow;
    const Recognition = voiceWindow.SpeechRecognition ?? voiceWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setVoiceError("Voice input is not supported in this browser. You can still type your question.");
      return;
    }

    if (utteranceRef.current) cancelledUtterancesRef.current.add(utteranceRef.current);
    window.speechSynthesis.cancel();
    setSpeakingMessageId(undefined);
    setVoiceError(undefined);
    voiceBaseQueryRef.current = query.trim();
    greetingDetectedRef.current = false;
    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = navigator.language || "en-IN";
    recognition.onstart = () => { setIsListening(true); companion.listen("composer"); };
    recognition.onresult = (event) => {
      let transcript = "";
      for (let index = 0; index < event.results.length; index += 1) transcript += event.results[index][0]?.transcript ?? "";
      const spokenText = transcript.trim();
      const combined = [voiceBaseQueryRef.current, spokenText].filter(Boolean).join(" ");
      setQuery(combined);
      if (!greetingDetectedRef.current && GREETING_PATTERN.test(spokenText)) {
        greetingDetectedRef.current = true;
        companion.wave("composer");
      }
    };
    recognition.onerror = (event) => {
      const message = event.error === "not-allowed" || event.error === "service-not-allowed"
        ? "Microphone access was blocked. Allow microphone permission in your browser and try again."
        : event.error === "no-speech"
          ? "I did not hear anything. Try again and speak clearly."
          : event.error === "audio-capture"
            ? "No microphone was detected. Check your microphone connection and browser settings."
            : "Voice input stopped unexpectedly. Please try again or type your question.";
      setVoiceError(message);
    };
    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
      if (!greetingDetectedRef.current && !busy) companion.transition("idle-perched", "composer");
      inputRef.current?.focus();
    };
    recognitionRef.current = recognition;
    try { recognition.start(); }
    catch { setVoiceError("The microphone could not start. Check browser permission and try again."); }
  }

  function speakMessage(message: Message) {
    if (!("speechSynthesis" in window)) {
      setVoiceError("Speech playback is not supported in this browser.");
      return;
    }
    if (speakingMessageId === message.id) {
      if (utteranceRef.current) cancelledUtterancesRef.current.add(utteranceRef.current);
      window.speechSynthesis.cancel();
      utteranceRef.current = null;
      setSpeakingMessageId(undefined);
      companion.transition("idle-perched", "bottom-right");
      return;
    }

    recognitionRef.current?.stop();
    if (utteranceRef.current) cancelledUtterancesRef.current.add(utteranceRef.current);
    window.speechSynthesis.cancel();
    setVoiceError(undefined);
    const utterance = new SpeechSynthesisUtterance(message.content);
    utterance.lang = navigator.language || "en-IN";
    utterance.rate = 0.96;
    utterance.pitch = 1;
    utterance.onstart = () => { setSpeakingMessageId(message.id); companion.answer("composer"); };
    utterance.onend = () => {
      const wasCancelled = cancelledUtterancesRef.current.has(utterance);
      setSpeakingMessageId(undefined); utteranceRef.current = null;
      if (wasCancelled) companion.transition("idle-perched", "bottom-right"); else companion.succeed();
    };
    utterance.onerror = () => {
      const wasCancelled = cancelledUtterancesRef.current.has(utterance);
      setSpeakingMessageId(undefined); utteranceRef.current = null;
      if (!wasCancelled) { setVoiceError("Speech playback stopped. Try the read-aloud button again."); companion.fail(); }
    };
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); const text = query.trim(); if (!text || busy) return;
    const isGreeting = GREETING_PATTERN.test(text);
    const greetingStartedAt = isGreeting ? Date.now() : 0;
    if (isListening) { greetingDetectedRef.current = true; recognitionRef.current?.stop(); }
    if (utteranceRef.current) cancelledUtterancesRef.current.add(utteranceRef.current);
    window.speechSynthesis.cancel(); utteranceRef.current = null; setSpeakingMessageId(undefined); setVoiceError(undefined);
    const userMessage: Message = { id: crypto.randomUUID(), role: "user", content: text, mode };
    setMessages((items) => [...items, userMessage]);
    setQuery(""); setBusy(true); setError(undefined); setNeedsSignIn(false);
    if (isGreeting) companion.wave("composer");
    else {
      companion.think("bottom-left");
      retrievalTimerRef.current = setTimeout(() => companion.takeNotes("bottom-left"), 420);
    }
    try {
      const generalHistory = messages.filter((item) => item.mode === "GENERAL_KNOWLEDGE").slice(-6).map(({ role, content }) => ({ role, content }));
      const response = await fetch(mode === "GENERAL_KNOWLEDGE" ? "/api/assistant/general" : "/api/assistant/chat", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(mode === "GENERAL_KNOWLEDGE" ? { mode, query: text, conversationId: generalConversationId, history: generalHistory } : { mode, query: text, threadId }),
      });
      const data = await response.json();
      if (retrievalTimerRef.current) clearTimeout(retrievalTimerRef.current);
      if (isGreeting) {
        const remainingWaveTime = GREETING_WAVE_HOLD_MS - (Date.now() - greetingStartedAt);
        if (remainingWaveTime > 0) await new Promise((resolve) => window.setTimeout(resolve, remainingWaveTime));
      }
      if (!response.ok) {
        if (mode === "PERSONAL_PLAN" && (response.status === 401 || response.status === 403)) setNeedsSignIn(true);
        throw new Error(data.error ?? "The assistant request failed");
      }
      if (mode === "PERSONAL_PLAN") setThreadId(data.threadId);
      else setGeneralConversationId(data.conversationId);
      setMessages((items) => [...items, { id: data.messageId ?? data.requestId ?? crypto.randomUUID(), role: "assistant", content: data.answer, action: data.action, sources: data.sources, presentation: data.presentation, trace: data.trace, releaseMode: data.releaseMode, mode }]);
      if (data.action && data.action !== "ANSWER") companion.caution();
      else {
        companion.answer("composer");
        window.setTimeout(() => companion.succeed(), 700);
        if (data.sources?.length) window.setTimeout(() => companion.guide("sources"), 1900);
      }
    } catch (reason) { if (retrievalTimerRef.current) clearTimeout(retrievalTimerRef.current); setError(reason instanceof Error ? reason.message : "The assistant request failed"); companion.fail(); }
    finally { setBusy(false); inputRef.current?.focus(); }
  }

  async function feedback(messageId: string, helpful: boolean) {
    if (!threadId) return;
    await fetch("/api/assistant/feedback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ threadId, messageId, helpful }) });
  }

  function handleResponseAction(message: Message, action: ResponseAction) {
    if (action.id === "SOURCES" || action.id === "FULL_FORMULATION") {
      const targetId = action.id === "SOURCES" ? `sources-${message.id}` : `formulation-${message.id}`;
      const target = document.getElementById(targetId) as HTMLDetailsElement | null;
      if (target) { target.open = true; target.scrollIntoView({ behavior: "smooth", block: "nearest" }); }
      return;
    }
    if (action.prompt) { setQuery(action.prompt); inputRef.current?.focus(); companion.listen("composer"); }
  }

  return (
    <section className="mx-auto flex min-h-[calc(100dvh-2rem)] w-full max-w-6xl flex-col overflow-clip rounded-3xl border border-slate-200 bg-white shadow-sm" aria-label="Dr. FACT doctor reference assistant">
      <header className="bg-slate-950 px-5 py-5 text-white sm:px-8 sm:py-6">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div className="max-w-2xl"><div className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300"><Sparkles className="size-4" aria-hidden="true" />Dr. FACT · Doctor mode</div><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Clinical answers, without the consultation</h1><p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">Fast clinical and product reference for use between patient decisions. Direct answer first; detail only when you ask.</p></div>
          <div className="inline-flex rounded-xl border border-slate-700 bg-slate-900 p-1" role="group" aria-label="Assistant mode">
            <button type="button" onClick={() => { setMode("GENERAL_KNOWLEDGE"); companion.setMode("general"); companion.transition("roaming", "suggested-prompts", 1300); }} aria-pressed={mode === "GENERAL_KNOWLEDGE"} className={`min-h-11 rounded-lg px-4 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 ${mode === "GENERAL_KNOWLEDGE" ? "bg-white text-slate-950" : "text-slate-300 hover:bg-slate-800"}`}>Doctor reference</button>
            <button type="button" onClick={() => { setMode("PERSONAL_PLAN"); companion.setMode("patient"); companion.transition("roaming", "composer", 1300); }} aria-pressed={mode === "PERSONAL_PLAN"} className={`min-h-11 rounded-lg px-4 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 ${mode === "PERSONAL_PLAN" ? "bg-white text-slate-950" : "text-slate-300 hover:bg-slate-800"}`}>Approved plan</button>
          </div>
        </div>
      </header>

      {!messages.length && <div className="border-b border-slate-200 bg-gradient-to-b from-emerald-50 to-white p-4 pb-44 sm:p-8">
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-white p-4 text-sm text-slate-700"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-700" aria-hidden="true" /><p><span className="font-semibold text-slate-950">Controlled reference mode.</span> Answers use active approved Hair knowledge and exact structured catalogue records. Sources stay attached and deeper context stays collapsed.</p></div>
        <div data-companion-anchor="suggested-prompts" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{STARTERS.map((starter) => { const Icon = starter.icon; return <button key={starter.title} type="button" onClick={() => chooseStarter(starter)} className="group min-h-28 cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 text-left transition duration-200 hover:border-emerald-400 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"><span className="mb-3 grid size-10 place-items-center rounded-xl bg-slate-100 text-slate-800 transition group-hover:bg-emerald-100 group-hover:text-emerald-800"><Icon className="size-5" aria-hidden="true" /></span><span className="block font-semibold text-slate-950">{starter.title}</span><span className="mt-1 block text-sm leading-5 text-slate-600">{starter.description}</span></button>; })}</div>
      </div>}

      <div className="flex-1 space-y-6 bg-slate-50 p-4 pb-8 sm:p-7 sm:pb-10" aria-live="polite" aria-busy={busy}>
        {messages.map((message) => message.role === "user" ? <article key={message.id} className="ml-auto max-w-[92%] rounded-2xl rounded-br-md bg-slate-900 px-4 py-3 text-[15px] leading-6 text-white sm:max-w-[72%]">{message.content}</article> : <article key={message.id} className="w-full max-w-4xl">
          <div className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-800">{message.mode === "GENERAL_KNOWLEDGE" ? `Doctor reference · ${message.presentation?.depth?.replaceAll("_", " ") ?? "Quick"}` : "Approved plan"}</div>
          {message.action && message.action !== "ANSWER" ? <div className="mb-3 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900"><AlertTriangle className="size-4 shrink-0" aria-hidden="true" />{message.action.replaceAll("_", " ")}</div> : null}
          {message.presentation ? <AssistantResponseCards cards={message.presentation.cards} messageId={message.id} depth={message.presentation.depth} /> : <div className="rounded-2xl border border-slate-200 bg-white p-4 text-[15px] leading-6 text-slate-800 shadow-sm"><p className="whitespace-pre-wrap">{message.content}</p></div>}
          {message.presentation?.actions?.length ? <div className="mt-3 flex flex-wrap gap-2" aria-label="Follow-up actions">{message.presentation.actions.map((action) => <button key={action.id} type="button" onClick={() => handleResponseAction(message, action)} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-emerald-300 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">{action.label}</button>)}</div> : null}
          <button type="button" onClick={() => speakMessage(message)} aria-pressed={speakingMessageId === message.id} className={`mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border px-3.5 text-sm font-semibold shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${speakingMessageId === message.id ? "border-emerald-600 bg-emerald-700 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:text-emerald-800"}`}>
            {speakingMessageId === message.id ? <VolumeX className="size-4" aria-hidden="true" /> : <Volume2 className="size-4" aria-hidden="true" />}
            {speakingMessageId === message.id ? "Stop reading" : "Read answer aloud"}
          </button>
          {message.sources?.length ? <div data-companion-anchor="sources"><SourceDrawer sources={message.sources} messageId={message.id} /></div> : null}
          {message.trace ? <details className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50/60 px-4"><summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-indigo-800">Internal execution trace</summary><dl className="grid gap-3 border-t border-indigo-100 py-3 text-xs text-slate-800 sm:grid-cols-2"><div><dt className="font-semibold">Release mode</dt><dd>{message.releaseMode}</dd></div><div><dt className="font-semibold">Detected intent</dt><dd>{message.trace.intent}</dd></div><div><dt className="font-semibold">Selected authority</dt><dd>{message.trace.authorities.join(", ") || "None"}</dd></div><div><dt className="font-semibold">Provisional status</dt><dd>{message.trace.provisional ? "Yes - internal preview only" : "No"}</dd></div><div><dt className="font-semibold">Safety decision</dt><dd>{message.trace.safetyDecision}</dd></div><div><dt className="font-semibold">Escalation state</dt><dd>{message.trace.escalationState ?? "None"}</dd></div><div className="sm:col-span-2"><dt className="font-semibold">Tools called</dt><dd>{message.trace.tools.length ? message.trace.tools.map((tool) => `${tool.name} (${tool.status})`).join(", ") : "None"}</dd></div></dl></details> : null}
          {message.mode === "PERSONAL_PLAN" ? <div className="mt-3 flex gap-2"><button type="button" className="grid min-h-11 min-w-11 cursor-pointer place-items-center rounded-xl border border-slate-200 bg-white hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700" onClick={() => feedback(message.id, true)} aria-label="Mark answer helpful"><ThumbsUp className="size-4" /></button><button type="button" className="grid min-h-11 min-w-11 cursor-pointer place-items-center rounded-xl border border-slate-200 bg-white hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700" onClick={() => feedback(message.id, false)} aria-label="Mark answer not helpful"><ThumbsDown className="size-4" /></button></div> : null}
        </article>)}
        {busy && <div className="flex min-h-12 items-center gap-2 text-sm text-slate-700"><LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />{mode === "GENERAL_KNOWLEDGE" ? "Checking approved knowledge and catalogue records…" : "Checking your approved plan…"}</div>}
        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"><p>{error}</p>{needsSignIn && <Link href="/login?next=/assistant" className="mt-3 inline-flex min-h-11 items-center rounded-lg bg-slate-950 px-4 font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700">Sign in to view my approved plan</Link>}</div>}
      </div>

      <form data-companion-anchor="composer" onSubmit={submit} className="sticky bottom-0 z-20 border-t border-slate-200 bg-white/95 p-4 shadow-[0_-8px_24px_rgba(15,23,42,0.05)] backdrop-blur sm:p-5">
        <div className="mb-2 flex items-center justify-between gap-3"><label htmlFor="assistant-query" className="text-sm font-medium text-slate-900">{mode === "GENERAL_KNOWLEDGE" ? "Ask one clinical or product question" : "Ask about the approved plan"}</label><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{mode === "GENERAL_KNOWLEDGE" ? "Quick by default" : "Sign-in required"}</span></div>
        <div className="flex items-end gap-2">
          <textarea ref={inputRef} id="assistant-query" value={query} onChange={(event) => {
            const nextQuery = event.target.value;
            const containsGreeting = GREETING_PATTERN.test(nextQuery);
            setQuery(nextQuery);
            if (containsGreeting && !greetingDetectedRef.current) { greetingDetectedRef.current = true; companion.wave("composer"); }
            else if (!containsGreeting) { greetingDetectedRef.current = false; if (!busy) companion.listen("composer"); }
          }} onFocus={() => { if (!busy) companion.listen("composer"); }} onBlur={() => { if (!busy && !error) companion.transition("idle-perched", "bottom-right"); }} rows={2} maxLength={4000} className="min-h-12 flex-1 resize-none rounded-xl border border-slate-300 px-4 py-3 text-base outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100" placeholder={mode === "GENERAL_KNOWLEDGE" ? "Ask about shedding, kits, products, ingredients, topicals or lifestyle…" : "For example: Why is this kit first in my approved sequence?"} />
          <button type="button" onClick={toggleListening} aria-pressed={isListening} aria-label={isListening ? "Stop listening" : "Ask with microphone"} title={isListening ? "Stop listening" : "Ask with microphone"} className={`grid min-h-12 min-w-12 cursor-pointer place-items-center rounded-xl border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 ${isListening ? "border-red-600 bg-red-600 text-white shadow-[0_0_0_4px_rgba(220,38,38,0.12)]" : "border-slate-300 bg-white text-slate-700 hover:border-emerald-600 hover:text-emerald-800"}`}>
            {isListening ? <MicOff className="size-5" aria-hidden="true" /> : <Mic className="size-5" aria-hidden="true" />}
          </button>
          <button disabled={busy || !query.trim()} className="grid min-h-12 min-w-12 cursor-pointer place-items-center rounded-xl bg-emerald-700 text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:cursor-not-allowed disabled:opacity-50" aria-label="Send question"><Send className="size-5" /></button>
        </div>
        <div className="mt-2 min-h-5" aria-live="polite">{isListening ? <p className="text-xs font-semibold text-red-700">Listening… speak now. Say “Hi” to see the doctor wave.</p> : voiceError ? <p className="text-xs font-medium text-red-700" role="alert">{voiceError}</p> : null}</div>
        <p className="mt-2 text-xs leading-5 text-slate-600">Controlled reference · Apply clinical judgment · No autonomous diagnosis or treatment change</p>
      </form>
    </section>
  );
}
