"use client";

import { Activity, BookOpen, ChevronDown, FlaskConical, GitCompareArrows, Layers3, ListTree, PackageSearch, Stethoscope } from "lucide-react";
import type { ResponseCard } from "@hairos/packages/assistant-core";

type CardProps<T extends ResponseCard["type"]> = { card: Extract<ResponseCard, { type: T }>; messageId: string; expanded?: boolean };

const listClass = "mt-3 space-y-2 text-[15px] leading-6 text-slate-700";
const shellClass = "rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-5";

function BulletList({ items }: { items: string[] }) {
  return <ul className={listClass}>{items.slice(0, 5).map((item, index) => <li key={`${item}-${index}`} className="flex gap-3"><span className="mt-[0.65rem] size-1.5 shrink-0 rounded-full bg-emerald-600" aria-hidden="true" /><span>{item}</span></li>)}</ul>;
}

function CardHeading({ icon: Icon, title }: { icon: typeof Activity; title: string }) {
  return <div className="flex items-center gap-2.5"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-800"><Icon className="size-[18px]" aria-hidden="true" /></span><h3 className="text-[15px] font-semibold text-slate-950">{title}</h3></div>;
}

function ExpandableDetails({ id, items, label, expanded }: { id: string; items?: string[]; label: string; expanded?: boolean }) {
  if (!items?.length) return null;
  return <details id={id} open={expanded} className="group mt-4 border-t border-slate-100 pt-2">
    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-lg text-sm font-semibold text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 [&::-webkit-details-marker]:hidden">
      {label}<ChevronDown className="size-4 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
    </summary>
    <BulletList items={items} />
  </details>;
}

export function DirectAnswerCard({ card }: CardProps<"DirectAnswerCard">) {
  return <section className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 sm:p-5" aria-label="Direct answer">
    <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-800">Direct answer</p>
    <p className="text-[17px] font-semibold leading-7 text-slate-950 sm:text-lg">{card.answer}</p>
  </section>;
}

export function KitSummaryCard({ card, messageId, expanded }: CardProps<"KitSummaryCard">) {
  return <section className={shellClass}><CardHeading icon={PackageSearch} title={card.title} /><BulletList items={card.items} /><ExpandableDetails id={`detail-${messageId}`} items={card.detailItems} label="More detail" expanded={expanded} />{card.interpretation ? <p className="mt-4 border-t border-slate-100 pt-4 text-sm leading-6 text-slate-700"><span className="font-semibold text-slate-950">Clinical relevance: </span>{card.interpretation}</p> : null}</section>;
}

