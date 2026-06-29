"use client";

import { useEffect, useState } from "react";
import { PageContainer } from "@/components/app-shell";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoadingState, ErrorState } from "@/components/ui/states";
import { toast } from "@/components/ui/toast";
import { DEFAULT_WHATSAPP_SETTINGS, type WhatsappSettings } from "@/lib/clinic/whatsapp";

export default function ClinicWhatsappPage() {
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [settings, setSettings] = useState<WhatsappSettings>(DEFAULT_WHATSAPP_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    fetch("/api/clinic/whatsapp", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((j) => {
        setWhatsappNumber(j.whatsappNumber ?? "");
        setSettings({ ...DEFAULT_WHATSAPP_SETTINGS, ...j.settings });
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setBusy(true);
    const r = await fetch("/api/clinic/whatsapp", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ whatsappNumber: whatsappNumber || null, settings }),
    });
    setBusy(false);
    if (!r.ok) {
      toast.error("Save failed");
      return;
    }
    toast.success("WhatsApp settings saved");
  }

  async function test() {
    setTesting(true);
    const r = await fetch("/api/clinic/whatsapp?action=test", { method: "POST" });
    setTesting(false);
    if (!r.ok) {
      toast.error("Test failed");
      return;
    }
    const j = await r.json();
    setSettings({ ...DEFAULT_WHATSAPP_SETTINGS, ...j.settings });
    toast.success(j.settings.connectionStatus === "CONNECTED" ? "Connection OK" : "Not configured");
  }

  if (error) return <PageContainer><ErrorState title="Couldn't load WhatsApp settings" description={error} /></PageContainer>;
  if (loading) return <PageContainer><LoadingState /></PageContainer>;

  return (
    <PageContainer className="space-y-6 max-w-3xl">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">WhatsApp</h1>
          <p className="text-sm text-muted-foreground">Business number, templates, and delivery copy.</p>
        </div>
        <StatusBadge tone={settings.connectionStatus === "CONNECTED" ? "success" : settings.connectionStatus === "FAILED" ? "danger" : "neutral"}>
          {settings.connectionStatus ?? "UNCONFIGURED"}
        </StatusBadge>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Connection</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label>Business number</Label>
            <Input className="mt-1.5" value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)} placeholder="+91..." />
          </div>
          <div>
            <Label>Display name</Label>
            <Input className="mt-1.5" value={settings.businessName ?? ""} onChange={(e) => setSettings({ ...settings, businessName: e.target.value })} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Templates & copy</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Default template ID</Label>
            <Input className="mt-1.5" value={settings.defaultTemplateId ?? ""} onChange={(e) => setSettings({ ...settings, defaultTemplateId: e.target.value })} />
          </div>
          <div>
            <Label>Welcome message</Label>
            <Textarea className="mt-1.5" rows={3} value={settings.welcomeMessage ?? ""} onChange={(e) => setSettings({ ...settings, welcomeMessage: e.target.value })} />
          </div>
          <div>
            <Label>Report delivery message</Label>
            <Textarea className="mt-1.5" rows={3} value={settings.reportDeliveryMessage ?? ""} onChange={(e) => setSettings({ ...settings, reportDeliveryMessage: e.target.value })} />
          </div>
          <div>
            <Label>Reminder message</Label>
            <Textarea className="mt-1.5" rows={3} value={settings.reminderMessage ?? ""} onChange={(e) => setSettings({ ...settings, reminderMessage: e.target.value })} />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" onClick={() => void test()} disabled={testing}>
          {testing ? "Testing…" : "Test connection"}
        </Button>
        <Button onClick={() => void save()} disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </Button>
      </div>
    </PageContainer>
  );
}
