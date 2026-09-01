"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { PageContainer } from "@/components/app-shell";
import { DataTable, type Column } from "@/components/ui/data-table";
import { SearchBox } from "@/components/ui/search-box";
import { FilterBar } from "@/components/ui/filter-bar";
import { Pagination } from "@/components/ui/pagination";
import { ErrorState } from "@/components/ui/states";

// Clinical Governance — every decision taken about patient-visible clinical
// content.
//
// This reads KnowledgeReviewAction, the table the knowledge review workflow
// has always written to and which the audit console has never read. Approving
// a claim, rejecting it, publishing it to patients, rolling a document version
// back: all of it lived in a table with no reader. Nothing about how those
// rows are written changes here — this is the missing reader.

type Row = {
  id: string;
  createdAt: string;
  action: string;
  entityType: string;
  entityId: string;
  reason: string | null;
  actorId: string;
  actor: {
    name: string | null;
    email: string | null;
    currentRole: string | null;
    source: string;
  } | null;
  hasBefore: boolean;
  hasAfter: boolean;
  changedKeys: string[];
};

type Detail = Row & { previousValue: unknown; newValue: unknown };

type Payload = {
  rows: Row[];
  total: number;
  limit: number;
  offset: number;
  facets: {
    actions: { value: string; count: number }[];
    entityTypes: { value: string; count: number }[];
  };
};

const PAGE_SIZE = 50;

/** Actions that make content visible to patients, or take it away again. */
const PATIENT_FACING = new Set([
  "PUBLISH_APPROVED_ITEM",
  "ROLLBACK_PUBLICATION",
  "RETIRE_PREVIOUS_VERSION",
  "REJECT",
]);

function ActorCell({ row }: { row: Row }) {
  if (!row.actor || (!row.actor.name && !row.actor.email)) {
    return (
      <div className="min-w-0">
        {/* Never invent an identity for an account that no longer resolves. */}
        <div className="text-xs italic text-muted-foreground">
          Identity not available
        </div>
        <div className="truncate font-mono text-[10px] text-muted-foreground/70">
          {row.actorId}
        </div>
      </div>
    );
  }
  return (
    <div className="min-w-0">
      <div className="truncate font-medium">
        {row.actor.name ?? row.actor.email}
      </div>
      {row.actor.name && row.actor.email && (
        <div className="truncate text-xs text-muted-foreground">
          {row.actor.email}
        </div>
      )}
      {row.actor.currentRole && (
        <div className="text-[11px] text-muted-foreground">
          {row.actor.currentRole}{" "}
          <span className="text-muted-foreground/60">(current)</span>
        </div>
      )}
    </div>
  );
}

