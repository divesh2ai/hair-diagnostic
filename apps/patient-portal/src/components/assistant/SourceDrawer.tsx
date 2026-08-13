"use client";

import { BookOpen, ChevronDown, ExternalLink } from "lucide-react";

export type AssistantSource = { sourceId: string; label: string; field?: string; version?: number; effectiveFrom?: string | null; approvalStatus?: string; url?: string; knowledgeSystem?: string; authorityScore?: number };

const sourceKey = (source: AssistantSource) => `${source.sourceId}:${source.field ?? ""}`;
const uniqueSources = (sources: AssistantSource[]) => sources.filter((source, index, all) => all.findIndex((candidate) => sourceKey(candidate) === sourceKey(source)) === index);

export function SourceDrawer({ sources, messageId }: { sources: AssistantSource[]; messageId: string }) {
  const unique = uniqueSources(sources);
  if (!unique.length) return null;
  return <details id={`sources-${messageId}`} className="group mt-3 rounded-2xl border border-slate-200 bg-white px-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
    <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 [&::-webkit-details-marker]:hidden">
      <span className="flex items-center gap-2"><BookOpen className="size-4" aria-hidden="true" />Source <span className="font-normal text-slate-500">{unique.length}</span></span><ChevronDown className="size-4 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
    </summary>
    <ol className="space-y-2 border-t border-slate-100 py-3">{unique.map((source, index) => <li key={sourceKey(source)} className="rounded-xl bg-slate-50 p-3 text-sm leading-5 text-slate-700"><div className="flex items-start gap-2"><span className="font-semibold text-slate-500">{index + 1}</span><div className="min-w-0 flex-1">{source.url?.startsWith("http") ? <a href={source.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-emerald-800 underline decoration-emerald-300 underline-offset-2">{source.label}<ExternalLink className="size-3.5" aria-hidden="true" /></a> : <span className="font-semibold text-slate-900">{source.label}</span>}{source.field ? <span className="mt-1 block text-xs text-slate-600">Field: {source.field}</span> : null}{source.approvalStatus ? <span className="mt-1 block text-xs text-slate-600">{source.approvalStatus.replaceAll("_", " ")}{source.version ? ` · v${source.version}` : ""}</span> : null}</div></div></li>)}</ol>
  </details>;
}
