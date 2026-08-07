"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Eye, FileCheck2, FolderKanban, RefreshCw, ShieldAlert } from "lucide-react";
import { PageContainer } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState, ErrorState } from "@/components/ui/states";

type RecordValue = Record<string, unknown> & { id?: string };
type GovernancePayload = {
  counts: Record<string, unknown> | null;
  metaBIdentity: Record<string, unknown> | null;
  conflictGroups: RecordValue[];
  quantityGaps: RecordValue[];
  claimQueue: RecordValue[];
  decisionsRequired: string[];
  remainingBlockersByKit: RecordValue[];
  safeForInternalRagTesting: RecordValue[];
  safeForPatientPublication: RecordValue[];
  mustRemainBlocked: RecordValue[];
};
type Payload = {
  facts: RecordValue[];
  claims: RecordValue[];
  conflicts: RecordValue[];
  aliases: RecordValue[];
  preview: Record<string, { claims: number; exactFacts: number }>;
  governance: GovernancePayload;
};
type Tab = "facts" | "claims" | "conflicts" | "aliases" | "conflictGroups" | "quantityGaps" | "claimQueue" | "governance";

const KITS = [
  ["", "All governed kits"],
  ["KIT_TE_GOLD", "Hair Fact TE GOLD"],
  ["KIT_GI_HEALTH_GOLD", "Pro Fact GI Health GOLD"],
  ["KIT_PRO_IMMUNE_GOLD", "Pro Immune GOLD"],
  ["KIT_INFLAMMATION_PHENOTYPE", "Inflammation Phenotype"],
  ["KIT_PRO_FACT_META_B", "PRO FACT META B"],
  ["KIT_PRO_FACT_META_B_PCOS", "PRO FACT META B PCOS"],
  ["KIT_PRO_FACT_META_B_THYROID", "PRO FACT META B THYROID"],
  ["KIT_PRO_FACT_META_B_MENOPAUSE", "PRO FACT META B MENOPAUSE"],
] as const;

const DB_TABS: Tab[] = ["facts", "claims", "conflicts", "aliases"];
const GOVERNANCE_TABS: Tab[] = ["conflictGroups", "quantityGaps", "claimQueue", "governance"];

const value = (record: RecordValue | Record<string, unknown> | null | undefined, key: string) => {
  const item = record?.[key];
  if (item === null || item === undefined || item === "") return "unknown";
  return typeof item === "object" ? JSON.stringify(item) : String(item);
};

const tabCount = (data: Payload | null, tab: Tab) => {
  if (!data) return 0;
  if (tab === "conflictGroups") return data.governance.conflictGroups.length;
  if (tab === "quantityGaps") return data.governance.quantityGaps.length;
  if (tab === "claimQueue") return data.governance.claimQueue.length;
  if (tab === "governance") return data.governance.counts ? 1 : 0;
  return data[tab].length;
};