export default function ClinicalGovernancePage() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String((page - 1) * PAGE_SIZE),
    });
    if (q) params.set("q", q);
    if (action) params.set("action", action);
    if (entityType) params.set("entityType", entityType);
    fetch(`/api/admin/clinical-governance?${params}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j) => {
        setData(j);
        setError(null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [q, action, entityType, page]);

  useEffect(() => {
    const t = setTimeout(load, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  useEffect(() => {
    // No synchronous setState here — stale detail is handled at render time by
    // comparing detail.id with openId, which avoids a cascading render.
    if (!openId) return;
    fetch(`/api/admin/clinical-governance?id=${encodeURIComponent(openId)}`, {
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j) => setDetail(j.row))
      .catch(() => setDetail(null));
  }, [openId]);

  const columns = useMemo<Column<Row>[]>(
    () => [
      {
        key: "when",
        header: "When",
        width: "170px",
        cell: (r) => new Date(r.createdAt).toLocaleString(),
      },
      {
        key: "action",
        header: "Decision",
        width: "210px",
        cell: (r) => (
          <div className="space-y-1">
            <div
              className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${
                PATIENT_FACING.has(r.action)
                  ? "border-amber-200 bg-amber-50 text-amber-900"
                  : "border-border bg-muted/40 text-foreground"
              }`}
            >
              {r.action.replace(/_/g, " ")}
            </div>
            {PATIENT_FACING.has(r.action) && (
              <div className="text-[10px] uppercase tracking-wide text-amber-700">
                Patient-facing
              </div>
            )}
          </div>
        ),
      },
      { key: "actor", header: "Actor", cell: (r) => <ActorCell row={r} /> },
      {
        key: "entity",
        header: "Content item",
        cell: (r) => (
          <div className="min-w-0">
            <div className="text-sm">{r.entityType.replace(/_/g, " ")}</div>
            <div className="truncate font-mono text-[11px] text-muted-foreground">
              {r.entityId}
            </div>
          </div>
        ),
      },
      {
        key: "changed",
        header: "Changed",
        cell: (r) =>
          r.changedKeys.length > 0 ? (
            <span className="font-mono text-[11px]">
              {r.changedKeys.slice(0, 3).join(", ")}
              {r.changedKeys.length > 3 && ` +${r.changedKeys.length - 3}`}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">
              {r.hasBefore || r.hasAfter ? "—" : "Not recorded"}
            </span>
          ),
      },
      {
        key: "reason",
        header: "Rationale",
        cell: (r) =>
          r.reason ? (
            <span className="text-sm">{r.reason}</span>
          ) : (
            <span className="text-xs text-muted-foreground">None given</span>
          ),
      },
    ],
    [],
  );

  if (error) {
    return (
      <PageContainer>
        <ErrorState title="Couldn't load clinical governance" description={error} />
      </PageContainer>
    );
  }

  // Empty because the log is genuinely empty — not because a filter excluded
  // everything. The distinction matters: one is a fact about the platform, the
  // other is a fact about the controls, and they must not look the same.
  const isEmpty =
    !loading && !!data && data.total === 0 && !q && !action && !entityType;

  return (
    <PageContainer className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Clinical Governance
        </h1>
        <p className="text-sm text-muted-foreground">
          {/* When the log is empty the count is stated as a count of RECORDS,
              never as a verdict. "0 decisions" and "nothing is wrong" are
              different claims and only the first one is evidenced here. */}
          {!data
            ? "Loading…"
            : data.total === 0
              ? "A record of every decision taken on patient-visible clinical content."
              : `${data.total.toLocaleString()} decisions on patient-visible clinical content — approvals, rejections, publications and rollbacks.`}
        </p>
      </div>

      {/* The genuine zero state. Filters and an empty table over nothing are
          noise: there is no facet to pick from and no row to exclude. */}
      {isEmpty ? (
        <GovernanceZeroState />
      ) : (
      <>
      <FilterBar
        onClear={() => {
          setQ("");
          setAction("");
          setEntityType("");
          setPage(1);
        }}
      >
        <SearchBox
          value={q}
          onChange={(v) => {
            setQ(v);
            setPage(1);
          }}
          placeholder="Search item ID, rationale or actor"
          className="min-w-[280px]"
        />
        {/* Both selects are built from facets the data actually contains, so a
            filter can never be set to a value that matches nothing. */}
        <select
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPage(1);
          }}
          className="h-9 rounded-lg border border-border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
        >
          <option value="">All decisions</option>
          {data?.facets.actions.map((f) => (
            <option key={f.value} value={f.value}>
              {f.value.replace(/_/g, " ")} ({f.count})
            </option>
          ))}
        </select>
        <select
          value={entityType}
          onChange={(e) => {
            setEntityType(e.target.value);
            setPage(1);
          }}
          className="h-9 rounded-lg border border-border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
        >
          <option value="">All content types</option>
          {data?.facets.entityTypes.map((f) => (
            <option key={f.value} value={f.value}>
              {f.value.replace(/_/g, " ")} ({f.count})
            </option>
          ))}
        </select>
      </FilterBar>

      <DataTable
        columns={columns}
        rows={data?.rows ?? []}
        rowKey={(r) => r.id}
        loading={loading}
        onRowClick={(r) => setOpenId(r.id)}
        emptyTitle="No clinical governance decisions"
        emptyDescription={
          action || entityType || q
            ? "No decisions match these filters."
            : "Knowledge review has not recorded any decisions yet."
        }
      />

      {data && (
        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          total={data.total}
          onChange={setPage}
        />
      )}
      </>
      )}

      {openId && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-6"
          onClick={() => setOpenId(null)}
        >
          <div
            className="w-full max-w-3xl rounded-lg border border-border bg-card p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">
                  {detail?.action.replace(/_/g, " ") ?? "Loading…"}
                </h2>
                {detail && (
                  <p className="text-sm text-muted-foreground">
                    {new Date(detail.createdAt).toLocaleString()} ·{" "}
                    {detail.entityType.replace(/_/g, " ")}
                  </p>
                )}
              </div>
              <button
                onClick={() => setOpenId(null)}
                className="rounded-md border border-border px-2 py-1 text-sm"
              >
                Close
              </button>
            </div>

            {detail && detail.id === openId ? (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 text-sm">
                  <Field label="Content item">
                    <span className="font-mono text-xs">{detail.entityId}</span>
                  </Field>
                  <Field label="Rationale">
                    {detail.reason ?? (
                      <span className="text-muted-foreground">None given</span>
                    )}
                  </Field>
                </div>

                {detail.changedKeys.length > 0 && (
                  <Field label="Fields changed">
                    <span className="font-mono text-xs">
                      {detail.changedKeys.join(", ")}
                    </span>
                  </Field>
                )}

                <div className="grid gap-3 lg:grid-cols-2">
                  <Snapshot title="Before" value={detail.previousValue} />
                  <Snapshot title="After" value={detail.newValue} />
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Loading decision…</p>
            )}
          </div>
        </div>
      )}
    </PageContainer>
  );
}

