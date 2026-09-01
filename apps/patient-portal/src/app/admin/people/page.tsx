"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ShieldAlert, ShieldCheck, UserX, Users, Building2, MailQuestion } from "lucide-react";
import { PageContainer } from "@/components/app-shell";
import { MetricCard } from "@/components/ui/metric-card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { SearchBox } from "@/components/ui/search-box";
import { FilterBar } from "@/components/ui/filter-bar";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/ui/states";

// People & Access — who can reach this platform, and with what authority.
//
// Read-only in SA-1 on purpose. Granting and revoking access changes the JWT
// claims hook and the membership tables together and needs its own audited
// mutation path; showing the truth first is what makes that phase safe to
// design. Nothing on this screen writes.

type AccessLevel =
  | "SUPER_ADMIN"
  | "ORG_ADMIN"
  | "CLINIC_ADMIN"
  | "STAFF"
  | "DOCTOR"
  | "PATIENT"
  | "NONE";

type Person = {
  userId: string;
  email: string | null;
  name: string | null;
  accessLevel: AccessLevel;
  memberships: {
    kind: string;
    role: string;
    clinicId: string | null;
    clinicName: string | null;
    isActive: boolean;
  }[];
  clinicNames: string[];
  createdAt: string;
  lastSignInAt: string | null;
  clinicUnclear: boolean;
  inactive: boolean;
};

type Payload = {
  summary: {
    totalAccounts: number;
    byAccessLevel: Record<AccessLevel, number>;
    rolelessAccounts: number;
    clinicUnclear: number;
    inactiveAccounts: number;
    neverSignedIn: number;
  };
  invitations: {
    available: boolean;
    pending: number;
    accepted: number;
    revoked: number;
    expired: number;
  };
  authReadable: boolean;
  people: Person[];
  matched: number;
  truncated: boolean;
  clinics: string[];
  patientsIncluded: boolean;
};

const ACCESS_TONE: Record<AccessLevel, string> = {
  SUPER_ADMIN: "bg-amber-100 text-amber-900 border-amber-200",
  ORG_ADMIN: "bg-amber-50 text-amber-800 border-amber-200",
  CLINIC_ADMIN: "bg-sky-50 text-sky-800 border-sky-200",
  STAFF: "bg-sky-50 text-sky-800 border-sky-200",
  DOCTOR: "bg-emerald-50 text-emerald-800 border-emerald-200",
  PATIENT: "bg-stone-100 text-stone-700 border-stone-200",
  NONE: "bg-rose-50 text-rose-800 border-rose-200",
};

