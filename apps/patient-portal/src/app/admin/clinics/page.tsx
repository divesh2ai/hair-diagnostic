"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import QRCode from "react-qr-code";
import {
  Plus,
  Power,
  Archive,
  RotateCcw,
  QrCode,
  Copy,
  Check,
  X,
} from "lucide-react";
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
  locationCount: number;
  locationSetup: "NONE" | "INCOMPLETE" | "COMPLETE";
  // Phase 3 directory fields.
  primaryDoctorName: string | null;
  primaryDoctorProvisioned: boolean;
  accessReady: boolean;
  city: string | null;
  state: string | null;
  whatsappConfigured: boolean;
  lastAssessmentAt: string | null;
  assessmentPath: string;
  createdAt: string;
  updatedAt: string;
};

const PAGE_SIZE = 25;

/** Small labelled chip. Colour is never the only signal — the word is shown. */
function Chip({
  tone,
  children,
}: {
  tone: "ok" | "warn" | "muted";
  children: React.ReactNode;
}) {
  const cls =
    tone === "ok"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : tone === "warn"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-border bg-muted/40 text-muted-foreground";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${cls}`}
    >
      {children}
    </span>
  );
}

/** QR + copyable patient assessment link for one clinic. */
function AssessmentQrDialog({
  clinic,
  onClose,
}: {
  clinic: { name: string; assessmentPath: string };
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  // Absolute URL in the CURRENT environment (staging preview → staging host,
  // production → production host), so the QR a Super Admin scans matches where
  // they are working.
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}${clinic.assessmentPath}`
      : clinic.assessmentPath;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy the link");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Assessment link for ${clinic.name}`}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold">{clinic.name}</h3>
            <p className="text-xs text-muted-foreground">Patient assessment link</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="grid place-items-center rounded-xl border border-border bg-white p-4">
          <QRCode value={url} size={168} />
        </div>

        <div className="mt-3 flex items-center gap-2">
          <input
            readOnly
            value={url}
            aria-label="Assessment URL"
            className="h-9 w-full rounded-lg border border-border bg-background px-2.5 text-xs"
          />
          <Button variant="outline" size="sm" onClick={copy}>
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Open the patient landing page
        </a>
      </div>
    </div>
  );
}

export default function AdminClinicsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  // Seed the search from a ?search= param (the Overview directory preview routes
  // here with one). Lazy initializer, SSR-guarded — no effect, no cascading render.
  const [search, setSearch] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      return new URLSearchParams(window.location.search).get("search") ?? "";
    } catch {
      return "";
    }
  });
  const [status, setStatus] = useState<string>("");
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState<
    { id: string; name: string; action: "suspend" | "activate" | "archive" } | null
  >(null);
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState<{ name: string; assessmentPath: string } | null>(
    null,
  );

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
              <div className="truncate font-medium">{r.name}</div>
              <div className="truncate text-xs text-muted-foreground">
                {r.city || r.state
                  ? [r.city, r.state].filter(Boolean).join(", ")
                  : r.slug}
              </div>
            </div>
          </div>
        ),
      },
      {
        key: "status",
        header: "DB status",
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
        width: "110px",
      },
      {
        // Three distinct facts, never collapsed: access-ready (provisioning) and
        // operationally verified (always pending — no golden-path record source).
        key: "readiness",
        header: "Readiness",
        cell: (r) => (
          <div className="flex flex-col items-start gap-1">
            {r.accessReady ? (
              <Chip tone="ok">Access ready</Chip>
            ) : (
              <Chip tone="warn">Not provisioned</Chip>
            )}
            <Chip tone="warn">Verification pending</Chip>
          </div>
        ),
        width: "160px",
      },
      {
        key: "doctor",
        header: "Primary doctor",
        cell: (r) => (
          <div className="min-w-0">
            <div className="truncate text-sm">
              {r.primaryDoctorName ?? (
                <span className="text-muted-foreground">No doctor</span>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {r.primaryDoctorName
                ? r.primaryDoctorProvisioned
                  ? "login-ready"
                  : "not provisioned"
                : ""}
              {r.doctorCount > 1 ? ` · +${r.doctorCount - 1} more` : ""}
            </div>
          </div>
        ),
        width: "160px",
      },
      {
        key: "lastAssessment",
        header: "Last assessment",
        cell: (r) =>
          r.lastAssessmentAt ? (
            new Date(r.lastAssessmentAt).toLocaleDateString()
          ) : (
            <span className="text-xs text-muted-foreground">None yet</span>
          ),
        width: "130px",
      },
      {
        key: "delivery",
        header: "Delivery",
        cell: (r) => (
          <div className="flex flex-col items-start gap-1">
            {r.whatsappConfigured ? (
              <Chip tone="ok">WhatsApp configured</Chip>
            ) : (
              <Chip tone="muted">WhatsApp not set</Chip>
            )}
            {/* No reliable per-clinic report-delivery evidence source, so this
                is pending rather than inferred. */}
            <Chip tone="warn">Report pending</Chip>
          </div>
        ),
        width: "170px",
      },
      {
        key: "actions",
        header: "",
        align: "right",
        cell: (r) => (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setQr({ name: r.name, assessmentPath: r.assessmentPath })
              }
              aria-label={`Assessment QR for ${r.name}`}
            >
              <QrCode />
              QR
            </Button>
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
        width: "300px",
      },
    ],
    [],
  );

  return (
    <PageContainer className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clinics</h1>
          <p className="text-sm text-muted-foreground">
            {total.toLocaleString()} total · DB status, access readiness and
            operational verification are shown separately
          </p>
        </div>
        <Link href="/admin/clinics/new">
          <Button>
            <Plus />
            Create clinic
          </Button>
        </Link>
      </div>

      <FilterBar
        onClear={() => {
          setSearch("");
          setStatus("");
          setPage(1);
        }}
      >
        <SearchBox
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search by name or slug"
          className="min-w-[260px]"
        />
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="h-9 cursor-pointer rounded-lg border border-border bg-background px-3 text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-ring/40"
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

      {qr && <AssessmentQrDialog clinic={qr} onClose={() => setQr(null)} />}
    </PageContainer>
  );
}