export default function KnowledgeReviewPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [kit, setKit] = useState("");
  const [status, setStatus] = useState("");
  const [conflictsOnly, setConflictsOnly] = useState(false);
  const [formulaOnly, setFormulaOnly] = useState(false);
  const [tab, setTab] = useState<Tab>("governance");

  const load = useCallback(async () => {
    setError(null);
    const params = new URLSearchParams();
    if (kit) params.set("kit", kit);
    if (status) params.set("status", status);
    if (conflictsOnly) params.set("conflict", "true");
    if (formulaOnly) params.set("formulaError", "true");
    const response = await fetch(`/api/admin/knowledge-review?${params}`, { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "Could not load knowledge review queue");
    setData(body);
  }, [kit, status, conflictsOnly, formulaOnly]);

  useEffect(() => { load().catch((reason) => setError(String(reason))); }, [load]);

  const dbRows = useMemo(() => data?.[tab as keyof Payload] as RecordValue[] | undefined, [data, tab]);
  const action = async (record: RecordValue, actionName: string, newValue?: unknown) => {
    const entityType = tab === "facts" ? "STRUCTURED_FACT" : tab === "claims" ? "CLAIM" : tab === "conflicts" ? "CONFLICT" : "KIT_ALIAS";
    const entityId = tab === "claims" ? value(record, "claimId") : String(record.id ?? "");
    setBusy(`${entityId}:${actionName}`); setError(null);
    try {
      const response = await fetch("/api/admin/knowledge-review", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: actionName, entityType, entityId, newValue }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "Review action failed");
      await load();
    } catch (reason) { setError(String(reason)); } finally { setBusy(null); }
  };

  if (!data && !error) return <PageContainer><LoadingState /></PageContainer>;
  if (!data && error) return <PageContainer><ErrorState title="Could not load review queue" description={error} /></PageContainer>;

  return (
    <PageContainer className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-3xl">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground"><ShieldAlert className="size-4" aria-hidden="true" /> Governed Hair knowledge</div>
          <h1 className="text-2xl font-semibold tracking-tight">Five-kit knowledge review</h1>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">Inspect source provenance, reconcile draft-only blockers, and prepare governed HairOS content replacement without publishing patient content.</p>
        </div>
        <Button variant="outline" className="min-h-11" onClick={() => load()} disabled={Boolean(busy)}><RefreshCw className="size-4" aria-hidden="true" /> Refresh</Button>
      </header>

      {error && <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}

      <section aria-labelledby="retrieval-preview-title">
        <div className="mb-3 flex items-center gap-2"><Eye className="size-4" aria-hidden="true" /><h2 id="retrieval-preview-title" className="font-semibold">Retrieval preview</h2></div>
        <div className="grid gap-3 sm:grid-cols-3">
          {Object.entries(data!.preview).map(([audience, count]) => <Card key={audience}><CardHeader className="pb-2"><CardTitle className="text-sm capitalize">{audience.replace(/([A-Z])/g, " $1")}</CardTitle></CardHeader><CardContent><div className="text-2xl font-semibold tabular-nums">{count.claims}</div><p className="text-xs text-muted-foreground">visible claims / {count.exactFacts} exact facts</p></CardContent></Card>)}
        </div>
      </section>

      <GovernanceSummary governance={data!.governance} />

      <Card>
        <CardHeader><CardTitle className="text-base">Review filters</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <label className="space-y-1.5 text-sm"><span className="font-medium">Kit</span><select value={kit} onChange={(event) => setKit(event.target.value)} className="min-h-11 w-full rounded-md border bg-background px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{KITS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
          <label className="space-y-1.5 text-sm"><span className="font-medium">Review state</span><select value={status} onChange={(event) => setStatus(event.target.value)} className="min-h-11 w-full rounded-md border bg-background px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><option value="">All states</option>{["DRAFT", "PENDING_REVIEW", "CONFLICTED", "INCOMPLETE", "APPROVED", "PUBLISHED", "REJECTED", "RETIRED"].map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="flex min-h-11 items-center gap-3 self-end rounded-md border px-3 text-sm"><input type="checkbox" checked={conflictsOnly} onChange={(event) => setConflictsOnly(event.target.checked)} className="size-4" /><span>Conflicts only</span></label>
          <label className="flex min-h-11 items-center gap-3 self-end rounded-md border px-3 text-sm"><input type="checkbox" checked={formulaOnly} onChange={(event) => setFormulaOnly(event.target.checked)} className="size-4" /><span>Formula errors</span></label>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Review record type">
          {[...GOVERNANCE_TABS, ...DB_TABS].map((item) => <Button key={item} role="tab" aria-selected={tab === item} variant={tab === item ? "default" : "outline"} className="min-h-11 capitalize" onClick={() => setTab(item)}>{item === "claimQueue" ? "claim queue" : item === "quantityGaps" ? "quantity gaps" : item === "conflictGroups" ? "conflict groups" : item} <span className="tabular-nums opacity-75">{tabCount(data, item)}</span></Button>)}
        </div>
        <div className="space-y-3" role="tabpanel">
          {tab === "governance" && <GovernancePanel governance={data!.governance} />}
          {tab === "conflictGroups" && <GovernanceRows rows={data!.governance.conflictGroups} titleKey="entity" subtitleKey="recommendedDecision" badgeKey="status" blocked />}
          {tab === "quantityGaps" && <GovernanceRows rows={data!.governance.quantityGaps} titleKey="entityId" subtitleKey="reason" badgeKey="status" blocked />}
          {tab === "claimQueue" && <GovernanceRows rows={data!.governance.claimQueue} titleKey="claimId" subtitleKey="claimText" badgeKey="queueStatus" blocked />}
          {DB_TABS.includes(tab) && <>
            {(dbRows ?? []).length === 0 && <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No records match these filters.</CardContent></Card>}
            {(dbRows ?? []).map((record) => <ReviewRow key={String(record.id ?? value(record, "claimId"))} tab={tab} record={record} busy={busy} onAction={action} />)}
          </>}
        </div>
      </section>
    </PageContainer>
  );
}

