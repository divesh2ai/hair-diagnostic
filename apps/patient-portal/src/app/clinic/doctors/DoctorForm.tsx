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

export type DoctorFormValues = {
  id?: string;
  name: string;
  email: string;
  phone: string;
  qualification: string;
  registrationNumber: string;
  biography: string;
  specialization: string;
  preferredLanguage: "EN" | "HI" | "MR" | "GU" | "PA" | "TA" | "TE";
  avatarUrl: string;
  signatureUrl: string;
  isActive: boolean;
};

const EMPTY: DoctorFormValues = {
  name: "",
  email: "",
  phone: "",
  qualification: "",
  registrationNumber: "",
  biography: "",
  specialization: "",
  preferredLanguage: "EN",
  avatarUrl: "",
  signatureUrl: "",
  isActive: true,
};

export function DoctorForm({
  initial,
  mode,
}: {
  initial?: Partial<DoctorFormValues>;
  mode: "create" | "edit";
}) {
  const router = useRouter();
  const [v, setV] = useState<DoctorFormValues>({ ...EMPTY, ...initial });
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof DoctorFormValues>(k: K, val: DoctorFormValues[K]) =>
    setV((s) => ({ ...s, [k]: val }));

  async function save() {
    setBusy(true);
    try {
      const body = {
        name: v.name,
        email: v.email,
        phone: v.phone || null,
        qualification: v.qualification || null,
        registrationNumber: v.registrationNumber || null,
        biography: v.biography || null,
        specialization: v.specialization || null,
        preferredLanguage: v.preferredLanguage,
        avatarUrl: v.avatarUrl || null,
        signatureUrl: v.signatureUrl || null,
        ...(mode === "edit" ? { isActive: v.isActive } : {}),
      };
      const url =
        mode === "create"
          ? "/api/clinic/doctors"
          : `/api/clinic/doctors/${v.id}`;
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
      toast.success(mode === "create" ? "Doctor added" : "Doctor saved");
      router.push("/clinic/doctors");
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
        <CardContent className="space-y-4">
          <LogoUploader
            value={v.avatarUrl || null}
            label="Upload avatar"
            hint="JPG/PNG up to 4 MB. Square images render best."
            onUpload={async () => {
              toast.message("Avatar upload arrives in Sprint 2");
              return v.avatarUrl;
            }}
            onRemove={() => set("avatarUrl", "")}
          />
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Avatar URL" hint="Direct image URL — used until storage upload lands.">
              <Input value={v.avatarUrl} onChange={(e) => set("avatarUrl", e.target.value)} />
            </Field>
            <Field label="Signature URL">
              <Input value={v.signatureUrl} onChange={(e) => set("signatureUrl", e.target.value)} />
            </Field>
            <Field label="Full name" required>
              <Input value={v.name} onChange={(e) => set("name", e.target.value)} required />
            </Field>
            <Field label="Specialization">
              <Input value={v.specialization} onChange={(e) => set("specialization", e.target.value)} />
            </Field>
            <Field label="Qualification">
              <Input value={v.qualification} onChange={(e) => set("qualification", e.target.value)} placeholder="MBBS, MD" />
            </Field>
            <Field label="Registration number">
              <Input value={v.registrationNumber} onChange={(e) => set("registrationNumber", e.target.value)} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contact & preferences</CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          <Field label="Email" required>
            <Input type="email" value={v.email} onChange={(e) => set("email", e.target.value)} required />
          </Field>
          <Field label="Phone (WhatsApp)">
            <Input value={v.phone} onChange={(e) => set("phone", e.target.value)} />
          </Field>
          <Field label="Preferred language">
            <select
              value={v.preferredLanguage}
              onChange={(e) =>
                set(
                  "preferredLanguage",
                  e.target.value as DoctorFormValues["preferredLanguage"],
                )
              }
              className="h-9 px-2 rounded-md border border-border bg-background text-sm w-full"
            >
              {(["EN", "HI", "MR", "GU", "PA", "TA", "TE"] as const).map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          {mode === "edit" && (
            <Field label="Status">
              <select
                value={v.isActive ? "1" : "0"}
                onChange={(e) => set("isActive", e.target.value === "1")}
                className="h-9 px-2 rounded-md border border-border bg-background text-sm w-full"
              >
                <option value="1">Active</option>
                <option value="0">Inactive</option>
              </select>
            </Field>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Biography</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            rows={6}
            value={v.biography}
            onChange={(e) => set("biography", e.target.value)}
            placeholder="Background shown on reports and the public clinic page."
          />
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : mode === "create" ? "Add doctor" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}
