"use client";

import { useCallback, useEffect, useState } from "react";
import { MapPin, MapPinOff, Plus, Star, Trash2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoadingState, ErrorState } from "@/components/ui/states";
import { toast } from "@/components/ui/toast";

// Branch geography for one clinic.
//
// This panel exists to unblock the national map: until a human structures an
// address and drops a pin, there is nothing to plot, and no amount of map code
// changes that. Coordinates are entered by hand or pasted from Google Maps —
// a pin-on-map picker arrives with the map itself (S3/S4).
//
// Nothing here is inferred. A branch with no coordinates is shown as "Not on
// map" rather than being approximated onto one.

const STATUSES = ["ONBOARDING", "ACTIVE", "INACTIVE", "CLOSED"] as const;
type LocationStatus = (typeof STATUSES)[number];

interface ClinicLocation {
  id: string;
  branchName: string;
  isPrimary: boolean;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  district: string | null;
  state: string | null;
  pincode: string | null;
  country: string;
  latitude: number | null;
  longitude: number | null;
  geoStatus: "UNSET" | "PINNED" | "GEOCODED";
  status: LocationStatus;
  phone: string | null;
}

interface Seed {
  branchName: string;
  addressLine1: string | null;
  phone: string | null;
  country: string;
}

type SetupState = "NONE" | "INCOMPLETE" | "COMPLETE";

interface DraftValues {
  branchName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
  country: string;
  phone: string;
  status: LocationStatus;
  coordinates: string;
}

const EMPTY_DRAFT: DraftValues = {
  branchName: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  district: "",
  state: "",
  pincode: "",
  country: "IN",
  phone: "",
  status: "ONBOARDING",
  coordinates: "",
};