function GovernanceSummary({ governance }: { governance: GovernancePayload }) {
  const counts = governance.counts as Record<string, unknown> | null;
  const raw = counts?.raw as Record<string, unknown> | undefined;
  return (
    <section aria-labelledby="governance-summary-title">
      <div className="mb-3 flex items-center gap-2"><FolderKanban className="size-4" aria-hidden="true" /><h2 id="governance-summary-title" className="font-semibold">Governance audit summary</h2></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="Blocked claims" value={String(raw?.blockedClaims ?? 0)} description="Awaiting authorized HairOS replacement" />
        <SummaryCard title="Conflict groups" value={String(counts?.groupedConflictCount ?? 0)} description="Consolidated draft-only blockers" />
        <SummaryCard title="Quantity gaps" value={String(counts?.publicationBlockingQuantityGaps ?? 0)} description="Still publication-blocking" />
        <SummaryCard title="Meta B" value={value(governance.metaBIdentity, "status")} description="Canonical base identity resolved" />
      </div>
    </section>
  );
}

function SummaryCard({ title, value: cardValue, description }: { title: string; value: string; description: string }) {
  return <Card><CardHeader className="pb-2"><CardTitle className="text-sm">{title}</CardTitle></CardHeader><CardContent><div className="text-2xl font-semibold tabular-nums">{cardValue}</div><p className="text-xs text-muted-foreground">{description}</p></CardContent></Card>;
}

function GovernancePanel({ governance }: { governance: GovernancePayload }) {
  return <div className="space-y-4">
    <Card>
      <CardHeader><CardTitle className="text-base">Meta B identity</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex flex-wrap items-center gap-2"><span className="font-medium">Official name</span><span>{value(governance.metaBIdentity, "officialName")}</span><span className="rounded-full border px-2 py-0.5 text-xs font-medium">{value(governance.metaBIdentity, "status")}</span></div>
        <p className="text-muted-foreground">Aliases: {value(governance.metaBIdentity, "aliases")}</p>
        <p className="text-muted-foreground">Variants: {value(governance.metaBIdentity, "variants")}</p>
      </CardContent>
    </Card>
    <Card>
      <CardHeader><CardTitle className="text-base">Exact human decisions required</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        {governance.decisionsRequired.length === 0 && <p>No pending governance decisions were loaded.</p>}
        {governance.decisionsRequired.map((item) => <p key={item}>- {item}</p>)}
      </CardContent>
    </Card>
    <Card>
      <CardHeader><CardTitle className="text-base">Remaining blockers by kit</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {governance.remainingBlockersByKit.map((item) => <div key={value(item, "kitId")} className="rounded-md border p-3 text-sm"><div className="flex flex-wrap items-center gap-2"><span className="font-medium">{value(item, "kitId")}</span><span className="rounded-full border px-2 py-0.5 text-xs font-medium">{value(item, "severity")}</span></div><p className="mt-2 text-muted-foreground">{Array.isArray(item.blockers) ? item.blockers.length : 0} blockers currently attached</p></div>)}
      </CardContent>
    </Card>
  </div>;
}

function GovernanceRows({ rows, titleKey, subtitleKey, badgeKey, blocked }: { rows: RecordValue[]; titleKey: string; subtitleKey: string; badgeKey: string; blocked?: boolean }) {
  if (rows.length === 0) return <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No governance records match these filters.</CardContent></Card>;
  return <div className="space-y-3">{rows.map((record, index) => <Card key={String(record.id ?? record.factId ?? record.claimId ?? `${titleKey}-${index}`)}><CardContent className="space-y-4 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-medium break-all">{value(record, titleKey)}</h3><span className="rounded-full border px-2 py-0.5 text-xs font-medium">{value(record, badgeKey)}</span>{blocked && <span className="flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive"><AlertTriangle className="size-3" aria-hidden="true" /> Must remain blocked</span>}</div><p className="mt-2 max-w-5xl break-words text-sm leading-6 text-muted-foreground">{value(record, subtitleKey)}</p></div></div><details className="rounded-md border p-3"><summary className="cursor-pointer text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Governance details</summary><dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-3">{Object.entries(record).map(([key, item]) => <div key={key} className="min-w-0"><dt className="font-medium text-muted-foreground">{key}</dt><dd className="mt-0.5 break-words font-mono">{typeof item === "object" ? JSON.stringify(item) : String(item ?? "unknown")}</dd></div>)}</dl></details></CardContent></Card>)}</div>;
}

