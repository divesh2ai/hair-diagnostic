"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Stethoscope, ShieldCheck, PhoneOff, MapPinned, ToggleLeft, ToggleRight } from "lucide-react";
import { MetricCard } from "@/components/ui/metric-card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { SearchBox } from "@/components/ui/search-box";
import { FilterBar } from "@/components/ui/filter-bar";
import { ErrorState } from "@/components/ui/states";

// Clinicians — every Doctor row, including the ones with no login yet.
//
// The accounts table above is keyed on the Supabase auth account, so a doctor
// provisioned ahead of their invitation is invisible there by construction.
// This table is keyed on the Doctor row, which is the only place that
// clinician exists, and reports access as a column rather than as the reason
// they appear at all.
//
// Nothing here says READY. "Dashboard access" is the same predicate the API
// enforces on every request — linked auth identity on a live row — so the
// console and the server cannot disagree about who can sign in.

type ContactStatus = "CONTACT_REQUIRED" | "UNCONFIRMED" | "CONFIRMED";
type AccountStatus = "ACTIVE" | "DEACTIVATED" | "REMOVED";

type Clinician = {
  doctorId: string;
  name: string;
  email: string | null;
  phone: string | null;
  authUserId: string | null;
  clinicId: string;
  clinicName: string;
  organizationName: string | null;
  locations: { id: string; branchName: string; city: string | null; status: string }[];
  locationCount: number;
  lastSignInAt: string | null;
  accountStatus: AccountStatus;
  dashboardAccess: boolean;
  contactStatus: ContactStatus;
  hasLoginEmail: boolean;
  hasLoginMobile: boolean;
  provisioningStatus: string;
  blockedReason: string | null;
  provisioningSource: string | null;
};

type Payload = {
  summary: {
    total: number;
    dashboardReady: number;
    contactRequired: number;
    unconfirmedContact: number;
    invited: number;
    deactivated: number;
    multiLocation: number;
  };
  authReadable: boolean;
  clinicians: Clinician[];
  matched: number;
  clinics: string[];
};

const CONTACT_LABEL: Record<ContactStatus, string> = {
  CONTACT_REQUIRED: "Contact required",
  UNCONFIRMED: "Unconfirmed",
  CONFIRMED: "Confirmed",
};

const CONTACT_TONE: Record<ContactStatus, string> = {
  CONTACT_REQUIRED: "bg-rose-50 text-rose-800 border-rose-200",
  UNCONFIRMED: "bg-amber-50 text-amber-800 border-amber-200",
  CONFIRMED: "bg-emerald-50 text-emerald-800 border-emerald-200",
};

function relative(iso: string | null): string {
  if (!iso) return "Never";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  return new Date(iso).toLocaleDateString();
}

