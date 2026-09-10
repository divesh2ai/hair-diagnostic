"use client";

import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { PageContainer } from "@/components/app-shell";
import { DataTable, type Column } from "@/components/ui/data-table";
import { SearchBox } from "@/components/ui/search-box";
import { FilterBar } from "@/components/ui/filter-bar";
import { Pagination } from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";
import { AUDIT_ACTION_GROUPS } from "@/lib/audit/actions";

type Row = {
  id: string;
  createdAt: string;
  actorId: string | null;
  actor: {
    name: string | null;
    email: string | null;
    currentRole: string | null;
    source: string;
  } | null;
  actorRole: string | null;
  actorType: string | null;
  action: string;
  entityType: string;
  entityId: string;
  clinic: { id: string; name: string | null; source: string } | null;
  clinicAttribution: string;
  metadata: unknown;
};

type ActionFacetEntry = { value: string; count: number; canonical: boolean };

type Payload = {
  rows: Row[];
  total: number;
  unknownAction?: boolean;
  requestedAction?: string;
  actionFacet?: ActionFacetEntry[];
};

const PAGE_SIZE = 50;

/** Human wording for how a clinic attribution was arrived at. */
const CLINIC_SOURCE_LABEL: Record<string, string> = {
  assessment_relation: "via assessment",
  entity_is_clinic: "clinic record",
  entity_lookup: "via linked record",
  metadata_clinic_id: "from event metadata",
  unattributed: "not captured",
};

