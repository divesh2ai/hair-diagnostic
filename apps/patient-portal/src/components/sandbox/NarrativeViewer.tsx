"use client";

import { useState } from "react";
import { Stethoscope, User, FileText, Copy, Check } from "lucide-react";

interface NarrativeData {
  doctorSummary: string;
  patientSummary: string;
  fullNarrative: string;
  length: string;
}

interface NarrativeViewerProps {
  narrative: NarrativeData;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="flex items-center gap-1 text-xs text-white/30 hover:text-white/60 transition-colors"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function WordCount({ text }: { text: string }) {
  const words = text?.trim().split(/\s+/).filter(Boolean).length ?? 0;
  const chars = text?.length ?? 0;
  return (
    <span className="text-xs text-white/30 tabular-nums">
      {words.toLocaleString()} words · {chars.toLocaleString()} chars
    </span>
  );
}

export function NarrativeViewer({ narrative }: NarrativeViewerProps) {
  const [activeTab, setActiveTab] = useState<"patient" | "doctor" | "full">("patient");

  const tabs: { id: "patient" | "doctor" | "full"; label: string }[] = [
    { id: "patient", label: "Patient" },
    { id: "doctor", label: "Doctor" },
    { id: "full", label: "Full Report" },
  ];

  const hasPatient = narrative.patientSummary?.trim().length > 0;
  const hasDoctor = narrative.doctorSummary?.trim().length > 0;
  const hasFull = narrative.fullNarrative?.trim().length > 0;

  const activeContent =
    activeTab === "patient" ? narrative.patientSummary :
    activeTab === "doctor" ? narrative.doctorSummary :
    narrative.fullNarrative;

  return (
    <div className="space-y-6">
      {/* Summary row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-center">
          <p className="text-xs text-white/40 mb-1">Patient summary</p>
          <p className={`text-sm font-semibold ${hasPatient ? "text-emerald-300" : "text-white/30"}`}>
            {hasPatient ? "Generated" : "Missing"}
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-center">
          <p className="text-xs text-white/40 mb-1">Doctor summary</p>
          <p className={`text-sm font-semibold ${hasDoctor ? "text-emerald-300" : "text-white/30"}`}>
            {hasDoctor ? "Generated" : "Missing"}
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-center">
          <p className="text-xs text-white/40 mb-1">Narrative length</p>
          <p className="text-sm font-semibold text-sky-300 capitalize">{narrative.length ?? "—"}</p>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex items-center gap-1 rounded-lg bg-white/5 p-1 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-white/15 text-white"
                : "text-white/40 hover:text-white/65"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Active narrative */}
      <div className="rounded-xl border border-white/10 bg-white/[0.025] p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {activeTab === "patient" && <User className="h-4 w-4 text-teal-400" />}
            {activeTab === "doctor" && <Stethoscope className="h-4 w-4 text-sky-400" />}
            {activeTab === "full" && <FileText className="h-4 w-4 text-violet-400" />}
            <h3 className="text-sm font-semibold text-white">
              {activeTab === "patient" && "Patient Summary"}
              {activeTab === "doctor" && "Doctor Summary"}
              {activeTab === "full" && "Full Clinical Narrative"}
            </h3>
          </div>
          <div className="flex items-center gap-3">
            <WordCount text={activeContent ?? ""} />
            {activeContent && <CopyButton text={activeContent} />}
          </div>
        </div>
        {!activeContent || activeContent.trim().length === 0 ? (
          <div className="rounded-lg bg-black/20 px-4 py-10 text-center">
            <p className="text-sm text-white/25 italic">No narrative generated for this view</p>
          </div>
        ) : (
          <div className="rounded-lg bg-black/15 px-5 py-4 max-h-96 overflow-y-auto">
            <p className="text-sm text-white/75 leading-relaxed whitespace-pre-wrap">{activeContent}</p>
          </div>
        )}
      </div>

      {/* Missing narrative detector */}
      {(!hasPatient || !hasDoctor || !hasFull) && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 space-y-1">
          <p className="text-xs font-semibold text-amber-300">⚠ Missing narrative sections</p>
          {!hasPatient && <p className="text-xs text-amber-200/70">• Patient summary was not generated</p>}
          {!hasDoctor && <p className="text-xs text-amber-200/70">• Doctor summary was not generated</p>}
          {!hasFull && <p className="text-xs text-amber-200/70">• Full narrative was not generated</p>}
        </div>
      )}
    </div>
  );
}
