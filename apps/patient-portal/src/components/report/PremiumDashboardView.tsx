"use client";

import { useState } from "react";
import type {
  ClinicalReport,
  TreatmentPhase,
  TopicalRecommendation,
  UniversalRecoveryMilestone,
} from "@hairos/packages/ai-engine/report-engine/types";
import { composeNarrativeV3 } from "@hairos/packages/ai-engine/report-engine/v3";
import { getRecommendationAsset } from "@/lib/assets/recommendation-assets";

// ────────────────────────────────────────────────────────────────────────────
// Premium Clinical Intelligence Dossier
//
// Strict rule: every visible element traces back to ClinicalReport data.
// No invented scores, no fake percentages, no gamification.
// Each section answers one of four questions:
//   1. What is happening to my hair?       → Identity + Snapshot
//   2. Why is it happening?                → Root Cause Intelligence
//   3. What is making it worse?            → What's Hurting + Helps/Hurts
//   4. What is being done to fix it?       → Blueprint + Stack + Timeline + Verdict
// ────────────────────────────────────────────────────────────────────────────

function isClinicalReport(v: unknown): v is ClinicalReport {
  return !!v && typeof v === "object" && "patientSummary" in (v as object);
}

// ── Derivation helpers (categorical only — never numeric scores) ──────────

/** Recovery potential label derived from impact distribution of primary drivers. */
function deriveRecoveryPotential(report: ClinicalReport): "High" | "Moderate" | "Guarded" {
  const rca = report.rootCauseAnalysis ?? { primary: [], secondary: [], amplifiers: [] };
  const primaries = rca.primary ?? [];
  const amplifiers = rca.amplifiers ?? [];
  if (primaries.length === 0) return "High";
  const highImpactPrimary = primaries.filter((c) => c.impact === "High").length;
  const highAmplifiers = amplifiers.filter((c) => c.impact === "High").length;
  if (highImpactPrimary >= 2 && highAmplifiers >= 2) return "Guarded";
  if (highImpactPrimary >= 2 || highAmplifiers >= 2) return "Moderate";
  return "High";
}

function deriveAssessmentDate(report: ClinicalReport): string {
  try {
    const d = new Date(report.generatedAt);
    return d.toLocaleDateString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

// ── Visual primitives ─────────────────────────────────────────────────────

function GlassCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_8px_30px_-8px_rgba(0,0,0,0.6)] backdrop-blur-xl ${className}`}
    >
      {children}
    </div>
  );
}

function Eyebrow({
  children,
  tone = "teal",
}: {
  children: React.ReactNode;
  tone?: "teal" | "gold" | "copper" | "emerald" | "rose";
}) {
  const colors: Record<string, string> = {
    teal: "text-teal-300",
    gold: "text-amber-300",
    copper: "text-orange-300",
    emerald: "text-emerald-300",
    rose: "text-rose-300",
  };
  return (
    <p
      className={`text-[10px] font-semibold uppercase tracking-[0.22em] ${colors[tone]}`}
    >
      {children}
    </p>
  );
}

function SectionHeader({
  eyebrow,
  title,
  subtitle,
  tone = "teal",
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  tone?: "teal" | "gold" | "copper" | "emerald" | "rose";
}) {
  return (
    <div className="mb-5">
      <Eyebrow tone={tone}>{eyebrow}</Eyebrow>
      <h3 className="mt-2 font-serif text-2xl font-semibold tracking-tight text-white">
        {title}
      </h3>
      {subtitle && (
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-white/60">
          {subtitle}
        </p>
      )}
    </div>
  );
}

// ── §1 — Patient Identity Card ────────────────────────────────────────────

function PatientIdentityCard({ report }: { report: ClinicalReport }) {
  const p = report.patientSummary;
  const pattern = p.hairLossPattern ?? [];
  const goal = p.goal ?? [];
  const recoveryPotential = deriveRecoveryPotential(report);
  const date = deriveAssessmentDate(report);

  const recoveryTone =
    recoveryPotential === "High"
      ? "text-emerald-300 bg-emerald-500/10 ring-emerald-400/30"
      : recoveryPotential === "Moderate"
      ? "text-amber-300 bg-amber-500/10 ring-amber-400/30"
      : "text-rose-300 bg-rose-500/10 ring-rose-400/30";

  return (
    <GlassCard className="h-full">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/40 to-transparent" />
      <Eyebrow tone="gold">Patient dossier</Eyebrow>
      <h2 className="mt-2 font-serif text-3xl font-semibold tracking-tight text-white">
        {p.name}
      </h2>
      <p className="mt-1 text-sm text-white/50">
        {p.age} yrs · {p.gender} · Assessed {date}
      </p>

      <dl className="mt-5 space-y-3 text-sm">
        {p.hairLossDuration && (
          <Row k="Duration" v={p.hairLossDuration} />
        )}
        {pattern.length > 0 && (
          <Row k="Pattern" v={pattern.join(" · ")} />
        )}
        {goal.length > 0 && <Row k="Stated goal" v={goal.join(", ")} />}
      </dl>

      <div className="mt-5 border-t border-white/5 pt-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
          Recovery potential
        </p>
        <div
          className={`mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ring-1 ${recoveryTone}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {recoveryPotential}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-white/50">
          Derived from the impact mix across detected primary drivers and
          amplifiers in your dossier.
        </p>
      </div>
    </GlassCard>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
        {k}
      </dt>
      <dd className="text-right text-sm font-medium text-white/85">{v}</dd>
    </div>
  );
}