function AccessPill({ level }: { level: AccessLevel }) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${ACCESS_TONE[level]}`}
    >
      {level === "NONE" ? "NO ROLE" : level.replace("_", " ")}
    </span>
  );
}

function relative(iso: string | null): string {
  if (!iso) return "Never";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  return new Date(iso).toLocaleDateString();
}

export default function PeoplePage() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [clinic, setClinic] = useState("");
  const [status, setStatus] = useState("");
  const [includePatients, setIncludePatients] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (role) params.set("role", role);
    if (clinic) params.set("clinic", clinic);
    if (status) params.set("status", status);
    if (includePatients) params.set("includePatients", "true");
    fetch(`/api/admin/people?${params}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j) => {
        setData(j);
        setError(null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [q, role, clinic, status, includePatients]);

  useEffect(() => {
    const t = setTimeout(load, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const columns = useMemo<Column<Person>[]>(
    () => [
      {
        key: "person",
        header: "Person",
        cell: (p) => (
          <div className="min-w-0">
            <div className="truncate font-medium">
              {p.name ?? p.email ?? "Unnamed account"}
            </div>
            {p.email && p.name && (
              <div className="truncate text-xs text-muted-foreground">
                {p.email}
              </div>
            )}
            {/* The immutable identifier stays available for investigation. */}
            <div className="truncate font-mono text-[10px] text-muted-foreground/70">
              {p.userId}
            </div>
          </div>
        ),
      },
      {
        key: "access",
        header: "Access",
        width: "150px",
        cell: (p) => (
          <div className="space-y-1">
            <AccessPill level={p.accessLevel} />
            {p.memberships.length > 1 && (
              <div className="text-[11px] text-muted-foreground">
                {p.memberships.length} memberships
              </div>
            )}
          </div>
        ),
      },
      {
        key: "clinic",
        header: "Clinic",
        cell: (p) =>
          p.clinicNames.length > 0 ? (
            <span className="text-sm">{p.clinicNames.join(", ")}</span>
          ) : p.accessLevel === "SUPER_ADMIN" || p.accessLevel === "ORG_ADMIN" ? (
            <span className="text-xs text-muted-foreground">
              Platform-wide
            </span>
          ) : (
            <span className="text-xs text-amber-700">Not assigned</span>
          ),
      },
      {
        key: "status",
        header: "Status",
        width: "130px",
        cell: (p) => (
          <div className="space-y-0.5 text-xs">
            {p.inactive && <div className="text-stone-600">Inactive</div>}
            {p.clinicUnclear && (
              <div className="text-amber-700">Clinic unclear</div>
            )}
            {!p.inactive && !p.clinicUnclear && (
              <div className="text-muted-foreground">Active</div>
            )}
          </div>
        ),
      },
      {
        key: "lastSignIn",
        header: "Last sign-in",
        width: "130px",
        cell: (p) => (
          <span
            className={
              p.lastSignInAt ? "text-sm" : "text-xs text-muted-foreground"
            }
          >
            {relative(p.lastSignInAt)}
          </span>
        ),
      },
      {
        key: "created",
        header: "Created",
        width: "110px",
        cell: (p) => (
          <span className="text-sm">
            {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : "—"}
          </span>
        ),
      },
    ],
    [],
  );

  if (error) {
    return (
      <PageContainer>
        <ErrorState title="Couldn't load people" description={error} />
      </PageContainer>
    );
  }
  if (!data) {
    return (
      <PageContainer>
        <LoadingState />
      </PageContainer>
    );
  }

  const s = data.summary;

  return (
    <PageContainer className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">People &amp; Access</h1>
        <p className="text-sm text-muted-foreground">
          Every account that can sign in, and what it can reach.
        </p>
      </div>

      {/* An unreadable auth directory and an empty one look identical and mean
          opposite things, so the failure is stated rather than rendered as
          zero accounts. */}
      {!data.authReadable && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong className="font-medium">Account directory unavailable.</strong>{" "}
          The authentication user table could not be read, so accounts with no
          membership record cannot be listed. Counts below cover only people
          with a membership.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total accounts"
          value={s.totalAccounts}
          icon={<Users className="size-4" />}
          hint={data.patientsIncluded ? "Including patients" : "Staff identities"}
        />
        <MetricCard
          label="Super Admins"
          value={s.byAccessLevel.SUPER_ADMIN ?? 0}
          icon={<ShieldCheck className="size-4" />}
          hint="Full platform authority"
        />
        <MetricCard
          label="Roleless accounts"
          value={s.rolelessAccounts}
          icon={<UserX className="size-4" />}
          hint={
            s.rolelessAccounts > 0
              ? "Can sign in, can reach nothing"
              : "None — every account has a role"
          }
        />
        <MetricCard
          label="Never signed in"
          value={s.neverSignedIn}
          icon={<MailQuestion className="size-4" />}
          hint="Created but never used"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Doctors"
          value={s.byAccessLevel.DOCTOR ?? 0}
          icon={<Users className="size-4" />}
        />
        <MetricCard
          label="Clinic admins & staff"
          value={(s.byAccessLevel.CLINIC_ADMIN ?? 0) + (s.byAccessLevel.STAFF ?? 0)}
          icon={<Building2 className="size-4" />}
        />
        <MetricCard
          label="Clinic unclear"
          value={s.clinicUnclear}
          icon={<ShieldAlert className="size-4" />}
          hint="Has a role, no clinic resolved"
        />
        <MetricCard
          label="Pending invitations"
          value={data.invitations.available ? data.invitations.pending : "—"}
          icon={<MailQuestion className="size-4" />}
          hint={
            data.invitations.available
              ? `${data.invitations.accepted} accepted · ${data.invitations.expired} expired`
              : "Invitation table not readable"
          }
        />
      </div>

      {s.rolelessAccounts > 0 && status !== "roleless" && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          <ShieldAlert className="size-4 shrink-0" />
          <span>
            <strong className="font-medium">
              {s.rolelessAccounts} account
              {s.rolelessAccounts === 1 ? "" : "s"} hold no role.
            </strong>{" "}
            These can authenticate but reach nothing — usually a mistyped
            address at sign-in.
          </span>
          <Button
            variant="outline"
            className="ml-auto"
            onClick={() => setStatus("roleless")}
          >
            Show them
          </Button>
        </div>
      )}

      <FilterBar
        onClear={() => {
          setQ("");
          setRole("");
          setClinic("");
          setStatus("");
          setIncludePatients(false);
        }}
      >
        <SearchBox
          value={q}
          onChange={setQ}
          placeholder="Search name, email, clinic or ID"
          className="min-w-[260px]"
        />
        <Select value={role} onChange={setRole} label="All roles">
          {["SUPER_ADMIN", "ORG_ADMIN", "CLINIC_ADMIN", "STAFF", "DOCTOR", "PATIENT", "NONE"].map(
            (r) => (
              <option key={r} value={r}>
                {r === "NONE" ? "No role" : r.replace("_", " ")}
              </option>
            ),
          )}
        </Select>
        <Select value={clinic} onChange={setClinic} label="All clinics">
          {data.clinics.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <Select value={status} onChange={setStatus} label="Any status">
          <option value="roleless">Roleless</option>
          <option value="clinic_unclear">Clinic unclear</option>
          <option value="inactive">Inactive</option>
          <option value="never_signed_in">Never signed in</option>
        </Select>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={includePatients}
            onChange={(e) => setIncludePatients(e.target.checked)}
            className="size-4 rounded border-border"
          />
          Include patients
        </label>
      </FilterBar>

      <div className="text-xs text-muted-foreground">
        Showing {data.people.length} of {data.matched} matching
        {data.truncated && " (capped at 500)"}
      </div>

      <DataTable
        columns={columns}
        rows={data.people}
        rowKey={(p) => p.userId}
        loading={loading}
        emptyTitle="No accounts match these filters"
        emptyDescription="Clear the filters to see the full directory."
      />
    </PageContainer>
  );
}

function Select({
  value,
  onChange,
  label,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-lg border border-border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
    >
      <option value="">{label}</option>
      {children}
    </select>
  );
}
