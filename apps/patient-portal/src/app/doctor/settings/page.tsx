"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Sparkles,
  Languages,
  ImageIcon,
  Video,
  Stethoscope,
  Pill,
  Upload,
} from "lucide-react";
import { PageContainer } from "@/components/app-shell";

type AiModel = "drfact-1" | "drfact-1-mini" | "claude-sonnet" | "gpt-4o";
type Lang = "en" | "hi" | "mr" | "ta" | "te" | "bn" | "gu";

const AI_MODELS: { id: AiModel; label: string; hint: string }[] = [
  { id: "drfact-1",      label: "DrFACT v1",      hint: "Default clinical model" },
  { id: "drfact-1-mini", label: "DrFACT v1 mini", hint: "Faster, lower cost" },
  { id: "claude-sonnet", label: "Claude Sonnet",  hint: "Long-form reasoning" },
  { id: "gpt-4o",        label: "GPT-4o",         hint: "External fallback" },
];

const LANGS: { id: Lang; label: string }[] = [
  { id: "en", label: "English" },
  { id: "hi", label: "हिन्दी" },
  { id: "mr", label: "मराठी" },
  { id: "ta", label: "தமிழ்" },
  { id: "te", label: "తెలుగు" },
  { id: "bn", label: "বাংলা" },
  { id: "gu", label: "ગુજરાતી" },
];

export default function DoctorSettingsPage() {
  const [ai, setAi] = useState<AiModel>("drfact-1");
  const [lang, setLang] = useState<Lang>("en");
  const [consultDuration, setConsultDuration] = useState(20);
  const [requireSig, setRequireSig] = useState(true);
  const [avatarVideo, setAvatarVideo] = useState(false);
  const [refillDays, setRefillDays] = useState(30);

  const handleUpload = (kind: string) => () =>
    toast.message(`${kind} upload`, { description: "Arrives in Sprint 2" });

  const save = () => toast.success("Preferences saved");

  return (
    <PageContainer className="space-y-6 max-w-3xl">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-700">
          DrFACT · Workspace
        </p>
        <h1 className="font-serif text-3xl font-medium tracking-tight text-slate-900">
          Doctor customization
        </h1>
        <p className="text-sm text-slate-500">
          Personal preferences for AI, language, branding, and consultations.
        </p>
      </div>

      <Section id="ai" icon={Sparkles} title="Doctor AI" hint="Model used for narrative + insights">
        <div className="grid sm:grid-cols-2 gap-2">
          {AI_MODELS.map((m) => (
            <label
              key={m.id}
              className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
                ai === m.id ? "border-sky-400 bg-sky-50/40" : "border-stone-200 hover:bg-stone-50"
              }`}
            >
              <input
                type="radio"
                name="ai"
                checked={ai === m.id}
                onChange={() => setAi(m.id)}
                className="mt-1"
              />
              <div>
                <p className="text-sm font-medium text-slate-800">{m.label}</p>
                <p className="text-xs text-slate-500">{m.hint}</p>
              </div>
            </label>
          ))}
        </div>
      </Section>

      <Section id="language" icon={Languages} title="Preferred language" hint="Default for new reports and patient handoffs">
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value as Lang)}
          className="w-full max-w-xs rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"
        >
          {LANGS.map((l) => (
            <option key={l.id} value={l.id}>{l.label}</option>
          ))}
        </select>
      </Section>

      <Section id="logo" icon={ImageIcon} title="Brand logo" hint="Header chrome and PDF letterhead">
        <UploadButton label="Upload logo" onClick={handleUpload("Logo")} />
      </Section>

      <Section id="avatar" icon={Video} title="Avatar & video" hint="Patient handoff intro video">
        <div className="space-y-3">
          <UploadButton label="Upload avatar" onClick={handleUpload("Avatar")} />
          <label className="flex items-center gap-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={avatarVideo}
              onChange={(e) => setAvatarVideo(e.target.checked)}
            />
            Auto-generate handoff video on report approval
          </label>
        </div>
      </Section>

      <Section id="consultation" icon={Stethoscope} title="Consultation" hint="Defaults for new sessions">
        <div className="space-y-3">
          <Field label="Default session duration (minutes)">
            <input
              type="number"
              min={5}
              max={180}
              value={consultDuration}
              onChange={(e) => setConsultDuration(Number(e.target.value))}
              className="w-32 rounded-lg border border-stone-200 px-3 py-2 text-sm"
            />
          </Field>
          <label className="flex items-center gap-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={requireSig}
              onChange={(e) => setRequireSig(e.target.checked)}
            />
            Require my signature before report goes to patient
          </label>
        </div>
      </Section>

      <Section id="prescription" icon={Pill} title="Prescription defaults" hint="Refill window, signature, dosage style">
        <div className="space-y-3">
          <Field label="Default refill window (days)">
            <input
              type="number"
              min={7}
              max={180}
              value={refillDays}
              onChange={(e) => setRefillDays(Number(e.target.value))}
              className="w-32 rounded-lg border border-stone-200 px-3 py-2 text-sm"
            />
          </Field>
          <UploadButton label="Upload signature image" onClick={handleUpload("Signature")} />
        </div>
      </Section>

      <div className="flex justify-end">
        <button
          onClick={save}
          className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Save preferences
        </button>
      </div>
    </PageContainer>
  );
}

function Section({
  id,
  icon: Icon,
  title,
  hint,
  children,
}: {
  id: string;
  icon: typeof Sparkles;
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="rounded-2xl bg-white border border-stone-200 shadow-sm">
      <div className="px-5 py-4 border-b border-stone-200 flex items-center gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-stone-50 text-slate-700">
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <h2 className="font-serif text-lg text-slate-900">{title}</h2>
          <p className="text-xs text-slate-500">{hint}</p>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}

function UploadButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-lg border border-dashed border-stone-300 bg-stone-50 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white hover:border-stone-400"
    >
      <Upload className="h-4 w-4" />
      {label}
    </button>
  );
}