// ── §2 — Clinical Snapshot ─────────────────────────────────────────────────

function ClinicalSnapshot({ report }: { report: ClinicalReport }) {
  const p = report.patientSummary;
  const rca = report.rootCauseAnalysis ?? { primary: [], secondary: [], amplifiers: [] };
  const primary = rca.primary?.[0]?.condition ?? null;
  const secondary = (rca.secondary ?? []).slice(0, 3).map((c) => c.condition);
  const amplifiers = (rca.amplifiers ?? []).slice(0, 3).map((c) => c.condition);
  const sel = p.questionnaireSelections ?? {};
  const pattern = p.hairLossPattern ?? [];
  const goal = p.goal ?? [];

  const tiles: Array<{ label: string; value: string | null; tone?: string }> = [
    { label: "Severity grade", value: sel.grade ?? null },
    { label: "Pattern", value: pattern[0] ?? sel.hairType?.[0] ?? null },
    { label: "Duration", value: sel.duration ?? p.hairLossDuration ?? null },
    { label: "Shedding intensity", value: sel.count ?? null },
    { label: "Primary driver", value: primary, tone: "amber" },
    {
      label: "Secondary drivers",
      value: secondary.length > 0 ? secondary.join(" · ") : null,
      tone: "teal",
    },
    {
      label: "Amplifiers",
      value: amplifiers.length > 0 ? amplifiers.join(" · ") : null,
      tone: "rose",
    },
    {
      label: "Stated goal",
      value: goal.length > 0 ? goal.join(", ") : null,
    },
  ].filter((t) => !!t.value);

  return (
    <GlassCard>
      <Eyebrow tone="teal">Clinical snapshot</Eyebrow>
      <p className="mt-2 text-sm text-white/60">
        What HairOS observed in your responses — the dossier headline.
      </p>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <div
            key={t.label}
            className="rounded-xl border border-white/5 bg-white/[0.03] p-3.5"
          >
            <p
              className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${
                t.tone === "amber"
                  ? "text-amber-300"
                  : t.tone === "teal"
                  ? "text-teal-300"
                  : t.tone === "rose"
                  ? "text-rose-300"
                  : "text-white/40"
              }`}
            >
              {t.label}
            </p>
            <p className="mt-1.5 text-sm font-medium leading-snug text-white/90">
              {t.value}
            </p>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

// ── §3 — What is hurting your hair ────────────────────────────────────────

function WhatIsHurting({ report }: { report: ClinicalReport }) {
  const p = report.patientSummary;
  const rca = report.rootCauseAnalysis ?? { primary: [], secondary: [], amplifiers: [] };
  const items: Array<{ label: string; why: string; tone: string }> = [];

  for (const a of rca.amplifiers ?? []) {
    items.push({
      label: a.condition,
      why: a.clinicalRelevance,
      tone: "rose",
    });
  }
  for (const s of p.scalpConcerns ?? []) {
    items.push({
      label: s,
      why: "Scalp condition affecting follicular environment.",
      tone: "copper",
    });
  }
  for (const l of p.lifestyleFactors ?? []) {
    items.push({
      label: l,
      why: "Lifestyle factor that erodes recovery capacity over time.",
      tone: "amber",
    });
  }
  for (const m of p.medicalFactors ?? []) {
    items.push({
      label: m,
      why: "Medical factor influencing the systemic drivers of hair loss.",
      tone: "rose",
    });
  }

  // dedupe by label
  const seen = new Set<string>();
  const unique = items.filter((it) => {
    const k = it.label.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  if (unique.length === 0) return null;

  return (
    <section>
      <SectionHeader
        eyebrow="What is making it worse"
        title="What is hurting your hair"
        subtitle="The active stressors detected in your responses — these are the levers your protocol is designed to neutralise."
        tone="rose"
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {unique.slice(0, 12).map((it, i) => (
          <div
            key={`${it.label}-${i}`}
            className="rounded-xl border border-white/10 bg-gradient-to-br from-rose-500/5 via-white/[0.02] to-transparent p-4"
          >
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-semibold text-white">{it.label}</p>
              <span
                className={`text-[10px] font-semibold uppercase tracking-wider ${
                  it.tone === "rose"
                    ? "text-rose-300"
                    : it.tone === "copper"
                    ? "text-orange-300"
                    : "text-amber-300"
                }`}
              >
                Hurts
              </span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-white/60">
              {it.why}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── §5 — Personalized Recovery Blueprint ──────────────────────────────────

function RecoveryBlueprint({
  report,
  kitNames,
}: {
  report: ClinicalReport;
  kitNames: string[];
}) {
  const kits = report.treatmentStrategy ?? [];
  if (kits.length === 0) return null;

  return (
    <section>
      <SectionHeader
        eyebrow="Your personalised plan"
        title="Recovery blueprint"
        subtitle="Each kit was selected against a specific cluster of drivers from your dossier — never as a generic prescription."
        tone="emerald"
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {kits.map((kit, i) => (
          <KitCard key={kit.kitId} kit={kit} displayName={kitNames[i] ?? kit.displayName} />
        ))}
      </div>
    </section>
  );
}

function KitCard({ kit, displayName }: { kit: TreatmentPhase; displayName: string }) {
  return (
    <GlassCard className="h-full">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/50 to-transparent" />
      <div className="flex items-baseline justify-between gap-3">
        <h4 className="font-serif text-lg font-semibold tracking-tight text-white">
          {displayName}
        </h4>
        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300 ring-1 ring-emerald-400/30">
          Phase {kit.phase}
        </span>
      </div>

      {kit.whySelected && (
        <div className="mt-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-300">
            Selected because
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-white/80">
            {kit.whySelected}
          </p>
        </div>
      )}

      {(kit.supportingConditions ?? []).length > 0 && (
        <div className="mt-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
            Addresses
          </p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {kit.supportingConditions.map((c) => (
              <li
                key={c}
                className="rounded-md border border-emerald-300/20 bg-emerald-500/5 px-2 py-0.5 text-[11px] text-emerald-100"
              >
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(kit.keyIngredients ?? []).length > 0 && (
        <div className="mt-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
            Key actives
          </p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {(kit.keyIngredients ?? []).slice(0, 6).map((ing) => (
              <li
                key={ing}
                className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] text-white/75"
              >
                {ing}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(kit.mechanismOfAction ?? []).length > 0 && (
        <div className="mt-4 border-t border-white/5 pt-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
            Mechanism
          </p>
          <ul className="mt-2 space-y-1.5">
            {(kit.mechanismOfAction ?? []).slice(0, 4).map((m, i) => (
              <li
                key={i}
                className="flex gap-2 text-xs leading-relaxed text-white/70"
              >
                <span className="mt-[0.5rem] h-1 w-1 shrink-0 rounded-full bg-emerald-400" />
                <span>{m}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </GlassCard>
  );
}

// ── §6 — Complete Protocol Stack ──────────────────────────────────────────

function ProtocolStack({
  report,
  kitNames,
}: {
  report: ClinicalReport;
  kitNames: string[];
}) {
  const oral = report.treatmentStrategy ?? [];
  const topical = report.topicalRecommendations ?? [];
  const cautions = report.topicalCautions ?? [];
  if (oral.length === 0 && topical.length === 0) return null;

  return (
    <section>
      <SectionHeader
        eyebrow="The protocol"
        title="Complete protocol stack"
        subtitle="Inside-out and outside-in — every layer mapped to a target detected in your dossier."
        tone="teal"
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {oral.length > 0 && (
          <GlassCard>
            <div className="flex items-baseline justify-between">
              <Eyebrow tone="emerald">Oral therapy</Eyebrow>
              <span className="text-[10px] uppercase tracking-wider text-white/40">
                Inside-out
              </span>
            </div>
            <ul className="mt-4 space-y-3">
              {oral.map((kit, i) => (
                <li
                  key={kit.kitId}
                  className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="font-serif text-sm font-semibold text-white">
                      {kitNames[i] ?? kit.displayName}
                    </p>
                    <span className="text-[10px] uppercase tracking-wider text-emerald-300">
                      Phase {kit.phase}
                    </span>
                  </div>
                  {(kit.supportingConditions ?? []).length > 0 && (
                    <p className="mt-1 text-xs text-white/55">
                      Target: {(kit.supportingConditions ?? []).slice(0, 3).join(" · ")}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </GlassCard>
        )}

        {topical.length > 0 && (
          <GlassCard>
            <div className="flex items-baseline justify-between">
              <Eyebrow tone="teal">Topical therapy</Eyebrow>
              <span className="text-[10px] uppercase tracking-wider text-white/40">
                Outside-in
              </span>
            </div>
            <ul className="mt-4 space-y-3">
              {topical.map((t) => (
                <TopicalRow key={t.name} t={t} />
              ))}
            </ul>
          </GlassCard>
        )}
      </div>

      {cautions.length > 0 && (
        <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-500/[0.04] p-5">
          <Eyebrow tone="gold">Cautions</Eyebrow>
          <ul className="mt-3 space-y-2">
            {cautions.map((c, i) => (
              <li
                key={`${c.name}-${i}`}
                className="flex gap-3 text-sm text-white/80"
              >
                <span className="mt-[0.5rem] h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300" />
                <span>
                  <span className="font-semibold text-white">{c.name}</span>
                  <span className="text-white/60"> — {c.reason}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function TopicalRow({ t }: { t: TopicalRecommendation }) {
  return (
    <li className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <p className="font-serif text-sm font-semibold text-white">{t.name}</p>
      <p className="mt-1 text-xs leading-relaxed text-white/70">
        {t.whySelected}
      </p>
      <div className="mt-2 grid gap-1.5 text-[11px] text-white/55 sm:grid-cols-2">
        <p>
          <span className="font-semibold text-white/70">Use: </span>
          {t.usage}
        </p>
        <p className="italic">{t.note}</p>
      </div>
    </li>
  );
}

// ── §7 — Recovery Milestone Timeline ──────────────────────────────────────

function RecoveryTimeline({ report }: { report: ClinicalReport }) {
  const milestones = report.recoveryMilestones;
  if (!milestones || milestones.length === 0) return null;

  return (
    <section>
      <SectionHeader
        eyebrow="The road ahead"
        title="Recovery milestone timeline"
        subtitle="Biological landmarks you can expect as the protocol takes hold — not promises, but the clinically realistic pattern."
        tone="emerald"
      />
      <ol className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {milestones.map((m, i) => (
          <MilestoneCard key={`${m.window}-${i}`} m={m} index={i} />
        ))}
      </ol>
    </section>
  );
}

function MilestoneCard({
  m,
  index,
}: {
  m: UniversalRecoveryMilestone;
  index: number;
}) {
  return (
    <li className="relative">
      <GlassCard className="h-full">
        <div className="flex items-baseline justify-between">
          <p className="font-serif text-lg font-semibold tracking-tight text-emerald-200">
            {m.window}
          </p>
          <span className="font-mono text-[10px] uppercase tracking-wider text-white/30">
            {String(index + 1).padStart(2, "0")}
          </span>
        </div>
        <ul className="mt-3 space-y-2">
          {m.bullets.map((b, i) => (
            <li key={i} className="flex gap-2 text-xs leading-relaxed text-white/75">
              <span className="mt-[0.55rem] h-1 w-1 shrink-0 rounded-full bg-emerald-400" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </GlassCard>
    </li>
  );
}

// ── §8 — Helps vs Hurts ───────────────────────────────────────────────────

// Image-or-emoji tile. Lookup is centralised in
// /lib/assets/recommendation-assets.ts so Phase-2 local-asset migration
// requires no changes here.
function Tile({
  label,
  tone,
  fallbackEmoji,
}: {
  label: string;
  tone: "helps" | "hurts";
  fallbackEmoji: string;
}) {
  const asset = getRecommendationAsset(label);
  const [broken, setBroken] = useState(false);
  const ring =
    tone === "helps"
      ? "border-emerald-300/20 from-emerald-500/10 to-emerald-500/0"
      : "border-rose-300/20 from-rose-500/10 to-rose-500/0";
  const useImage = !!asset.src && !broken;
  const emoji = asset.emoji ?? fallbackEmoji;

  return (
    <div
      className={`flex flex-col items-center justify-center overflow-hidden rounded-2xl border bg-gradient-to-br p-2 text-center ${ring}`}
    >
      {/* Emoji is rendered as the base layer; image overlays it when it
          loads. If the image errors / 404s, onError unmounts the <img> and
          the emoji underneath is what the user sees — never a broken icon. */}
      <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-black/30">
        <span className="text-3xl leading-none" aria-hidden>
          {emoji}
        </span>
        {useImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={asset.src}
            alt={label}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setBroken(true)}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
      </div>
      <p className="mt-2 line-clamp-2 px-1 text-[11px] font-medium leading-snug text-white/85">
        {label}
      </p>
    </div>
  );
}

function HelpsVsHurts({ report }: { report: ClinicalReport }) {
  const g = report.generalLifestyleGuide ?? {
    foodsToAdd: [],
    foodsToAvoid: [],
    lifestyleRecommendations: [],
  };
  const rca = report.rootCauseAnalysis ?? { primary: [], secondary: [], amplifiers: [] };

  const dedupe = (xs: string[]) => {
    const seen = new Set<string>();
    return xs.filter((x) => {
      const k = x.toLowerCase().trim();
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  };

  const helpsList = dedupe([
    ...(g.foodsToAdd ?? []),
    ...(g.lifestyleRecommendations ?? []),
  ]).slice(0, 12);

  const hurtsList = dedupe([
    ...(g.foodsToAvoid ?? []),
    ...(report.patientSummary.lifestyleFactors ?? []),
    ...((rca.amplifiers ?? []).map((a) => a.condition)),
  ]).slice(0, 12);

  if (helpsList.length === 0 && hurtsList.length === 0) return null;

  return (
    <section>
      <SectionHeader eyebrow="Daily levers" title="What helps vs what hurts" tone="teal" />
      <div className="grid gap-4 md:grid-cols-2">
        <GlassCard>
          <div className="flex items-baseline justify-between">
            <Eyebrow tone="emerald">What helps</Eyebrow>
            <span className="text-[10px] uppercase tracking-wider text-white/40">
              Lean in
            </span>
          </div>
          {helpsList.length > 0 ? (
            <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {helpsList.map((h, i) => (
                <Tile key={i} label={h} tone="helps" fallbackEmoji="✅" />
              ))}
            </div>
          ) : (
            <p className="mt-4 text-xs text-white/50">No items detected.</p>
          )}
        </GlassCard>
        <GlassCard>
          <div className="flex items-baseline justify-between">
            <Eyebrow tone="rose">What hurts</Eyebrow>
            <span className="text-[10px] uppercase tracking-wider text-white/40">
              Pull back
            </span>
          </div>
          {hurtsList.length > 0 ? (
            <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {hurtsList.map((h, i) => (
                <Tile key={i} label={h} tone="hurts" fallbackEmoji="⚠️" />
              ))}
            </div>
          ) : (
            <p className="mt-4 text-xs text-white/50">No items detected.</p>
          )}
        </GlassCard>
      </div>
    </section>
  );
}

// ── §9 — Clinical Verdict ─────────────────────────────────────────────────

// Public demo MP4 — surfaced only when the URL contains ?demoVideo=1 so
// you can prove the player works before the avatar pipeline starts writing
// real videoUrls. Never shown to real patients.
const DEMO_VIDEO_URL =
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";

function ClinicalVerdict({ report }: { report: ClinicalReport }) {
  const story = report.clinicalInsightStory;
  const assessment = report.finalClinicalAssessment;
  const [scriptOpen, setScriptOpen] = useState(false);

  // Look for a video URL on common locations — engine doesn't expose one
  // in the type yet, but the avatar pipeline writes here in production.
  const r = report as unknown as {
    finalClinicalAssessment?: { videoUrl?: string; posterUrl?: string };
    videoUrl?: string;
    posterUrl?: string;
  };
  const realVideoUrl = r.finalClinicalAssessment?.videoUrl ?? r.videoUrl ?? null;
  const posterUrl = r.finalClinicalAssessment?.posterUrl ?? r.posterUrl ?? null;

  const demoRequested =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("demoVideo") === "1";
  const videoUrl = realVideoUrl ?? (demoRequested ? DEMO_VIDEO_URL : null);

  if (!story?.yourHairStory && !assessment?.fullNarration && !videoUrl) return null;

  return (
    <section>
      <SectionHeader
        eyebrow="HairOS clinical verdict"
        title="A personal word from your doctor"
        subtitle="A short, personalised narration walking you through what we found and the plan we built for you."
        tone="gold"
      />

      <div className="relative overflow-hidden rounded-3xl border border-amber-300/15 bg-gradient-to-br from-amber-500/[0.06] via-white/[0.02] to-emerald-500/[0.04] p-4 sm:p-6">
        <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="absolute -left-16 -bottom-20 h-48 w-48 rounded-full bg-emerald-400/10 blur-3xl" />

        {/* 16:9 video frame */}
        <div className="relative">
          <div
            className="relative aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black"
            style={{
              backgroundImage: posterUrl
                ? `url(${posterUrl})`
                : "radial-gradient(ellipse at center, rgba(245,158,11,0.20), transparent 60%), linear-gradient(135deg, #0b1220 0%, #1a1304 60%, #0b1220 100%)",
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            {videoUrl ? (
              <video
                src={videoUrl}
                poster={posterUrl ?? undefined}
                controls
                playsInline
                preload="metadata"
                className="absolute inset-0 h-full w-full"
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/[0.06] ring-1 ring-white/20 backdrop-blur">
                  <svg viewBox="0 0 24 24" className="h-7 w-7 fill-current text-amber-200/70">
                    <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm-1 14V8l5 4z" />
                  </svg>
                </div>
                <p className="text-xs uppercase tracking-[0.22em] text-amber-200/80">
                  {assessment?.videoTitle ?? "Personalised narration"}
                </p>
                <p className="max-w-md px-6 text-center text-[11px] leading-relaxed text-white/55">
                  Your doctor-avatar video has not been generated yet.
                  It will appear here automatically once the narration
                  pipeline writes it to{" "}
                  <code className="text-amber-200/70">
                    finalClinicalAssessment.videoUrl
                  </code>
                  . Append <code className="text-amber-200/70">&amp;demoVideo=1</code> to the URL to
                  preview the player with a sample video.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Optional script disclosure */}
        {(assessment?.fullNarration || story?.yourHairStory) && (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setScriptOpen((v) => !v)}
              className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-300 hover:text-amber-200"
            >
              {scriptOpen ? "Hide" : "Show"} narration script
              <span aria-hidden>{scriptOpen ? "▴" : "▾"}</span>
            </button>
            {scriptOpen && (
              <div className="mt-3 max-h-72 overflow-y-auto rounded-2xl border border-white/5 bg-white/[0.02] p-4 text-sm leading-[1.7] text-white/75">
                {assessment?.fullNarration ? (
                  <p className="whitespace-pre-line font-serif">
                    {assessment.fullNarration}
                  </p>
                ) : story?.yourHairStory ? (
                  <p className="font-serif">{story.yourHairStory}</p>
                ) : null}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

// ── Top level ─────────────────────────────────────────────────────────────

export function PremiumDashboardView({ report }: { report: unknown }) {
  if (!isClinicalReport(report)) return null;

  // V3 narrative gives prettified, patient-facing kit names — much better
  // than the raw kitId fallback that lives on treatmentStrategy.displayName.
  let kitNames: string[] = [];
  try {
    const narrative = composeNarrativeV3(report);
    kitNames = narrative.recommendedKits.kits.map((k) => k.name);
  } catch {
    kitNames = (report.treatmentStrategy ?? []).map((k) => k.displayName);
  }

  return (
    <div className="relative isolate -mx-4 overflow-hidden rounded-3xl sm:-mx-6 lg:-mx-8">
      {/* Background */}
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse at top, rgba(20,184,166,0.10), transparent 60%), radial-gradient(ellipse at bottom right, rgba(245,158,11,0.08), transparent 55%), radial-gradient(circle at 20% 10%, rgba(255,255,255,0.04), transparent 40%), linear-gradient(180deg, #070b14 0%, #0a0f1c 60%, #070b14 100%)",
        }}
      />

      <div className="space-y-10 p-6 sm:p-8 lg:p-10">
        {/* Top banner */}
        <header className="relative">
          <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <Eyebrow tone="gold">DrFACT · clinical intelligence</Eyebrow>
              <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Personalised hair recovery dossier
              </h1>
            </div>
            <p className="max-w-sm text-xs leading-relaxed text-white/45">
              Every element below is derived from your questionnaire responses
              and HairOS clinical interpretation — never generic, never invented.
            </p>
          </div>
        </header>

        {/* Identity + snapshot row */}
        <section className="grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <PatientIdentityCard report={report} />
          </div>
          <div className="lg:col-span-2">
            <ClinicalSnapshot report={report} />
          </div>
        </section>

        <WhatIsHurting report={report} />
        <RecoveryBlueprint report={report} kitNames={kitNames} />
        <ProtocolStack report={report} kitNames={kitNames} />
        <RecoveryTimeline report={report} />
        <HelpsVsHurts report={report} />
        <ClinicalVerdict report={report} />

        <footer className="rounded-2xl border border-white/5 bg-white/[0.02] px-6 py-5 text-center">
          <p className="text-xs leading-relaxed text-white/45">
            This dossier was generated from the information you provided.
            Discuss any changes to your routine, supplements or medications
            with your treating doctor before starting.
          </p>
        </footer>
      </div>
    </div>
  );
}
