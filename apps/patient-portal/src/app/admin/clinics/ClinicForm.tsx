"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LogoUploader } from "@/components/ui/logo-uploader";
import { toast } from "@/components/ui/toast";

export type ClinicFormValues = {
  id?: string;
  name: string;
  slug: string;
  region: string;
  language: string;
  timezone: string;
  email: string;
  phone: string;
  whatsappNumber: string;
  address: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  logoUrl: string;
  tagline: string;
  website: string;
  subscriptionPlan: string;
  subscriptionStatus: string;
};

const EMPTY: ClinicFormValues = {
  name: "",
  slug: "",
  region: "IN",
  language: "en",
  timezone: "Asia/Kolkata",
  email: "",
  phone: "",
  whatsappNumber: "",
  address: "",
  primaryColor: "",
  secondaryColor: "",
  accentColor: "",
  logoUrl: "",
  tagline: "",
  website: "",
  subscriptionPlan: "TRIAL",
  subscriptionStatus: "ACTIVE",
};

const TIMEZONES = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Europe/London",
  "America/New_York",
  "UTC",
];

const PLANS = ["TRIAL", "STARTER", "PROFESSIONAL", "ENTERPRISE"] as const;
const SUB_STATUSES = ["ACTIVE", "PAST_DUE", "SUSPENDED", "CANCELED", "EXPIRED"] as const;

export function ClinicForm({
  initial,
  mode,
}: {
  initial?: Partial<ClinicFormValues>;
  mode: "create" | "edit";
}) {
  const router = useRouter();
  const [v, setV] = useState<ClinicFormValues>({ ...EMPTY, ...initial });
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof ClinicFormValues>(k: K, val: ClinicFormValues[K]) =>
    setV((s) => ({ ...s, [k]: val }));

  async function save() {
    setBusy(true);
    try {
      // Logo upload is plumbed but not connected to storage in this phase —
      // the LogoUploader's onUpload callback below is a passthrough that
      // expects a data: URL or pre-uploaded URL. Real upload route lands
      // in Sprint 2 (Supabase Storage signed-upload).
      const body = {
        name: v.name,
        slug: v.slug,
        region: v.region,
        language: v.language,
        timezone: v.timezone,
        email: v.email || null,
        phone: v.phone || null,
        whatsappNumber: v.whatsappNumber || null,
        address: v.address || null,
        primaryColor: v.primaryColor || null,
        secondaryColor: v.secondaryColor || null,
        accentColor: v.accentColor || null,
        logoUrl: v.logoUrl || null,
        tagline: v.tagline || null,
        website: v.website || null,
        ...(mode === "edit"
          ? {
              subscription: {
                plan: v.subscriptionPlan,
                status: v.subscriptionStatus,
              },
            }
          : {}),
      };
      const url =
        mode === "create"
          ? "/api/admin/clinics"
          : `/api/admin/clinics/${v.id}`;
      const r = await fetch(url, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        toast.error(j.error ?? "Save failed");
        return;
      }
      toast.success(mode === "create" ? "Clinic created" : "Clinic saved");
      router.push("/admin/clinics");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      className="space-y-6"
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Identity</CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          <Field label="Clinic name" required>
            <Input value={v.name} onChange={(e) => set("name", e.target.value)} required />
          </Field>
          <Field label="Slug" required hint="URL key — lowercase, hyphens.">
            <Input
              value={v.slug}
              onChange={(e) => set("slug", e.target.value.toLowerCase())}
              disabled={mode === "edit"}
              required
            />
          </Field>
          <Field label="Tagline" className="sm:col-span-2">
            <Input value={v.tagline} onChange={(e) => set("tagline", e.target.value)} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Branding</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <LogoUploader
            value={v.logoUrl || null}
            onUpload={async () => {
              toast.message("Logo upload arrives in Sprint 2");
              return v.logoUrl;
            }}
            onRemove={() => set("logoUrl", "")}
          />
          <Field label="Logo URL" hint="Direct image URL — used until storage upload lands.">
            <Input value={v.logoUrl} onChange={(e) => set("logoUrl", e.target.value)} />
          </Field>
          <div className="grid sm:grid-cols-3 gap-4">
            <Field label="Primary color">
              <ColorInput value={v.primaryColor} onChange={(s) => set("primaryColor", s)} />
            </Field>
            <Field label="Secondary color">
              <ColorInput value={v.secondaryColor} onChange={(s) => set("secondaryColor", s)} />
            </Field>
            <Field label="Accent color">
              <ColorInput value={v.accentColor} onChange={(s) => set("accentColor", s)} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contact</CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          <Field label="WhatsApp number" hint="E.164, e.g. +91987...">
            <Input value={v.whatsappNumber} onChange={(e) => set("whatsappNumber", e.target.value)} />
          </Field>
          <Field label="Phone">
            <Input value={v.phone} onChange={(e) => set("phone", e.target.value)} />
          </Field>
          <Field label="Email">
            <Input type="email" value={v.email} onChange={(e) => set("email", e.target.value)} />
          </Field>
          <Field label="Website">
            <Input type="url" value={v.website} onChange={(e) => set("website", e.target.value)} />
          </Field>
          <Field label="Address" className="sm:col-span-2">
            <Textarea value={v.address} onChange={(e) => set("address", e.target.value)} rows={2} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Locale & timezone</CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-3 gap-4">
          <Field label="Region">
            <Input value={v.region} onChange={(e) => set("region", e.target.value)} />
          </Field>
          <Field label="Default language">
            <select
              value={v.language}
              onChange={(e) => set("language", e.target.value)}
              className="h-9 px-2 rounded-md border border-border bg-background text-sm w-full"
            >
              {["en", "hi", "mr", "gu", "pa", "ta", "te"].map((l) => (
                <option key={l} value={l}>
                  {l.toUpperCase()}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Timezone">
            <select
              value={v.timezone}
              onChange={(e) => set("timezone", e.target.value)}
              className="h-9 px-2 rounded-md border border-border bg-background text-sm w-full"
            >
              {TIMEZONES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
        </CardContent>
      </Card>

      {mode === "edit" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Subscription</CardTitle>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-4">
            <Field label="Plan">
              <select
                value={v.subscriptionPlan}
                onChange={(e) => set("subscriptionPlan", e.target.value)}
                className="h-9 px-2 rounded-md border border-border bg-background text-sm w-full"
              >
                {PLANS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Status">
              <select
                value={v.subscriptionStatus}
                onChange={(e) => set("subscriptionStatus", e.target.value)}
                className="h-9 px-2 rounded-md border border-border bg-background text-sm w-full"
              >
                {SUB_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : mode === "create" ? "Create clinic" : "Save changes"}
        </Button>
      </div>
    </form>
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
      <Label>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

function ColorInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value || "#000000"}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-9 rounded-md border border-border bg-background cursor-pointer"
      />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="#000000"
        className="flex-1"
      />
    </div>
  );
}