export function IngredientListCard({ card, messageId, expanded }: CardProps<"IngredientListCard">) {
  return <section className={shellClass}><CardHeading icon={FlaskConical} title={card.title} />{card.totalItems ? <p className="mt-3 text-sm text-slate-600">Showing key records · {card.totalItems} verified in the formulation</p> : null}<BulletList items={card.items} />{card.primaryAction ? <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-700"><span className="font-semibold text-slate-950">Primary action: </span>{card.primaryAction}</p> : null}<ExpandableDetails id={`formulation-${messageId}`} items={card.detailItems} label={`Full formulation${card.detailItems?.length ? ` (${card.detailItems.length + card.items.length})` : ""}`} expanded={expanded} /></section>;
}

export function MechanismCard({ card, messageId, expanded }: CardProps<"MechanismCard">) {
  return <section className={shellClass}><CardHeading icon={ListTree} title={card.title} /><BulletList items={card.items} /><ExpandableDetails id={`detail-${messageId}`} items={card.detailItems} label="Complete rationale" expanded={expanded} /></section>;
}

export function ClinicalRelevanceCard({ card }: CardProps<"ClinicalRelevanceCard">) {
  return <section className={shellClass}><CardHeading icon={Stethoscope} title={card.title} /><p className="mt-3 text-[15px] leading-6 text-slate-700">{card.interpretation}</p></section>;
}

export function KitVariantCard({ card, messageId, expanded }: CardProps<"KitVariantCard">) {
  return <section className={shellClass}><CardHeading icon={Layers3} title={card.title} /><BulletList items={card.items} /><ExpandableDetails id={`detail-${messageId}`} items={card.detailItems} label="Show all variants" expanded={expanded} /></section>;
}

export function ComparisonCard({ card, messageId, expanded }: CardProps<"ComparisonCard">) {
  const groups = [{ label: "Shared", items: card.shared }, { label: "First only", items: card.leftOnly }, { label: "Second only", items: card.rightOnly }].filter((group) => group.items.length);
  return <section className={`${shellClass} sm:col-span-2`}><CardHeading icon={GitCompareArrows} title={card.title} /><div className="mt-4 grid gap-3 sm:grid-cols-3">{groups.map((group) => <div key={group.label} className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold uppercase tracking-wide text-slate-600">{group.label}</p><BulletList items={group.items} /></div>)}</div><ExpandableDetails id={`detail-${messageId}`} items={card.detailItems} label="Complete comparison" expanded={expanded} /></section>;
}

export function LifestyleImpactCard({ card, messageId, expanded }: CardProps<"LifestyleImpactCard">) {
  return <section className={shellClass}><CardHeading icon={Activity} title={card.title} /><BulletList items={card.items} /><ExpandableDetails id={`detail-${messageId}`} items={card.detailItems} label="Explain impact" expanded={expanded} />{card.interpretation ? <p className="mt-4 border-t border-slate-100 pt-4 text-sm leading-6 text-slate-700"><span className="font-semibold text-slate-950">Clinical relevance: </span>{card.interpretation}</p> : null}</section>;
}

export function ConditionSummaryCard({ card, messageId, expanded }: CardProps<"ConditionSummaryCard">) {
  return <section className={shellClass}><CardHeading icon={Stethoscope} title={card.title} /><BulletList items={card.items} /><ExpandableDetails id={`detail-${messageId}`} items={card.detailItems} label="More detail" expanded={expanded} />{card.interpretation ? <p className="mt-4 border-t border-slate-100 pt-4 text-sm leading-6 text-slate-700"><span className="font-semibold text-slate-950">Clinical relevance: </span>{card.interpretation}</p> : null}</section>;
}

export function EvidenceCard({ card }: CardProps<"EvidenceCard">) {
  return <section className={shellClass}><CardHeading icon={BookOpen} title={card.title} /><p className="mt-3 text-[15px] leading-6 text-slate-700">{card.summary}</p>{card.strength ? <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Evidence: {card.strength}</p> : null}</section>;
}

export function AssistantResponseCards({ cards, messageId, depth }: { cards: ResponseCard[]; messageId: string; depth?: "QUICK" | "EXPLAIN" | "DEEP_DIVE" }) {
  const visibleCards = cards.filter((card) => card.type !== "SourceDrawer");
  const expanded = depth === "DEEP_DIVE";
  return <div className="grid gap-3 md:grid-cols-2">{visibleCards.map((card, index) => {
    const key = `${card.type}-${index}`;
    if (card.type === "DirectAnswerCard") return <div key={key} className="md:col-span-2"><DirectAnswerCard card={card} messageId={messageId} /></div>;
    if (card.type === "KitSummaryCard") return <KitSummaryCard key={key} card={card} messageId={messageId} expanded={expanded} />;
    if (card.type === "IngredientListCard") return <IngredientListCard key={key} card={card} messageId={messageId} expanded={expanded} />;
    if (card.type === "MechanismCard") return <MechanismCard key={key} card={card} messageId={messageId} expanded={expanded} />;
    if (card.type === "ClinicalRelevanceCard") return <ClinicalRelevanceCard key={key} card={card} messageId={messageId} />;
    if (card.type === "KitVariantCard") return <KitVariantCard key={key} card={card} messageId={messageId} expanded={expanded} />;
    if (card.type === "ComparisonCard") return <ComparisonCard key={key} card={card} messageId={messageId} expanded={expanded} />;
    if (card.type === "LifestyleImpactCard") return <LifestyleImpactCard key={key} card={card} messageId={messageId} expanded={expanded} />;
    if (card.type === "ConditionSummaryCard") return <ConditionSummaryCard key={key} card={card} messageId={messageId} expanded={expanded} />;
    if (card.type === "EvidenceCard") return <EvidenceCard key={key} card={card} messageId={messageId} />;
    return null;
  })}</div>;
}