/**
 * The zero state.
 *
 * ── What it must not do ─────────────────────────────────────────────────────
 * Nothing was seeded to make this page look populated, and nothing here says
 * or implies that clinical content has been checked and found sound. An empty
 * governance log means one thing only: no reviewer has recorded a decision
 * yet. "No records" and "no risks" are different claims, and this page is
 * evidence for exactly the first.
 *
 * ── What it does ────────────────────────────────────────────────────────────
 * Explains the surface, states plainly why it is empty, names the decisions
 * that will land here — every one of them an action the knowledge review
 * workflow actually writes (see api/admin/knowledge-review) — and points at
 * the queue where the work itself happens. No "Create review" button: there is
 * no such workflow, and inventing one to avoid a blank page would be worse
 * than the blank page.
 */
function GovernanceZeroState() {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex flex-col gap-4 px-6 py-7 sm:flex-row sm:gap-5">
        <div
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40 text-muted-foreground"
        >
          <ClipboardList className="size-4" />
        </div>
        <div className="min-w-0 space-y-4">
          <div className="space-y-1.5">
            <h2 className="text-base font-semibold tracking-tight">
              No governance decisions recorded yet
            </h2>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Clinical Governance is the permanent record of decisions taken on
              clinical content before it reaches a patient — what was approved,
              what was rejected, who decided, and why. Nothing is listed because
              no reviewer has recorded a decision yet.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              What will appear here
            </h3>
            <ul className="max-w-2xl space-y-1.5 text-sm text-muted-foreground">
              <li>
                <span className="text-foreground">Approvals and rejections</span>{" "}
                — clinical claims and structured facts cleared for use, or turned
                down.
              </li>
              <li>
                <span className="text-foreground">Publications and rollbacks</span>{" "}
                — content made visible to patients, or withdrawn again.
              </li>
              <li>
                <span className="text-foreground">Conflict resolutions</span> —
                which value was made canonical when two sources disagreed.
              </li>
              <li>
                <span className="text-foreground">Version retirements</span> —
                document versions superseded or rolled back.
              </li>
            </ul>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Each entry keeps the before and after state and the rationale
              given at the time.
            </p>
          </div>

          {/* The one claim this page is entitled to make, stated so it cannot
              be mistaken for an all-clear. */}
          <p className="max-w-2xl rounded-md border border-border bg-muted/30 px-3.5 py-2.5 text-sm text-muted-foreground">
            An empty log is a record of decisions not yet taken. It is not a
            clinical audit, and it is not evidence that content has been
            reviewed or found safe.
          </p>

          {/* Not a manufactured CTA — this route is the live review workflow,
              and every decision made there is what fills this page. */}
          <Link
            href="/admin/knowledge-review"
            className="inline-flex items-center rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            Open knowledge review queue
          </Link>
        </div>
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
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}

function Snapshot({ title, value }: { title: string; value: unknown }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      {value === null || value === undefined ? (
        <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Not recorded
        </p>
      ) : (
        <pre className="max-h-72 overflow-auto rounded-md border border-border bg-muted/30 px-3 py-2 text-[11px] leading-relaxed">
          {JSON.stringify(value, null, 2)}
        </pre>
      )}
    </div>
  );
}
