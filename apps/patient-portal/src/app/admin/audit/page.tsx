"use client";

import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { PageContainer } from "@/components/app-shell";
import { DataTable, type Column } from "@/components/ui/data-table";
import { SearchBox } from "@/components/ui/search-box";
import { FilterBar } from "@/components/ui/filter-bar";
import { Pagination } from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";

type Row = {
  id: string;
  createdAt: string;
  actorId: string | null;
  actorRole: string | null;
  actorType: string | null;
  action: string;
  entityType: string;
  entityId: string;
  clinic: { id: string; name: string; slug: string } | null;
};

const PAGE_SIZE = 50;

export default function AuditPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String((page - 1) * PAGE_SIZE),
    });
    if (search) params.set("search", search);
    if (action) params.set("action", action);
    const t = setTimeout(() => {
      fetch(`/api/admin/audit?${params}`, { cache: "no-store" })
        .then((r) => r.json())
        .then((j) => {
          setRows(j.rows ?? []);
          setTotal(j.total ?? 0);
        })
        .finally(() => setLoading(false));
    }, search ? 250 : 0);
    return () => clearTimeout(t);
  }, [search, action, page]);

  const columns = useMemo<Column<Row>[]>(
    () => [
      {
        key: "createdAt",
        header: "When",
        cell: (r) => new Date(r.createdAt).toLocaleString(),
        width: "180px",
      },
      {
        key: "actor",
        header: "Actor",
        cell: (r) => (
          <div className="min-w-0">
            <div className="truncate font-medium">
              {r.actorId ?? r.actorType ?? "system"}
            </div>
            {r.actorRole && (
              <div className="text-xs text-muted-foreground">{r.actorRole}</div>
            )}
          </div>
        ),
      },
      { key: "action", header: "Action", cell: (r) => r.action, width: "160px" },
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
        cell: (r) => r.clinic?.name ?? "—",
      },
    ],
    [],
  );

  function exportCsv() {
    const params = new URLSearchParams({ export: "csv" });
    if (search) params.set("search", search);
    if (action) params.set("action", action);
    window.location.href = `/api/admin/audit?${params}`;
  }

  return (
    <PageContainer className="space-y-4">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
          <p className="text-sm text-muted-foreground">
            {total.toLocaleString()} events
          </p>
        </div>
        <Button variant="outline" onClick={exportCsv}>
          <Download />
          Export CSV
        </Button>
      </div>

      <FilterBar onClear={() => { setSearch(""); setAction(""); setPage(1); }}>
        <SearchBox
          value={search}
          onChange={(v) => { setSearch(v); setPage(1); }}
          placeholder="Search actor, entity"
          className="min-w-[260px]"
        />
        <Input value={action} onChange={(v) => { setAction(v); setPage(1); }} placeholder="Action contains…" />
      </FilterBar>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        loading={loading}
        emptyTitle="No audit entries"
      />

      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        onChange={setPage}
      />
    </PageContainer>
  );
}

function Input({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-9 px-3 rounded-lg border border-border bg-background text-sm w-44 focus:outline-none focus:ring-2 focus:ring-ring/40 transition-all"
    />
  );
}
