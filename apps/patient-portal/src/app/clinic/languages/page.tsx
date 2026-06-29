"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { PageContainer } from "@/components/app-shell";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingState, ErrorState } from "@/components/ui/states";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/lib/i18n";
import { toast } from "@/components/ui/toast";

const ENUM_LANGS = ["EN", "HI", "MR", "GU", "PA", "TA", "TE"] as const;
type EnumLang = (typeof ENUM_LANGS)[number];

const TO_ENUM: Record<Locale, EnumLang> = {
  en: "EN", hi: "HI", mr: "MR", gu: "GU", pa: "PA", ta: "TA", te: "TE",
};
const TO_LOCALE: Record<EnumLang, Locale> = {
  EN: "en", HI: "hi", MR: "mr", GU: "gu", PA: "pa", TA: "ta", TE: "te",
};

export default function ClinicLanguagesPage() {
  const [enabled, setEnabled] = useState<EnumLang[]>([]);
  const [defaultLang, setDefaultLang] = useState<EnumLang>("EN");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/clinic/languages", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((j) => {
        setEnabled(j.supportedLanguages);
        // server returns BCP-47-ish "en" via clinic.language; normalize.
        const def = (j.defaultLanguage as string).toUpperCase() as EnumLang;
        setDefaultLang(def);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  function toggle(l: EnumLang) {
    setEnabled((prev) =>
      prev.includes(l) ? prev.filter((x) => x !== l) : [...prev, l],
    );
  }

  async function save() {
    if (enabled.length === 0) {
      toast.error("Enable at least one language");
      return;
    }
    if (!enabled.includes(defaultLang)) {
      toast.error("Default language must be enabled");
      return;
    }
    setBusy(true);
    const r = await fetch("/api/clinic/languages", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ supportedLanguages: enabled, defaultLanguage: defaultLang }),
    });
    setBusy(false);
    if (!r.ok) {
      toast.error("Save failed");
      return;
    }
    toast.success("Languages updated");
  }

  if (error) return <PageContainer><ErrorState title="Couldn't load languages" description={error} /></PageContainer>;
  if (loading) return <PageContainer><LoadingState /></PageContainer>;

  return (
    <PageContainer className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Languages</h1>
        <p className="text-sm text-muted-foreground">
          Choose which languages patients can pick from at QR landing.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Supported languages</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {LOCALES.map((loc) => {
            const e = TO_ENUM[loc as Locale];
            const on = enabled.includes(e);
            return (
              <button
                key={loc}
                type="button"
                onClick={() => toggle(e)}
                className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-md hover:bg-muted text-left"
              >
                <div>
                  <div className="text-sm font-medium">{LOCALE_LABELS[loc as Locale].native}</div>
                  <div className="text-xs text-muted-foreground">{LOCALE_LABELS[loc as Locale].english}</div>
                </div>
                <span className={`size-5 rounded-full border ${on ? "bg-primary border-primary text-primary-foreground" : "border-border"} flex items-center justify-center`}>
                  {on && <Check className="size-3" />}
                </span>
              </button>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Default language</CardTitle></CardHeader>
        <CardContent>
          <select
            value={defaultLang}
            onChange={(e) => setDefaultLang(e.target.value as EnumLang)}
            className="h-9 px-2 rounded-md border border-border bg-background text-sm w-full max-w-xs"
          >
            {enabled.map((l) => (
              <option key={l} value={l}>
                {LOCALE_LABELS[TO_LOCALE[l]].native} — {l}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground mt-2">
            Applied when a patient hasn't picked a language explicitly.
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => void save()} disabled={busy}>
          {busy ? "Saving…" : "Save languages"}
        </Button>
      </div>
    </PageContainer>
  );
}
