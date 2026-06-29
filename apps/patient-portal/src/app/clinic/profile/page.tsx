"use client";

import { useEffect, useState } from "react";
import { PageContainer } from "@/components/app-shell";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { LogoUploader } from "@/components/ui/logo-uploader";
import { LoadingState, ErrorState } from "@/components/ui/states";
import { Avatar } from "@/components/ui/avatar";
import { toast } from "@/components/ui/toast";

// Clinic branding editor with a live preview panel — the preview is just a
// styled card that uses the current state values, so users see the result
// instantly without needing to save. On submit the API persists; the
// BrandingProvider higher up reads the new clinic on next navigation.

type ClinicForm = {
  name: string;
  tagline: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  footerText: string;
  whatsappNumber: string;
  website: string;
  address: string;
  phone: string;
  email: string;
};

const EMPTY: ClinicForm = {
  name: "",
  tagline: "",
  logoUrl: "",
  primaryColor: "",
  secondaryColor: "",
  accentColor: "",
  footerText: "",
  whatsappNumber: "",
  website: "",
  address: "",
  phone: "",
  email: "",
};

export default function ClinicProfilePage() {
  const [v, setV] = useState<ClinicForm>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/clinic/profile", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((j) => {
        const c = j.clinic;
        setV({
          name: c.name ?? "",
          tagline: c.tagline ?? "",
          logoUrl: c.logoUrl ?? "",
          primaryColor: c.primaryColor ?? "",
          secondaryColor: c.secondaryColor ?? "",
          accentColor: c.accentColor ?? "",
          footerText: c.footerText ?? "",
          whatsappNumber: c.whatsappNumber ?? "",
          website: c.website ?? "",
          address: c.address ?? "",
          phone: c.phone ?? "",
          email: c.email ?? "",
        });
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const set = <K extends keyof ClinicForm>(k: K, val: ClinicForm[K]) =>
    setV((s) => ({ ...s, [k]: val }));

  async function save() {
    setBusy(true);
    const r = await fetch("/api/clinic/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: v.name,
        tagline: v.tagline || null,
        logoUrl: v.logoUrl || null,
        primaryColor: v.primaryColor || null,
        secondaryColor: v.secondaryColor || null,
        accentColor: v.accentColor || null,
        footerText: v.footerText || null,
        whatsappNumber: v.whatsappNumber || null,
        website: v.website || null,
        address: v.address || null,
        phone: v.phone || null,
        email: v.email || null,
      }),
    });
    setBusy(false);
    if (!r.ok) {
      toast.error("Save failed");
      return;
    }
    toast.success("Branding saved");
  }

  if (error) return <PageContainer><ErrorState title="Couldn't load profile" description={error} /></PageContainer>;
  if (loading) return <PageContainer><LoadingState /></PageContainer>;

  return (
    <PageContainer className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Clinic branding</h1>
        <p className="text-sm text-muted-foreground">
          Updates apply across reports, PDFs, the patient QR landing, and the workspace chrome.
        </p>
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-6">
        <form
          onSubmit={(e) => { e.preventDefault(); void save(); }}
          className="space-y-6"
        >
          <Card>
            <CardHeader><CardTitle className="text-base">Identity</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <LogoUploader
                value={v.logoUrl || null}
                onUpload={async () => { toast.message("Logo upload arrives in Sprint 2"); return v.logoUrl; }}
                onRemove={() => set("logoUrl", "")}
              />
              <Field label="Logo URL">
                <Input value={v.logoUrl} onChange={(e) => set("logoUrl", e.target.value)} />
              </Field>
              <Field label="Clinic name" required>
                <Input value={v.name} onChange={(e) => set("name", e.target.value)} required />
              </Field>
              <Field label="Tagline">
                <Input value={v.tagline} onChange={(e) => set("tagline", e.target.value)} />
              </Field>
              <Field label="Footer text" hint="Appears on PDFs and the in-app report footer.">
                <Textarea rows={2} value={v.footerText} onChange={(e) => set("footerText", e.target.value)} />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Colors</CardTitle></CardHeader>
            <CardContent className="grid sm:grid-cols-3 gap-4">
              <Field label="Primary"><ColorInput value={v.primaryColor} onChange={(s) => set("primaryColor", s)} /></Field>
              <Field label="Secondary"><ColorInput value={v.secondaryColor} onChange={(s) => set("secondaryColor", s)} /></Field>
              <Field label="Accent"><ColorInput value={v.accentColor} onChange={(s) => set("accentColor", s)} /></Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Contact</CardTitle></CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-4">
              <Field label="WhatsApp number"><Input value={v.whatsappNumber} onChange={(e) => set("whatsappNumber", e.target.value)} /></Field>
              <Field label="Phone"><Input value={v.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
              <Field label="Email"><Input type="email" value={v.email} onChange={(e) => set("email", e.target.value)} /></Field>
              <Field label="Website"><Input type="url" value={v.website} onChange={(e) => set("website", e.target.value)} /></Field>
              <Field label="Address" className="sm:col-span-2"><Textarea rows={2} value={v.address} onChange={(e) => set("address", e.target.value)} /></Field>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save branding"}</Button>
          </div>
        </form>

        <BrandingPreview v={v} />
      </div>
    </PageContainer>
  );
}

function BrandingPreview({ v }: { v: ClinicForm }) {
  const primary = v.primaryColor || "#0F172A";
  const secondary = v.secondaryColor || "#64748B";
  const accent = v.accentColor || "#3B82F6";

  return (
    <div className="sticky top-20 space-y-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">Live preview</div>
      <div
        className="rounded-xl border border-border bg-card overflow-hidden"
        style={{ ["--brand-primary" as string]: primary, ["--brand-secondary" as string]: secondary }}
      >
        <div className="px-4 py-3 flex items-center gap-3" style={{ background: primary, color: "#fff" }}>
          {v.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={v.logoUrl} alt="" className="size-9 rounded-md object-cover bg-white/10" />
          ) : (
            <Avatar name={v.name || "Clinic"} size="sm" />
          )}
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">{v.name || "Clinic name"}</div>
            <div className="text-xs opacity-80 truncate">{v.tagline || "Tagline preview"}</div>
          </div>
        </div>
        <div className="p-4 space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="size-3 rounded-full" style={{ background: primary }} />
            <span>Primary</span>
            <span className="ml-auto font-mono text-xs">{primary}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="size-3 rounded-full" style={{ background: secondary }} />
            <span>Secondary</span>
            <span className="ml-auto font-mono text-xs">{secondary}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="size-3 rounded-full" style={{ background: accent }} />
            <span>Accent</span>
            <span className="ml-auto font-mono text-xs">{accent}</span>
          </div>
          <button
            className="w-full mt-2 rounded-md py-2 text-sm font-medium text-white"
            style={{ background: accent }}
            type="button"
          >
            Approve report
          </button>
          {v.footerText && (
            <div className="pt-3 mt-3 border-t border-border text-xs text-muted-foreground whitespace-pre-wrap">
              {v.footerText}
            </div>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Apply propagates to the workspace chrome, PDF, WhatsApp + patient portal on next page load.
      </p>
    </div>
  );
}

function Field({
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
      <Label>{label}{required && <span className="text-destructive"> *</span>}</Label>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value || "#000000"}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-9 rounded-md border border-border bg-background cursor-pointer"
      />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="#000000" className="flex-1" />
    </div>
  );
}
