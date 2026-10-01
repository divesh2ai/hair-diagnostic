"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Loader2, LogOut, Languages, Palette, ShieldCheck } from "lucide-react";
import { PageContainer } from "@/components/app-shell";
import { SignOutForm } from "@/components/app-shell/SignOutForm";
import { LanguageSelector } from "@/components/ui/language-selector";
import {
  BADGE_THEMES,
  DEFAULT_BADGE_THEME,
  getBadgeTheme,
  readStoredBadgeTheme,
  writeBadgeTheme,
  type BadgeThemeId,
} from "@/lib/doctor/badgeThemes";

// Doctor Settings = operational utilities that are GENUINELY WIRED to a
// backend. Every control here does something real:
//
//   • Account / Sign out → POST /auth/signout (the same endpoint the header
//     UserMenu uses).
//   • Workspace language → the app-shell locale cookie via <LanguageSelector>
//     (useI18n().setLocale) — the same switch as the header, exposed here
//     where users look for it.
//   • Workspace accent → PATCH /api/doctor/me { badgeTheme }, persisted
//     server-side so the pick survives across devices and preview origins.
//
// Deliberately NOT here: AI-model pickers, logo/avatar/video/signature
// uploads, consultation-duration and prescription-refill fields, and the
// old "Save preferences" button — none of those had a backend, so they were
// preview-only mockups that saved nothing. Signature and registration are
// authored on the Clinic Admin doctor editor and shown read-only on the
// Doctor Profile. Adding a control here that persists nothing would be worse
// than not having it, so they are gone rather than faked.

type DoctorMe = {
  clinic: { name: string | null } | null;
  doctor: { badgeTheme: string | null } | null;
  role: string;
  email: string | null;
};

const ROLE_LABEL: Record<string, string> = {
  DOCTOR: "Doctor",
  SUPER_ADMIN: "Super Admin",
  CLINIC_ADMIN: "Clinic Admin",
};

export default function DoctorSettingsPage() {
  const [me, setMe] = useState<DoctorMe | null>(null);
  const [badgeThemeId, setBadgeThemeId] = useState<BadgeThemeId>(DEFAULT_BADGE_THEME);
  const [savingAccent, setSavingAccent] = useState(false);

  useEffect(() => {
    setBadgeThemeId(readStoredBadgeTheme());
    fetch("/api/doctor/me")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((data: DoctorMe) => {
        setMe(data);
        const server = data.doctor?.badgeTheme;
        if (server && server !== readStoredBadgeTheme()) {
          setBadgeThemeId(server as BadgeThemeId);
          writeBadgeTheme(server as BadgeThemeId);
        }
      })
      .catch((e) => toast.error(`Could not load settings: ${e}`));
  }, []);

  const badgeTheme = getBadgeTheme(badgeThemeId);

  const pickBadgeTheme = async (id: BadgeThemeId) => {
    // Optimistic: local cache + UI first, then persist to server.
    const previous = badgeThemeId;
    setBadgeThemeId(id);
    writeBadgeTheme(id);
    setSavingAccent(true);
    try {
      const res = await fetch("/api/doctor/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ badgeTheme: id }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Workspace accent updated");
    } catch (err) {
      // Roll back on failure so the UI never claims a save that did not land.
      setBadgeThemeId(previous);
      writeBadgeTheme(previous);
      toast.error(
        err instanceof Error ? `Could not save: ${err.message}` : "Could not save accent",
      );
    } finally {
      setSavingAccent(false);
    }
  };

  const email = me?.email ?? null;
  const roleLabel = me ? (ROLE_LABEL[me.role] ?? me.role) : null;
  const clinicName = me?.clinic?.name ?? null;

  return (
    <PageContainer className="space-y-6 max-w-3xl">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-700">
          Dr FACT · Workspace
        </p>
        <h1 className="font-serif text-3xl font-medium tracking-tight text-slate-900">
          Settings
        </h1>
        <p className="text-sm text-slate-500">
          Account, language and workspace preferences. Your professional identity
          lives in{" "}
          <a href="/doctor/profile" className="font-medium text-teal-700 underline">
            Profile
          </a>
          .
        </p>
      </div>

      {/* ── Account & session ── */}
      <Section id="account" icon={ShieldCheck} title="Account" hint="Your session and sign-in">
        <dl className="space-y-2.5 text-sm">
          <Row label="Signed in as" value={email ?? "—"} />
          <Row label="Role" value={roleLabel ?? "—"} />
          {clinicName && <Row label="Clinic" value={clinicName} />}
        </dl>
        <p className="mt-4 text-xs text-slate-500">
          HairOS uses secure one-time-passcode / magic-link sign-in — there is no
          password to manage. Sign out to end this session on this device.
        </p>
        <div className="mt-4">
          <SignOutForm>
            {({ submit }) => (
              <button
                type="button"
                onClick={submit}
                className="inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
              >
                <LogOut className="size-4" />
                Sign out
              </button>
            )}
          </SignOutForm>
        </div>
      </Section>

      {/* ── Language ── */}
      <Section
        id="language"
        icon={Languages}
        title="Workspace language"
        hint="Display language for the doctor workspace"
      >
        <LanguageSelector />
        <p className="mt-3 text-xs text-slate-500">
          Changes the language of the workspace interface immediately. This is the
          same switch shown in the header.
        </p>
      </Section>

      {/* ── Workspace accent (moved from Profile — it is a preference, not identity) ── */}
      <Section
        id="accent"
        icon={Palette}
        title="Workspace accent"
        hint="Colour used on your identity card and clinical workspace"
      >
        <div className="flex flex-wrap gap-2.5">
          {BADGE_THEMES.map((t) => {
            const active = t.id === badgeThemeId;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => pickBadgeTheme(t.id)}
                disabled={savingAccent}
                aria-label={t.label}
                aria-pressed={active}
                title={t.label}
                className={`relative inline-flex size-9 items-center justify-center rounded-full ring-2 transition-transform duration-200 focus-visible:outline-none focus-visible:ring-teal-500 disabled:opacity-60 ${
                  active ? "ring-slate-900 scale-110" : "ring-stone-200 hover:scale-105"
                }`}
                style={{ backgroundColor: t.swatch }}
              >
                {active && <Check className="size-4 text-white drop-shadow" />}
              </button>
            );
          })}
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-stone-500">
          {savingAccent && <Loader2 className="size-3 animate-spin" />}
          Selected:{" "}
          <span className="font-medium text-slate-800">{badgeTheme.label}</span>
        </p>
      </Section>

      <footer className="pt-6 text-center text-[11px] text-stone-400">
        Dr FACT — powered by HairOS Intelligence
      </footer>
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
  icon: typeof ShieldCheck;
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-xs font-medium uppercase tracking-[0.1em] text-slate-500">
        {label}
      </dt>
      <dd className="min-w-0 truncate text-sm font-medium text-slate-800">{value}</dd>
    </div>
  );
}
