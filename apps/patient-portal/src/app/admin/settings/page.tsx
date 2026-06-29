"use client";

import { useEffect, useState } from "react";
import { PageContainer } from "@/components/app-shell";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { LoadingState, ErrorState } from "@/components/ui/states";
import { toast } from "@/components/ui/toast";

type Settings = {
  id: string;
  platformName: string;
  defaultTheme: "light" | "dark" | "system";
  defaultLanguage: "EN" | "HI" | "MR" | "GU" | "PA" | "TA" | "TE";
  defaultWhatsappTemplate: string | null;
  aiModelDefault: string | null;
  aiNotes: string | null;
  versionInfo: string | null;
};

export default function PlatformSettingsPage() {
  const [s, setS] = useState<Settings | null>(null);
  const [storageBytes, setStorageBytes] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/admin/platform-settings", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((j) => {
        setS(j.settings);
        setStorageBytes(j.storageBytes ?? 0);
      })
      .catch((e) => setError(String(e)));
  }, []);

  if (error)
    return (
      <PageContainer>
        <ErrorState title="Couldn't load settings" description={error} />
      </PageContainer>
    );
  if (!s)
    return (
      <PageContainer>
        <LoadingState />
      </PageContainer>
    );

  async function save() {
    if (!s) return;
    setBusy(true);
    const r = await fetch("/api/admin/platform-settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        platformName: s.platformName,
        defaultTheme: s.defaultTheme,
        defaultLanguage: s.defaultLanguage,
        defaultWhatsappTemplate: s.defaultWhatsappTemplate || null,
        aiNotes: s.aiNotes || null,
        versionInfo: s.versionInfo || null,
      }),
    });
    setBusy(false);
    if (!r.ok) {
      toast.error("Save failed");
      return;
    }
    toast.success("Saved");
  }

  return (
    <PageContainer className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Platform settings</h1>
        <p className="text-sm text-muted-foreground">
          Defaults applied across every clinic.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">General</CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label>Platform name</Label>
            <Input
              value={s.platformName}
              onChange={(e) => setS({ ...s, platformName: e.target.value })}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>Default theme</Label>
            <select
              value={s.defaultTheme}
              onChange={(e) =>
                setS({ ...s, defaultTheme: e.target.value as Settings["defaultTheme"] })
              }
              className="mt-1.5 h-9 px-2 rounded-md border border-border bg-background text-sm w-full"
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
          <div>
            <Label>Default language</Label>
            <select
              value={s.defaultLanguage}
              onChange={(e) =>
                setS({
                  ...s,
                  defaultLanguage: e.target.value as Settings["defaultLanguage"],
                })
              }
              className="mt-1.5 h-9 px-2 rounded-md border border-border bg-background text-sm w-full"
            >
              {(["EN", "HI", "MR", "GU", "PA", "TA", "TE"] as const).map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Default WhatsApp template</Label>
            <Input
              value={s.defaultWhatsappTemplate ?? ""}
              onChange={(e) => setS({ ...s, defaultWhatsappTemplate: e.target.value })}
              className="mt-1.5"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">AI</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Model default</Label>
            <Input value={s.aiModelDefault ?? "(orchestrator-managed)"} readOnly className="mt-1.5" />
            <p className="text-xs text-muted-foreground mt-1">
              Read-only in this phase. Sprint 2 wires this to the AI Command
              Center.
            </p>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea
              value={s.aiNotes ?? ""}
              onChange={(e) => setS({ ...s, aiNotes: e.target.value })}
              rows={3}
              className="mt-1.5"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Storage & version</CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label>Storage usage</Label>
            <div className="mt-1.5 text-sm">
              {(storageBytes / 1024 / 1024).toFixed(1)} MB across AI artifacts
            </div>
          </div>
          <div>
            <Label>Version</Label>
            <Input
              value={s.versionInfo ?? ""}
              onChange={(e) => setS({ ...s, versionInfo: e.target.value })}
              placeholder="v1.0"
              className="mt-1.5"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => void save()} disabled={busy}>
          {busy ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </PageContainer>
  );
}