export default function AuditPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unknownAction, setUnknownAction] = useState(false);
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  // Actions present in the log but absent from the canonical taxonomy. Sourced
  // from the server facet, never guessed — an event whose action predates the
  // canonical list must still be selectable.
  const [legacyActions, setLegacyActions] = useState<ActionFacetEntry[]>([]);

  const anyFilter = Boolean(search || action || from || to);

  useEffect(() => {
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String((page - 1) * PAGE_SIZE),
    });
    if (search) params.set("search", search);
    if (action) params.set("action", action);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    // setLoading lives inside the debounce callback, not the effect body: a
    // synchronous setState in an effect triggers a cascading render.
    const t = setTimeout(() => {
      setLoading(true);
      fetch(`/api/admin/audit?${params}`, { cache: "no-store" })
        .then((r) =>
          r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)),
        )
        .then((j: Payload) => {
          setRows(j.rows ?? []);
          setTotal(j.total ?? 0);
          setUnknownAction(Boolean(j.unknownAction));
          setLegacyActions((j.actionFacet ?? []).filter((f) => !f.canonical));
          setError(null);
        })
        .catch((e: Error) => setError(e.message))
        .finally(() => setLoading(false));
    }, search ? 250 : 0);
    return () => clearTimeout(t);
  }, [search, action, from, to, page]);

  const columns = useMemo<Column<Row>[]>(
    () => [
      {
        key: "createdAt",
        header: "When",
        cell: (r) => new Date(r.createdAt).toLocaleString(),
        width: "170px",
      },
      {
        key: "actor",
        header: "Actor",
        cell: (r) => {
          // A UUID is not an identity. Where the account still resolves, show
          // the person; where it does not, say so rather than dressing the id
          // up as a name.
          const known = r.actor && (r.actor.name || r.actor.email);
          return (
            <div className="min-w-0">
              {known ? (
                <>
                  <div className="truncate font-medium">
                    {r.actor?.name ?? r.actor?.email}
                  </div>
                  {r.actor?.name && r.actor?.email && (
                    <div className="truncate text-xs text-muted-foreground">
                      {r.actor.email}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-xs italic text-muted-foreground">
                  {r.actorId ? "Identity not available" : r.actorType ?? "system"}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
                {/* The role stored on the row is the historical claim; the
                    current role is a live lookup. Labelled separately because
                    they are different assertions. */}
                {r.actorRole && <span>{r.actorRole}</span>}
                {!r.actorRole && r.actor?.currentRole && (
                  <span>
                    {r.actor.currentRole}
                    <span className="text-muted-foreground/60"> (current)</span>
                  </span>
                )}
                {r.actorType && (
                  <span className="text-muted-foreground/60">
                    · {r.actorType}
                  </span>
                )}
              </div>
              {r.actorId && (
                <div className="truncate font-mono text-[10px] text-muted-foreground/60">
                  {r.actorId}
                </div>
              )}
            </div>
          );
        },
      },
      {
        key: "action",
        header: "Action",
        cell: (r) => <span className="text-sm">{r.action.replace(/_/g, " ")}</span>,
        width: "190px",
      },
      {
        key: "target",
        header: "Target",
        cell: (r) => (
          <span className="font-mono text-xs">
            {r.entityType}/{r.entityId.slice(0, 8)}…
          </span>
        ),
      },
      {
        key: "clinic",
        header: "Clinic",
        cell: (r) =>
          r.clinic ? (
            <div className="min-w-0">
              <div className="truncate text-sm">
                {r.clinic.name ?? r.clinic.id}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {CLINIC_SOURCE_LABEL[r.clinic.source] ?? r.clinic.source}
              </div>
            </div>
          ) : (
            // "No clinic" and "we never captured one" are different claims.
            <span className="text-xs text-muted-foreground">
              Unknown / not captured
            </span>
          ),
      },
      {
        key: "detail",
        header: "",
        width: "80px",
        cell: (r) => (
          <button
            onClick={() => setExpanded(expanded === r.id ? null : r.id)}
            className="text-xs text-primary underline-offset-2 hover:underline"
          >
            {expanded === r.id ? "Hide" : "Details"}
          </button>
        ),
      },
    ],
    [expanded],
  );

  function exportCsv() {
    setExportError(null);
    const params = new URLSearchParams({ export: "csv" });
    if (search) params.set("search", search);
    if (action) params.set("action", action);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    // Fetched rather than navigated so a refusal can be shown. The export
    // fails closed server-side when it cannot be recorded in the audit log,
    // and a plain link would have swallowed that error into a blank tab.
    fetch(`/api/admin/audit?${params}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error ?? `Export failed (HTTP ${res.status})`);
        }
        const truncated = res.headers.get("x-export-truncated") === "true";
        const rowCount = res.headers.get("x-export-row-count");
        const grandTotal = res.headers.get("x-export-total");
        if (truncated) {
          setExportError(
            `Exported the first ${rowCount} of ${grandTotal} matching rows. Narrow the filters to export the rest.`,
          );
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download =
          res.headers
            .get("content-disposition")
            ?.match(/filename="([^"]+)"/)?.[1] ?? "audit.csv";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      })
      .catch((e: Error) => setExportError(e.message));
  }

  if (error) {
    return (
      <PageContainer>
        <ErrorState title="Couldn't load the audit log" description={error} />
      </PageContainer>
    );
  }

  const expandedRow = rows.find((r) => r.id === expanded);

  return (
    <PageContainer className="space-y-4">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          {/* Matches the sidebar. The destination was renamed to Audit &
              Security and the page kept its old title, so the operator landed
              somewhere apparently different from the thing they clicked. */}
          <h1 className="text-2xl font-semibold tracking-tight">
            Audit &amp; Security
          </h1>
          <p className="text-sm text-muted-foreground">
            {total.toLocaleString()} recorded {total === 1 ? "event" : "events"}
          </p>
        </div>
        <Button variant="outline" onClick={exportCsv}>
          <Download />
          Export CSV
        </Button>
      </div>

      {exportError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {exportError}
        </div>
      )}

      <FilterBar
        onClear={() => {
          setSearch("");
          setAction("");
          setFrom("");
          setTo("");
          setPage(1);
        }}
      >
        <SearchBox
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search actor ID, entity type or entity ID"
          className="min-w-[280px]"
        />
        {/* Was a free-text box labelled "Action contains…" against an API that
            does exact matching, so a near-miss returned a confident, wrong
            "no entries". The list is the known action names. */}
        <select
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPage(1);
          }}
          className="h-9 rounded-lg border border-border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
        >
          <option value="">All actions</option>
          {Object.entries(AUDIT_ACTION_GROUPS).map(([group, actions]) => (
            <optgroup key={group} label={group}>
              {actions.map((a) => (
                <option key={a} value={a}>
                  {a.replace(/_/g, " ")}
                </option>
              ))}
            </optgroup>
          ))}
          {/* Actions that exist in the log but predate the canonical
              taxonomy. Listed separately and labelled rather than mixed in,
              so the reader can see they are a different vintage — but
              selectable, because the events are real. */}
          {legacyActions.length > 0 && (
            <optgroup label="Legacy · unclassified">
              {legacyActions.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.value} ({f.count})
                </option>
              ))}
            </optgroup>
          )}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          From
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
            className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          To
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
            className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
          />
        </label>
      </FilterBar>

      {expandedRow && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">
              {expandedRow.action.replace(/_/g, " ")} ·{" "}
              <span className="font-mono text-xs font-normal">
                {expandedRow.entityType}/{expandedRow.entityId}
              </span>
            </h2>
            <button
              onClick={() => setExpanded(null)}
              className="text-xs text-muted-foreground hover:underline"
            >
              Hide
            </button>
          </div>
          {/* Metadata was fetched on every row and rendered on none, so the one
              field that says WHAT changed was unreachable from the console. */}
          {expandedRow.metadata ? (
            <pre className="max-h-72 overflow-auto rounded-md border border-border bg-muted/30 px-3 py-2 text-[11px] leading-relaxed">
              {JSON.stringify(expandedRow.metadata, null, 2)}
            </pre>
          ) : (
            <p className="text-xs text-muted-foreground">
              No metadata recorded for this event.
            </p>
          )}
        </div>
      )}

      {/* Three different empty states, because they mean three different
          things and used to look identical. */}
      {unknownAction ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-6 text-center text-sm text-amber-900">
          <p className="font-medium">That is not a recorded action name.</p>
          <p className="mt-1">
            No events were searched for. Pick an action from the list rather
            than typing one — this is a filter mismatch, not an empty log.
          </p>
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          loading={loading}
          emptyTitle={
            anyFilter ? "No events match these filters" : "No audit entries"
          }
          emptyDescription={
            anyFilter
              ? "The filters are valid — nothing has been recorded that matches them. Clear them to see the full log."
              : "Nothing has been recorded yet."
          }
        />
      )}

      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={unknownAction ? 0 : total}
        onChange={setPage}
      />
    </PageContainer>
  );
}