export function ClinicLocationsPanel({ clinicId }: { clinicId: string }) {
  const [locations, setLocations] = useState<ClinicLocation[] | null>(null);
  const [setup, setSetup] = useState<SetupState>("NONE");
  const [seed, setSeed] = useState<Seed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftValues | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await fetch(`/api/admin/clinics/${clinicId}/locations`, {
        cache: "no-store",
      });
      if (!r.ok) throw new Error(r.statusText || "Request failed");
      const j = await r.json();
      setLocations(j.locations);
      setSetup(j.locationSetup);
      setSeed(j.seed);
    } catch (e) {
      setError(String(e));
    }
  }, [clinicId]);

  useEffect(() => {
    void load();
  }, [load]);

  function startAdd() {
    setEditingId(null);
    // The clinic's legacy free-text address is offered as a starting point for
    // the first branch, not written on its behalf.
    setDraft(
      seed
        ? {
            ...EMPTY_DRAFT,
            branchName: seed.branchName,
            addressLine1: seed.addressLine1 ?? "",
            phone: seed.phone ?? "",
            country: seed.country,
          }
        : EMPTY_DRAFT,
    );
  }

  function startEdit(loc: ClinicLocation) {
    setEditingId(loc.id);
    setDraft({
      branchName: loc.branchName,
      addressLine1: loc.addressLine1 ?? "",
      addressLine2: loc.addressLine2 ?? "",
      city: loc.city ?? "",
      district: loc.district ?? "",
      state: loc.state ?? "",
      pincode: loc.pincode ?? "",
      country: loc.country,
      phone: loc.phone ?? "",
      status: loc.status,
      coordinates:
        loc.latitude != null && loc.longitude != null
          ? `${loc.latitude}, ${loc.longitude}`
          : "",
    });
  }

  async function save() {
    if (!draft) return;
    const coords = parseCoordinates(draft.coordinates);
    if (coords === "invalid") {
      toast.error("Coordinates must be `latitude, longitude` — e.g. 19.0596, 72.8295");
      return;
    }

    setBusy(true);
    try {
      const payload = {
        branchName: draft.branchName,
        addressLine1: draft.addressLine1,
        addressLine2: draft.addressLine2,
        city: draft.city,
        district: draft.district,
        state: draft.state,
        pincode: draft.pincode,
        country: draft.country,
        phone: draft.phone,
        status: draft.status,
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
      };

      const r = await fetch(
        editingId
          ? `/api/admin/locations/${editingId}`
          : `/api/admin/clinics/${clinicId}/locations`,
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        toast.error(j.message ?? j.error ?? "Save failed");
        return;
      }
      toast.success(editingId ? "Branch updated" : "Branch added");
      setDraft(null);
      setEditingId(null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function promote(id: string) {
    const r = await fetch(`/api/admin/locations/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isPrimary: true }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      toast.error(j.message ?? j.error ?? "Could not set primary branch");
      return;
    }
    await load();
  }

  async function retire(id: string, branchName: string) {
    if (!confirm(`Retire “${branchName}”? It stops appearing on the map.`)) return;
    const r = await fetch(`/api/admin/locations/${id}`, { method: "DELETE" });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      toast.error(j.message ?? j.error ?? "Could not retire branch");
      return;
    }
    toast.success("Branch retired");
    await load();
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle className="text-base">Locations</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Physical branches. A branch needs coordinates to appear on the
            national map.
          </p>
        </div>
        <SetupBadge state={setup} />
      </CardHeader>

      <CardContent className="space-y-4">
        {error ? (
          <ErrorState title="Couldn't load locations" description={error} />
        ) : locations === null ? (
          <LoadingState />
        ) : locations.length === 0 && !draft ? (
          <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
            <p className="text-sm font-medium">No branches recorded yet.</p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
              This clinic can&rsquo;t appear on the national map until at least
              one branch has an address and a map pin.
            </p>
            <Button type="button" className="mt-4" onClick={startAdd}>
              <Plus />
              Add first branch
            </Button>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {locations.map((loc) => (
                <li
                  key={loc.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-3"
                >
                  <div className="min-w-0 flex-1 basis-56">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">
                        {loc.branchName}
                      </span>
                      {loc.isPrimary && (
                        <StatusBadge tone="info">Primary</StatusBadge>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {describeAddress(loc) || "Address not recorded"}
                    </p>
                  </div>

                  <PinBadge location={loc} />
                  <StatusBadge tone={toneForStatus(loc.status)}>
                    {loc.status}
                  </StatusBadge>

                  <div className="flex items-center gap-1">
                    {!loc.isPrimary && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => void promote(loc.id)}
                        aria-label={`Make ${loc.branchName} the primary branch`}
                      >
                        <Star />
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => startEdit(loc)}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => void retire(loc.id, loc.branchName)}
                      aria-label={`Retire ${loc.branchName}`}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>

            {!draft && (
              <Button type="button" variant="outline" onClick={startAdd}>
                <Plus />
                Add branch
              </Button>
            )}
          </>
        )}

        {draft && (
          <DraftForm
            draft={draft}
            onChange={setDraft}
            onCancel={() => {
              setDraft(null);
              setEditingId(null);
            }}
            onSave={() => void save()}
            busy={busy}
            mode={editingId ? "edit" : "create"}
          />
        )}
      </CardContent>
    </Card>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */

function DraftForm({
  draft,
  onChange,
  onCancel,
  onSave,
  busy,
  mode,
}: {
  draft: DraftValues;
  onChange: (d: DraftValues) => void;
  onCancel: () => void;
  onSave: () => void;
  busy: boolean;
  mode: "create" | "edit";
}) {
  const set = <K extends keyof DraftValues>(k: K, val: DraftValues[K]) =>
    onChange({ ...draft, [k]: val });

  return (
    // Not a <form>: this panel renders inside the clinic <form>, and nesting
    // forms is invalid markup that makes the outer submit swallow this one.
    <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-4">
      <p className="text-sm font-medium">
        {mode === "create" ? "New branch" : "Edit branch"}
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <LocField label="Branch name" required>
          <Input
            value={draft.branchName}
            onChange={(e) => set("branchName", e.target.value)}
            placeholder="Bandra West"
          />
        </LocField>
        <LocField label="Branch phone">
          <Input value={draft.phone} onChange={(e) => set("phone", e.target.value)} />
        </LocField>
        <LocField label="Address line 1" className="sm:col-span-2">
          <Input
            value={draft.addressLine1}
            onChange={(e) => set("addressLine1", e.target.value)}
          />
        </LocField>
        <LocField label="Address line 2" className="sm:col-span-2">
          <Input
            value={draft.addressLine2}
            onChange={(e) => set("addressLine2", e.target.value)}
          />
        </LocField>
        <LocField label="City">
          <Input value={draft.city} onChange={(e) => set("city", e.target.value)} />
        </LocField>
        <LocField label="District">
          <Input
            value={draft.district}
            onChange={(e) => set("district", e.target.value)}
          />
        </LocField>
        <LocField label="State">
          <Input value={draft.state} onChange={(e) => set("state", e.target.value)} />
        </LocField>
        <LocField label="PIN code">
          <Input
            value={draft.pincode}
            onChange={(e) => set("pincode", e.target.value)}
            inputMode="numeric"
            placeholder="400050"
          />
        </LocField>
        <LocField label="Country" hint="ISO code — IN for India.">
          <Input
            value={draft.country}
            onChange={(e) => set("country", e.target.value.toUpperCase())}
            maxLength={2}
          />
        </LocField>
        <LocField label="Status">
          <select
            value={draft.status}
            onChange={(e) => set("status", e.target.value as LocationStatus)}
            className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </LocField>
        <LocField
          label="Map pin"
          className="sm:col-span-2"
          hint="Paste coordinates from Google Maps as `latitude, longitude`. Leave blank if you don't have them yet — the branch saves without a pin and stays off the map."
        >
          <Input
            value={draft.coordinates}
            onChange={(e) => set("coordinates", e.target.value)}
            placeholder="19.0596, 72.8295"
          />
        </LocField>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          onClick={onSave}
          disabled={busy || draft.branchName.trim().length < 2}
        >
          {busy ? "Saving…" : mode === "create" ? "Add branch" : "Save branch"}
        </Button>
      </div>
    </div>
  );
}

function LocField({
  label,
  required,
  hint,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function SetupBadge({ state }: { state: SetupState }) {
  if (state === "COMPLETE") {
    return <StatusBadge tone="success">On the map</StatusBadge>;
  }
  if (state === "INCOMPLETE") {
    return <StatusBadge tone="warning">Pin missing</StatusBadge>;
  }
  return <StatusBadge tone="neutral">Setup incomplete</StatusBadge>;
}

// Carries an icon *and* words: map presence is never signalled by colour alone.
function PinBadge({ location }: { location: ClinicLocation }) {
  if (location.latitude == null || location.longitude == null) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <MapPinOff className="size-3.5" aria-hidden />
        Not on map
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 text-xs text-muted-foreground"
      title={`${location.latitude}, ${location.longitude}`}
    >
      <MapPin className="size-3.5" aria-hidden />
      Pinned
    </span>
  );
}

function toneForStatus(status: LocationStatus) {
  switch (status) {
    case "ACTIVE":
      return "success" as const;
    case "ONBOARDING":
      return "info" as const;
    case "INACTIVE":
      return "warning" as const;
    case "CLOSED":
      return "neutral" as const;
  }
}

function describeAddress(loc: ClinicLocation): string {
  return [loc.addressLine1, loc.city, loc.state, loc.pincode]
    .filter(Boolean)
    .join(", ");
}

/**
 * `19.0596, 72.8295` → coordinates. Returns null for blank (no pin) and
 * "invalid" for anything unparseable, so a typo can't be read as "cleared".
 */
export function parseCoordinates(
  input: string,
): { latitude: number; longitude: number } | null | "invalid" {
  const trimmed = input.trim();
  if (trimmed === "") return null;

  const parts = trimmed.split(",").map((p) => p.trim());
  if (parts.length !== 2) return "invalid";

  const latitude = Number(parts[0]);
  const longitude = Number(parts[1]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return "invalid";
  if (latitude < -90 || latitude > 90) return "invalid";
  if (longitude < -180 || longitude > 180) return "invalid";

  return { latitude, longitude };
}
