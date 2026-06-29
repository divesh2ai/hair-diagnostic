"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Power, RotateCcw } from "lucide-react";
import { PageContainer } from "@/components/app-shell";
import { DataTable, type Column } from "@/components/ui/data-table";
import { SearchBox } from "@/components/ui/search-box";
import { FilterBar } from "@/components/ui/filter-bar";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Avatar } from "@/components/ui/avatar";
import { toast } from "@/components/ui/toast";

type Row = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  qualification: string | null;
  registrationNumber: string | null;
  preferredLanguage: string;
  isActive: boolean;
  createdAt: string;
};

export default function ClinicDoctorsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    const r = await fetch(`/api/clinic/doctors?${params}`, { cache: "no-store" });
    const j = await r.json();
    setRows(j.rows ?? []);
    setLoading(false);
  }

  useEffect(() => {
    const t = setTimeout(load, search ? 250 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function toggleActive(id: string, next: boolean) {
    const r = await fetch(`/api/clinic/doctors/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isActive: next }),
    });
    if (!r.ok) {
      toast.error("Update failed");
      return;
    }
    toast.success(next ? "Doctor activated" : "Doctor deactivated");
    void load();
  }

  const columns = useMemo<Column<Row>[]>(
    () => [
      {
        key: "name",
        header: "Doctor",
        cell: (r) => (
          <div className="flex items-center gap-3">
            <Avatar name={r.name} src={r.avatarUrl} size="sm" />
            <div className="min-w-0">
              <div className="font-medium truncate">{r.name}</div>
              <div className="text-xs text-muted-foreground truncate">
                {r.qualification ?? "—"}
              </div>
            </div>
          </div>
        ),
      },
      {
        key: "contact",
        header: "Contact",
        cell: (r) => (
          <div className="text-xs">
            <div className="truncate">{r.email}</div>
            <div className="text-muted-foreground truncate">{r.phone ?? "—"}</div>
          </div>
        ),
      },
      {
        key: "lang",
        header: "Lang",
        cell: (r) => r.preferredLanguage,
        width: "80px",
      },
      {
        key: "status",
        header: "Status",
        cell: (r) => (
          <StatusBadge tone={r.isActive ? "success" : "neutral"}>
            {r.isActive ? "Active" : "Inactive"}
          </StatusBadge>
        ),
        width: "120px",
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
        width: "240px",
        cell: (r) => (
          <div className="flex items-center justify-end gap-1">
            <Link href={`/clinic/doctors/${r.id}/edit`}>
              <Button variant="ghost" size="sm">
                Edit
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void toggleActive(r.id, !r.isActive)}
            >
              {r.isActive ? <Power /> : <RotateCcw />}
              {r.isActive ? "Deactivate" : "Reactivate"}
            </Button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <PageContainer className="space-y-4">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Doctors</h1>
          <p className="text-sm text-muted-foreground">
            {rows.length.toLocaleString()} in your clinic
          </p>
        </div>
        <Link href="/clinic/doctors/new">
          <Button>
            <Plus />
            Add doctor
          </Button>
        </Link>
      </div>

      <FilterBar onClear={() => setSearch("")}>
        <SearchBox
          value={search}
          onChange={setSearch}
          placeholder="Search by name, email, phone"
          className="min-w-[260px]"
        />
      </FilterBar>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        loading={loading}
        emptyTitle="No doctors yet"
        emptyDescription="Add your first clinician to get started."
      />
    </PageContainer>
  );
}
