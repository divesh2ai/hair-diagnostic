"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Power, Archive, RotateCcw } from "lucide-react";
import { PageContainer } from "@/components/app-shell";
import { DataTable, type Column } from "@/components/ui/data-table";
import { SearchBox } from "@/components/ui/search-box";
import { FilterBar } from "@/components/ui/filter-bar";
import { Pagination } from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Avatar } from "@/components/ui/avatar";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";

type Row = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  status: "ACTIVE" | "SUSPENDED" | "ARCHIVED";
  doctorCount: number;
  patientCount: number;
  createdAt: string;
  updatedAt: string;
};

const PAGE_SIZE = 25;

export default function AdminClinicsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("");
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState<
    { id: string; name: string; action: "suspend" | "activate" | "archive" } | null
  >(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String((page - 1) * PAGE_SIZE),
    });
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    const r = await fetch(`/api/admin/clinics?${params}`, { cache: "no-store" });
    const j = await r.json();
    setRows(j.rows ?? []);
    setTotal(j.total ?? 0);
    setLoading(false);
  }

  // Reload when filters/page change. Debounce search to a single trailing call.
  useEffect(() => {
    const handle = setTimeout(load, search ? 250 : 0);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status, page]);

  async function applyAction(
    id: string,
    action: "suspend" | "activate" | "archive",
  ) {
    setBusy(true);
    const r = await fetch(`/api/admin/clinics/${id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setBusy(false);
    setConfirm(null);
    if (!r.ok) {
      toast.error("Action failed");
      return;
    }
    toast.success(`Clinic ${action}d`);
    void load();
  }

  const columns = useMemo<Column<Row>[]>(
    () => [
      {
        key: "name",
        header: "Clinic",
        cell: (r) => (
          <div className="flex items-center gap-3">
            {r.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={r.logoUrl}
                alt=""
                className="size-9 rounded-md object-cover"
              />
            ) : (
              <Avatar name={r.name} size="sm" />
            )}
            <div className="min-w-0">
              <div className="font-medium truncate">{r.name}</div>
              <div className="text-xs text-muted-foreground truncate">{r.slug}</div>
            </div>
          </div>
        ),
      },
      {
        key: "status",
        header: "Status",
        cell: (r) => (
          <StatusBadge
            tone={
              r.status === "ACTIVE"
                ? "success"
                : r.status === "SUSPENDED"
                  ? "warning"
                  : "neutral"
            }
          >
            {r.status}
          </StatusBadge>
        ),
        width: "120px",
      },
      {
        key: "doctors",
        header: "Doctors",
        cell: (r) => r.doctorCount,
        align: "right",
        width: "100px",
      },
      {
        key: "patients",
        header: "Patients",
        cell: (r) => r.patientCount,
        align: "right",
        width: "100px",
      },
      {
        key: "created",
        header: "Created",
        cell: (r) => new Date(r.createdAt).toLocaleDateString(),
        width: "120px",
      },
      {
        key: "actions",
        header: "",
        align: "right",
        cell: (r) => (
          <div className="flex items-center justify-end gap-1">
            <Link href={`/admin/clinics/${r.id}/edit`}>
              <Button variant="ghost" size="sm">
                Edit
              </Button>
            </Link>
            {r.status === "ACTIVE" ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setConfirm({ id: r.id, name: r.name, action: "suspend" })
                }
              >
                <Power />
                Suspend
              </Button>
            ) : r.status === "SUSPENDED" ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setConfirm({ id: r.id, name: r.name, action: "activate" })
                }
              >
                <RotateCcw />
                Activate
              </Button>
            ) : null}
            {r.status !== "ARCHIVED" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setConfirm({ id: r.id, name: r.name, action: "archive" })
                }
              >
                <Archive />
                Archive
              </Button>
            )}
          </div>
        ),
        width: "260px",
      },
    ],
    [],
  );

  return (
    <PageContainer className="space-y-4">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clinics</h1>
          <p className="text-sm text-muted-foreground">
            {total.toLocaleString()} total
          </p>
        </div>
        <Link href="/admin/clinics/new">
          <Button>
            <Plus />
            Create clinic
          </Button>
        </Link>
      </div>

      <FilterBar onClear={() => { setSearch(""); setStatus(""); setPage(1); }}>
        <SearchBox
          value={search}
          onChange={(v) => { setSearch(v); setPage(1); }}
          placeholder="Search by name or slug"
          className="min-w-[260px]"
        />
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="h-9 px-3 rounded-lg border border-border bg-background text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring/40 transition-all cursor-pointer"
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="ARCHIVED">Archived</option>
        </select>
      </FilterBar>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        loading={loading}
        emptyTitle="No clinics yet"
        emptyDescription="Create the first one to get started."
      />

      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        onChange={setPage}
      />

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(v) => !v && setConfirm(null)}
        loading={busy}
        title={
          confirm
            ? `${confirm.action[0].toUpperCase()}${confirm.action.slice(1)} ${confirm.name}?`
            : ""
        }
        description={
          confirm?.action === "archive"
            ? "Archiving soft-deletes the clinic. Data stays in the database; access is blocked."
            : confirm?.action === "suspend"
              ? "Suspended clinics can't log in but their data remains."
              : "Re-enable access for staff and patients."
        }
        tone={confirm?.action === "archive" ? "danger" : "default"}
        confirmLabel={confirm ? confirm.action : "Confirm"}
        onConfirm={() =>
          confirm ? applyAction(confirm.id, confirm.action) : Promise.resolve()
        }
      />
    </PageContainer>
  );
}
