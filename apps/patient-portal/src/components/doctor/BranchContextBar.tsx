"use client";

import { useEffect, useState } from "react";
import { Building2, Phone, MapPin } from "lucide-react";
import type { DoctorLocation } from "@/lib/doctor/locations";

// Branch context for a clinician who works across more than one premises.
//
// ── Renders for nobody else ─────────────────────────────────────────────────
// The component returns null below two branches. Eleven of the twelve launch
// clinics run a single location, and a "select your branch" control with one
// option is a decision a clinician has to read, understand and dismiss every
// day in order to learn that there was never a choice.
//
// ── It sets context; it does not filter ─────────────────────────────────────
// No clinical record carries a location id (see lib/doctor/locations), so this
// control cannot narrow the queue, the patient list or the orders, and it does
// not pretend to. It answers "which premises am I in", surfaces that branch's
// reception line, and says plainly that records span the whole clinic. A
// selector that silently changed nothing would be worse than none at all.
//
// ── Why localStorage ────────────────────────────────────────────────────────
// The working branch is a per-device convenience, not clinical state: the
// doctor who is in Khar today is in Malad tomorrow, and nothing downstream
// reads this value. Persisting it server-side would create a stored fact about
// a clinician's whereabouts that nothing needs. Reads and writes are guarded --
// private windows and blocked site data throw on access.

const STORAGE_KEY = "hairos.doctor.branch";

function readStored(clinicId: string): string | null {
  try {
    const raw = window.localStorage.getItem(`${STORAGE_KEY}.${clinicId}`);
    return raw && raw.length > 0 ? raw : null;
  } catch {
    return null;
  }
}

function writeStored(clinicId: string, id: string): void {
  try {
    window.localStorage.setItem(`${STORAGE_KEY}.${clinicId}`, id);
  } catch {
    // A branch preference is not worth a broken workspace.
  }
}

function addressOf(l: DoctorLocation): string {
  return [l.addressLine1, l.city, l.state, l.pincode].filter(Boolean).join(", ");
}

export function BranchContextBar({
  clinicId,
  clinicName,
  locations,
}: {
  clinicId: string;
  clinicName: string;
  locations: DoctorLocation[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const stored = readStored(clinicId);
    // A stored id for a branch that has since closed or been removed must not
    // pin the bar to a branch that is no longer in the list.
    const valid = stored && locations.some((l) => l.id === stored) ? stored : null;
    setSelectedId(valid ?? locations[0]?.id ?? null);
  }, [clinicId, locations]);

  if (locations.length < 2) return null;

  const selected = locations.find((l) => l.id === selectedId) ?? locations[0]!;
  const address = addressOf(selected);

  return (
    <section
      aria-label="Clinic branch context"
      className="rounded-xl border border-border bg-card px-4 py-3"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex min-w-0 items-center gap-2">
          <Building2 className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-sm font-medium">{clinicName}</span>
          <span className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
            {locations.length} branches
          </span>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Working from</span>
          <select
            value={selected.id}
            onChange={(e) => {
              setSelectedId(e.target.value);
              writeStored(clinicId, e.target.value);
            }}
            className="h-9 max-w-[220px] rounded-lg border border-border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
          >
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.branchName}
                {l.status === "ONBOARDING" ? " (onboarding)" : ""}
              </option>
            ))}
          </select>
        </label>

        {address && (
          <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" />
            <span className="truncate">{address}</span>
          </span>
        )}
        {selected.phone && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Phone className="size-3.5 shrink-0" />
            {selected.phone}
          </span>
        )}
      </div>

      {/* Said out loud, because a selector that changed nothing without saying
          so would read as a filter that is broken. */}
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        Patients, assessments and orders below cover all {locations.length}{" "}
        branches — records are held by the clinic, not by branch.
      </p>
    </section>
  );
}
