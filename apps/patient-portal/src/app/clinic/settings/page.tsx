"use client";

import { useEffect, useState } from "react";
import { PageContainer } from "@/components/app-shell";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { LoadingState, ErrorState } from "@/components/ui/states";
import { toast } from "@/components/ui/toast";
import {
  DEFAULT_CLINIC_SETTINGS,
  type BusinessHours,
  type ClinicSettings,
  type Day,
} from "@/lib/clinic/settings";

const DAYS: Day[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const TIMEZONES = ["Asia/Kolkata", "Asia/Dubai", "Asia/Singapore", "Europe/London", "America/New_York", "UTC"];

export default function ClinicSettingsPage() {
  const [settings, setSettings] = useState<ClinicSettings>(DEFAULT_CLINIC_SETTINGS);
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/clinic/settings", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((j) => {
        setSettings({ ...DEFAULT_CLINIC_SETTINGS, ...j.settings });
        setTimezone(j.timezone ?? "Asia/Kolkata");
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setBusy(true);
    const r = await fetch("/api/clinic/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ settings, timezone }),
    });
    setBusy(false);
    if (!r.ok) {
      toast.error("Save failed");
      return;
    }
    toast.success("Settings saved");
  }

  function setHours(day: Day, patch: Partial<BusinessHours>) {
    const existing = settings.businessHours?.[day] ?? { open: "09:00", close: "18:00", closed: false };
    setSettings({
      ...settings,
      businessHours: {
        ...(settings.businessHours ?? {}),
        [day]: { ...existing, ...patch },
      },
    });
  }

  if (error) return <PageContainer><ErrorState title="Couldn't load settings" description={error} /></PageContainer>;
  if (loading) return <PageContainer><LoadingState /></PageContainer>;

  return (
    <PageContainer className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Clinic settings</h1>
        <p className="text-sm text-muted-foreground">Timezone, hours, workflow rules, and feature flags.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">General</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label>Timezone</Label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="mt-1.5 h-9 px-2 rounded-md border border-border bg-background text-sm w-full"
            >
              {TIMEZONES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <Label>Assessment duration (min)</Label>
            <Input
              type="number"
              className="mt-1.5"
              value={settings.assessmentDurationMinutes ?? ""}
              onChange={(e) => setSettings({ ...settings, assessmentDurationMinutes: Number(e.target.value) || undefined })}
            />
          </div>
          <div>
            <Label>Auto-archive after (days)</Label>
            <Input
              type="number"
              className="mt-1.5"
              value={settings.autoArchiveDays ?? ""}
              onChange={(e) => setSettings({ ...settings, autoArchiveDays: Number(e.target.value) || undefined })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Business hours</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {DAYS.map((d) => {
            const h = settings.businessHours?.[d] ?? { open: "09:00", close: "18:00", closed: false };
            return (
              <div key={d} className="flex items-center gap-3">
                <div className="w-12 text-xs font-medium text-muted-foreground">{d}</div>
                <input
                  type="time"
                  value={h.open}
                  disabled={h.closed}
                  onChange={(e) => setHours(d, { open: e.target.value })}
                  className="h-8 px-2 rounded-md border border-border bg-background text-sm"
                />
                <span className="text-xs text-muted-foreground">to</span>
                <input
                  type="time"
                  value={h.close}
                  disabled={h.closed}
                  onChange={(e) => setHours(d, { close: e.target.value })}
                  className="h-8 px-2 rounded-md border border-border bg-background text-sm"
                />
                <label className="ml-auto inline-flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={!!h.closed}
                    onChange={(e) => setHours(d, { closed: e.target.checked })}
                  />
                  Closed
                </label>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Workflow & feature flags</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Toggle
            label="Require doctor approval before report delivery"
            checked={!!settings.reportApprovalRequired}
            onChange={(v) => setSettings({ ...settings, reportApprovalRequired: v })}
          />
          <Toggle
            label="Patient portal enabled"
            checked={!!settings.patientPortalEnabled}
            onChange={(v) => setSettings({ ...settings, patientPortalEnabled: v })}
          />
          <Toggle
            label="Avatar video enabled (feature flag)"
            checked={!!settings.avatarVideoEnabled}
            onChange={(v) => setSettings({ ...settings, avatarVideoEnabled: v })}
          />
          <Toggle
            label="Notify on report approval"
            checked={!!settings.notifyOnReportApproval}
            onChange={(v) => setSettings({ ...settings, notifyOnReportApproval: v })}
          />
          <Toggle
            label="Notify on new assessment"
            checked={!!settings.notifyOnNewAssessment}
            onChange={(v) => setSettings({ ...settings, notifyOnNewAssessment: v })}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => void save()} disabled={busy}>{busy ? "Saving…" : "Save settings"}</Button>
      </div>
    </PageContainer>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer">
      <span className="text-sm">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4"
      />
    </label>
  );
}