export function CliniciansPanel() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [clinic, setClinic] = useState("");
  const [status, setStatus] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (clinic) params.set("clinic", clinic);
    if (status) params.set("status", status);
    fetch(`/api/admin/clinicians?${params}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j: Payload) => {
        setData(j);
        setError(null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [q, clinic, status]);

  useEffect(() => {
    const t = setTimeout(load, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const columns = useMemo<Column<Clinician>[]>(
    () => [
      {
        key: "doctor",
        header: "Doctor",
        cell: (c) => (
          <div className="min-w-0">
            <div className="truncate font-medium">{c.name}</div>
            <div className="truncate font-mono text-[10px] text-muted-foreground/70">
              {c.doctorId}
            </div>
          </div>
        ),
      },
      {
        key: "clinic",
        header: "Clinic",
        cell: (c) => (
          <div className="min-w-0">
            <div className="truncate text-sm">{c.clinicName}</div>
            {c.organizationName && (
              <div className="truncate text-xs text-muted-foreground">
                {c.organizationName}
              </div>
            )}
          </div>
        ),
      },
      {
        key: "locations",
        header: "Locations",
        width: "210px",
        cell: (c) =>
          c.locationCount === 0 ? (
            <span className="text-xs text-amber-700">None recorded</span>
          ) : (
            <div className="space-y-0.5">
              <div className="text-sm">
                {c.locationCount === 1
                  ? c.locations[0]!.branchName
                  : `${c.locationCount} locations`}
              </div>
              {c.locationCount > 1 && (
                <div className="text-[11px] leading-tight text-muted-foreground">
                  {c.locations.map((l) => l.branchName).join(" · ")}
                </div>
              )}
            </div>
          ),
      },
      {
        key: "account",
        header: "Account",
        width: "110px",
        cell: (c) => (
          <span className={c.accountStatus === "ACTIVE" ? "text-sm" : "text-sm text-stone-600"}>
            {c.accountStatus === "ACTIVE" ? "Active" : "Deactivated"}
          </span>
        ),
      },
      {
        key: "dashboard",
        header: "Dashboard access",
        width: "195px",
        cell: (c) => (
          <div className="space-y-0.5">
            <span
              className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${
                c.dashboardAccess
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-stone-200 bg-stone-100 text-stone-700"
              }`}
            >
              {c.dashboardAccess ? "Can sign in" : "No access"}
            </span>
            {c.blockedReason && (
              <div className="text-[11px] leading-tight text-muted-foreground">
                {c.blockedReason}
              </div>
            )}
          </div>
        ),
      },
      {
        key: "contact",
        header: "Login contact",
        width: "180px",
        cell: (c) => (
          <div className="space-y-0.5">
            <span
              className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${CONTACT_TONE[c.contactStatus]}`}
            >
              {CONTACT_LABEL[c.contactStatus]}
            </span>
            <div className="truncate text-[11px] text-muted-foreground">
              {c.email ?? c.phone ?? "no personal contact on file"}
            </div>
          </div>
        ),
      },
      {
        key: "lastSignIn",
        header: "Last sign-in",
        width: "120px",
        cell: (c) => (
          <span className="text-xs text-muted-foreground">
            {/* An account that does not exist has not "never signed in" — it
                has nothing to sign in with. Different facts, different words. */}
            {c.authUserId ? relative(c.lastSignInAt) : "No account"}
          </span>
        ),
      },
      {
        key: "actions",
        header: "Access",
        width: "120px",
        cell: (c) => (
          <ActivateToggle
            doctorId={c.doctorId}
            isActive={c.accountStatus === "ACTIVE"}
            onChanged={load}
          />
        ),
      },
    ],
    [load],
  );

  if (error) {
    return <ErrorState title="Couldn&rsquo;t load clinicians" description={error} />;
  }

  const s = data?.summary;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Clinicians</h2>
        <p className="text-sm text-muted-foreground">
          Every doctor on the platform, including those provisioned before they
          can sign in. The table above lists accounts; this one lists people.
        </p>
      </div>

      {data && !data.authReadable && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong className="font-medium">Sign-in history unavailable.</strong>{" "}
          The authentication table could not be read, so &ldquo;Last
          sign-in&rdquo; is unknown for linked accounts rather than never.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Clinicians"
          value={s?.total ?? "—"}
          icon={<Stethoscope className="size-4" />}
        />
        <MetricCard
          label="Can sign in"
          value={s?.dashboardReady ?? "—"}
          icon={<ShieldCheck className="size-4" />}
          hint="Auth account linked to a live Doctor row"
        />
        <MetricCard
          label="Contact required"
          value={s?.contactRequired ?? "—"}
          icon={<PhoneOff className="size-4" />}
          hint="No personal login contact — cannot be invited"
        />
        <MetricCard
          label="Multi-location"
          value={s?.multiLocation ?? "—"}
          icon={<MapPinned className="size-4" />}
          hint="One identity, several branches"
        />
      </div>

      <FilterBar
        onClear={() => {
          setQ("");
          setClinic("");
          setStatus("");
        }}
      >
        <SearchBox
          value={q}
          onChange={setQ}
          placeholder="Search doctor, clinic, branch or ID"
          className="min-w-[260px]"
        />
        <select
          value={clinic}
          onChange={(e) => setClinic(e.target.value)}
          className="h-9 rounded-lg border border-border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
        >
          <option value="">All clinics</option>
          {(data?.clinics ?? []).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-9 rounded-lg border border-border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
        >
          <option value="">Any state</option>
          <option value="no_dashboard">No dashboard access</option>
          <option value="contact_required">Contact required</option>
          <option value="unconfirmed">Unconfirmed contact</option>
          <option value="multi_location">Multi-location</option>
          <option value="deactivated">Deactivated</option>
        </select>
      </FilterBar>

      <DataTable
        columns={columns}
        rows={data?.clinicians ?? []}
        rowKey={(c) => c.doctorId}
        loading={loading}
        emptyTitle="No clinicians match these filters"
        emptyDescription="Clear the filters to see every doctor."
      />
    </section>
  );
}

// Inline activate / deactivate toggle. Super Admin only.
// Writes to PATCH /api/admin/clinicians/[id] — no page navigation required.
function ActivateToggle({
  doctorId,
  isActive,
  onChanged,
}: {
  doctorId: string;
  isActive: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function toggle() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/clinicians/${doctorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error ?? "Failed");
      }
      onChanged();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-0.5">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        title={isActive ? "Deactivate account" : "Activate account"}
        className={`flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium transition-opacity disabled:opacity-40 ${
          isActive
            ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
            : "border-stone-200 bg-stone-100 text-stone-600 hover:bg-stone-200"
        }`}
      >
        {isActive ? (
          <ToggleRight className="size-3" />
        ) : (
          <ToggleLeft className="size-3" />
        )}
        {isActive ? "Active" : "Inactive"}
      </button>
      {err && <span className="text-[10px] text-rose-600">{err}</span>}
    </div>
  );
}
