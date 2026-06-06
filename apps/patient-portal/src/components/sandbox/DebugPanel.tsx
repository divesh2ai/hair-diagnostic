'use client';

import { useState } from 'react';
import { useAssessmentStore } from '@/stores/useAssessmentStore';
import { explainSkipDecisions } from '@/runtime/skipEngine';
import { cn } from '@/lib/utils';

interface DebugPanelProps {
  enabled?: boolean;
}

export function DebugPanel({ enabled = false }: DebugPanelProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'step' | 'branching' | 'skipped' | 'signals' | 'answers' | 'exclusivity'>('step');

  const {
    protocol,
    currentStepIndex,
    progress,
    branchingPath,
    skippedQuestions,
    visibleQuestions,
    protocolSignals,
    answers,
    lastExclusivityEvent,
  } = useAssessmentStore();

  if (!enabled) return null;

  const currentQuestion = protocol?.[currentStepIndex];
  const skipDecisions = protocol ? explainSkipDecisions(protocol, answers) : [];

  return (
    <div className="fixed bottom-24 right-4 z-50 font-mono text-xs">
      <button
        onClick={() => setOpen(o => !o)}
        className="bg-slate-900 text-emerald-400 px-3 py-1.5 rounded-lg border border-emerald-500/30 hover:bg-slate-800 transition-colors shadow-xl"
      >
        {open ? '✕ Close Debug' : '⚡ Protocol Debug'}
      </button>

      {open && (
        <div className="mt-2 w-[380px] max-h-[60vh] overflow-hidden rounded-xl border border-white/10 bg-slate-900 shadow-2xl flex flex-col">
          <div className="flex border-b border-white/10 overflow-x-auto shrink-0">
            {(['step', 'branching', 'skipped', 'signals', 'answers', 'exclusivity'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'px-3 py-2 text-[10px] uppercase tracking-widest whitespace-nowrap transition-colors',
                  tab === t
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'text-white/40 hover:text-white/70'
                )}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="overflow-y-auto flex-1 p-3 space-y-2">
            {tab === 'step' && currentQuestion && (
              <div className="space-y-2">
                <Row label="ID" value={currentQuestion.id} highlight />
                <Row label="Type" value={currentQuestion.type} />
                <Row label="Section" value={currentQuestion.sectionTitle ?? currentQuestion.category} />
                <Row label="SectionID" value={currentQuestion.sectionId ?? '—'} />
                <Row label="Required" value={String(currentQuestion.required)} />
                <Row label="Raw Index" value={String(currentStepIndex)} />
                <Row label="Visible Pos" value={`${progress.visiblePosition} / ${progress.visibleTotal}`} />
                <Row label="Progress" value={`${progress.percentage}%`} highlight />
                <Row label="Answered" value={String(progress.answeredCount)} />
                {currentQuestion.sourceRef && (
                  <Row label="Source" value={currentQuestion.sourceRef} />
                )}
                {currentQuestion.mutualExclusivityGroups?.length && (
                  <div className="mt-2">
                    <p className="text-white/40 mb-1">Exclusivity Groups:</p>
                    {currentQuestion.mutualExclusivityGroups.map((g, i) => (
                      <div key={i} className="text-violet-300 pl-2 border-l border-violet-400/30 text-[10px]">
                        [{g.join(' ↔ ')}]
                      </div>
                    ))}
                  </div>
                )}
                {currentQuestion.skipIf && currentQuestion.skipIf.length > 0 && (
                  <div className="mt-2">
                    <p className="text-white/40 mb-1">Skip Conditions:</p>
                    {currentQuestion.skipIf.map((c, i) => (
                      <div key={i} className="text-amber-400 pl-2 border-l border-amber-400/30">
                        {c.field} {c.operator} {JSON.stringify(c.value)}
                      </div>
                    ))}
                  </div>
                )}
                {currentQuestion.filterOptions && currentQuestion.filterOptions.length > 0 && (
                  <div className="mt-2">
                    <p className="text-white/40 mb-1">Filter Options ({currentQuestion.filterOptions.length}):</p>
                    {currentQuestion.filterOptions.map((f, i) => (
                      <div key={i} className="text-sky-400 pl-2 border-l border-sky-400/30 text-[10px]">
                        hide &quot;{f.optionId.substring(0, 30)}&quot; if {f.hideIf.map(c => `${c.field} ${c.operator} ${c.value}`).join(', ')}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === 'branching' && (
              <div className="space-y-1">
                <p className="text-white/40 mb-2">Visible path ({branchingPath.length} steps):</p>
                {branchingPath.map((id, i) => (
                  <div
                    key={id}
                    className={cn(
                      'flex items-center gap-2 px-2 py-1 rounded',
                      id === currentQuestion?.id ? 'bg-emerald-500/20 text-emerald-300' : 'text-white/60'
                    )}
                  >
                    <span className="text-white/30 w-5 text-right">{i + 1}</span>
                    <span>{id}</span>
                    {id === currentQuestion?.id && (
                      <span className="ml-auto text-emerald-400">← current</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {tab === 'skipped' && (
              <div className="space-y-1">
                <p className="text-white/40 mb-2">Skip decisions ({skipDecisions.filter(d => d.skipped).length} skipped):</p>
                {skipDecisions.map(d => (
                  <div
                    key={d.questionId}
                    className={cn(
                      'px-2 py-1.5 rounded text-[10px]',
                      d.skipped ? 'bg-red-500/10 border border-red-500/20' : 'text-white/30'
                    )}
                  >
                    <span className={d.skipped ? 'text-red-400' : 'text-white/30'}>
                      {d.skipped ? '✕' : '✓'} {d.questionId}
                    </span>
                    {d.triggeredBy && (
                      <div className="text-red-300/60 mt-0.5 pl-4">← {d.triggeredBy}</div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {tab === 'signals' && (
              <div className="space-y-1">
                <p className="text-white/40 mb-2">Protocol signals ({Object.keys(protocolSignals).length}):</p>
                {Object.entries(protocolSignals).length === 0 ? (
                  <p className="text-white/20">No signals extracted yet.</p>
                ) : (
                  Object.entries(protocolSignals).map(([k, v]) => (
                    <Row key={k} label={k} value={JSON.stringify(v)} highlight />
                  ))
                )}
              </div>
            )}

            {tab === 'answers' && (
              <div className="space-y-1">
                <p className="text-white/40 mb-2">Raw answers ({Object.keys(answers).length}):</p>
                {Object.entries(answers).map(([k, v]) => (
                  <Row key={k} label={k} value={JSON.stringify(v)} />
                ))}
              </div>
            )}

            {tab === 'exclusivity' && (
              <div className="space-y-3">
                {/* Groups for current question */}
                <div>
                  <p className="text-white/40 mb-2">
                    Groups on &quot;{currentQuestion?.id ?? '—'}&quot;:
                  </p>
                  {currentQuestion?.mutualExclusivityGroups?.length ? (
                    currentQuestion.mutualExclusivityGroups.map((group, i) => {
                      const currentSel = Array.isArray(answers[currentQuestion.id])
                        ? (answers[currentQuestion.id] as string[])
                        : [];
                      return (
                        <div key={i} className="px-2 py-1.5 rounded border border-violet-400/20 bg-violet-500/5 mb-1.5">
                          <p className="text-violet-300 text-[10px] mb-1">Group {i + 1}</p>
                          {group.map(optId => {
                            const active = currentSel.includes(optId);
                            return (
                              <div key={optId} className="flex items-center gap-2 text-[10px]">
                                <span className={active ? 'text-emerald-400' : 'text-white/30'}>
                                  {active ? '✓' : '○'}
                                </span>
                                <span className={active ? 'text-emerald-300' : 'text-white/40'}>
                                  {optId}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-white/20 text-[10px]">No exclusivity groups on this question.</p>
                  )}
                </div>

                {/* Last deselection event */}
                <div>
                  <p className="text-white/40 mb-2">Last auto-deselection event:</p>
                  {lastExclusivityEvent ? (
                    <div className="px-2 py-2 rounded border border-amber-400/30 bg-amber-500/5 space-y-1">
                      <Row label="question" value={lastExclusivityEvent.questionId} highlight />
                      <Row label="selected" value={lastExclusivityEvent.selected} />
                      <div className="flex items-start gap-2">
                        <span className="text-white/30 shrink-0 w-28 truncate">deselected:</span>
                        <div className="flex flex-col gap-0.5">
                          {lastExclusivityEvent.deselected.map(d => (
                            <span key={d} className="text-amber-400">{d}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-white/20 text-[10px]">No exclusivity event fired yet.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-white/30 shrink-0 w-28 truncate">{label}:</span>
      <span className={highlight ? 'text-emerald-400' : 'text-white/70'}>{value}</span>
    </div>
  );
}