function ReviewRow({ tab, record, busy, onAction }: { tab: Tab; record: RecordValue; busy: string | null; onAction: (record: RecordValue, action: string, newValue?: unknown) => Promise<void> }) {
  const id = tab === "claims" ? value(record, "claimId") : String(record.id ?? "");
  const title = tab === "facts" ? `${value(record, "entityId")} / ${value(record, "field")}` : tab === "claims" ? `${value(record, "subjectId")} / ${value(record, "claimType")}` : tab === "conflicts" ? `${value(record, "entity")} / ${value(record, "conflictType")}` : value(record, "alias");
  const summary = tab === "facts" ? value(record, "normalizedValue") : tab === "claims" ? value(record, "statement") : tab === "conflicts" ? value(record, "requiredAction") : `${value(record, "matchMethod")} / confidence ${value(record, "matchConfidence")}`;
  const status = value(record, tab === "facts" ? "approvalStatus" : tab === "claims" ? "medicalReviewStatus" : tab === "conflicts" ? "status" : "reviewStatus");
  const blocked = record.publicationBlocked === true || (tab === "facts" && value(record, "conflictStatus") !== "NONE");
  const actions = tab === "facts" ? ["APPROVE", "REJECT", "MARK_INCOMPLETE", "REQUEST_COMMERCIAL_REVIEW", "PUBLISH_APPROVED_ITEM"] : tab === "claims" ? ["APPROVE", "REJECT", "REQUEST_MEDICAL_REVIEW", "REQUEST_COMMERCIAL_REVIEW", "PUBLISH_APPROVED_ITEM"] : tab === "conflicts" ? ["SELECT_CANONICAL_VALUE", "MERGE_DUPLICATE"] : ["APPROVE_ALIAS", "REJECT_ALIAS"];
  return <Card>
    <CardContent className="space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-medium">{title}</h3><span className="rounded-full border px-2 py-0.5 text-xs font-medium">{status}</span>{blocked && <span className="flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive"><AlertTriangle className="size-3" aria-hidden="true" /> Publication blocked</span>}</div><p className="mt-2 max-w-5xl break-words text-sm leading-6 text-muted-foreground">{summary}</p></div></div>
      <details className="rounded-md border p-3"><summary className="cursor-pointer text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Source, evidence and raw provenance</summary><dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-3">{Object.entries(record).filter(([key]) => !["id", "createdAt", "updatedAt"].includes(key)).map(([key, item]) => <div key={key} className="min-w-0"><dt className="font-medium text-muted-foreground">{key}</dt><dd className="mt-0.5 break-words font-mono">{typeof item === "object" ? JSON.stringify(item) : String(item ?? "unknown")}</dd></div>)}</dl></details>
      <div className="flex flex-wrap gap-2">{actions.map((name) => <Button key={name} size="sm" variant={name.includes("REJECT") ? "destructive" : name === "APPROVE" || name === "APPROVE_ALIAS" ? "default" : "outline"} className="min-h-11" disabled={Boolean(busy)} onClick={() => onAction(record, name, name === "SELECT_CANONICAL_VALUE" ? record.proposedCanonicalValue ?? record.valueA : undefined)}>{busy === `${id}:${name}` ? <RefreshCw className="size-4 animate-spin" aria-hidden="true" /> : name.includes("APPROVE") ? <CheckCircle2 className="size-4" aria-hidden="true" /> : <FileCheck2 className="size-4" aria-hidden="true" />}{name.toLowerCase().replaceAll("_", " ")}</Button>)}</div>
    </CardContent>
  </Card>;
}