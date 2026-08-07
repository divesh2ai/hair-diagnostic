"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { UserRound, Upload, Loader2, BadgeCheck, Check } from "lucide-react";
import { PageContainer } from "@/components/app-shell";
import {
  BADGE_THEMES,
  DEFAULT_BADGE_THEME,
  getBadgeTheme,
  readStoredBadgeTheme,
  writeBadgeTheme,
  type BadgeThemeId,
} from "@/lib/doctor/badgeThemes";

type DoctorMe = {
  clinic: { name: string; logoUrl: string | null; tagline: string | null } | null;
  doctor: { id: string; name: string | null; photoUrl: string | null; specialization: string | null } | null;
  role: string;
  email: string | null;
};

export default function DoctorProfilePage() {
  const [me, setMe] = useState<DoctorMe | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [badgeThemeId, setBadgeThemeId] = useState<BadgeThemeId>(DEFAULT_BADGE_THEME);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setBadgeThemeId(readStoredBadgeTheme());
    fetch("/api/doctor/me")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then(setMe)
      .catch((e) => toast.error(`Could not load profile: ${e}`));
  }, []);

  const badgeTheme = getBadgeTheme(badgeThemeId);

  const pickBadgeTheme = (id: BadgeThemeId) => {
    setBadgeThemeId(id);
    writeBadgeTheme(id);
    toast.success("Badge color updated");
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) {
      toast.error("Only JPEG, PNG, or WebP images are allowed");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }
    setPreview(URL.createObjectURL(f));
  };

  const upload = async () => {
    const f = fileRef.current?.files?.[0];
    if (!f) {
      toast.error("Choose an image first");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", f);
      const res = await fetch("/api/doctor/me/avatar", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Upload failed");
      toast.success("Profile photo updated");
      setMe((prev) =>
        prev?.doctor
          ? { ...prev, doctor: { ...prev.doctor, photoUrl: data.avatarUrl } }
          : prev,
      );
      setPreview(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const currentAvatar = preview ?? me?.doctor?.photoUrl ?? null;
  const displayName = me?.doctor?.name ?? me?.email ?? "Doctor";

  return (
    <PageContainer className="space-y-6 max-w-3xl">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-700">
          Doctor · Profile
        </p>
        <h1 className="font-serif text-3xl font-medium tracking-tight text-slate-900">
          Your profile
        </h1>
        <p className="text-sm text-slate-500">
          Upload a clinician photo. It appears in the header, greetings, and on
          patient handoff surfaces.
        </p>
      </div>

      {/* ── Live preview card — mirrors the /doctor hero identity card ── */}
      <section
        className={`relative rounded-2xl border border-stone-200 bg-gradient-to-br ${badgeTheme.cardAccent} p-5 pt-7 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.15)]`}
      >
        <span
          className={`absolute -top-2 left-5 inline-flex items-center gap-1 rounded-full ${badgeTheme.chipBg} px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] ${badgeTheme.chipText} ring-1 ${badgeTheme.chipRing} shadow-sm`}
        >
          <BadgeCheck className="size-3" />
          Live preview
        </span>
        <div className="flex items-center gap-5">
          <div className={`relative size-24 shrink-0 overflow-hidden rounded-full bg-white ring-2 ${badgeTheme.avatarRing} shadow-md`}>
            {currentAvatar ? (
              <Image
                src={currentAvatar}
                alt={displayName}
                fill
                sizes="96px"
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-stone-400">
                <UserRound className="size-10" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-serif text-xl leading-tight text-slate-900 truncate">{displayName}</p>
            {me?.doctor?.specialization && (
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500 truncate">
                {me.doctor.specialization}
              </p>
            )}
            {me?.clinic?.name && (
              <p className="mt-2 text-xs text-stone-600 truncate">
                <span className="text-stone-400">at </span>
                {me.clinic.name}
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-5 space-y-5">
        <div className="space-y-3">
          <label className="text-sm font-medium text-slate-800">
            Upload a new photo
          </label>
          <p className="text-xs text-slate-500">
            JPEG, PNG, or WebP · square recommended · up to 5 MB
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={onPick}
              className="text-sm file:mr-3 file:rounded-md file:border file:border-stone-200 file:bg-stone-50 file:px-3 file:py-1.5 file:text-sm file:text-slate-700 hover:file:bg-stone-100"
            />
            <button
              type="button"
              disabled={uploading || !preview}
              onClick={upload}
              className="inline-flex items-center gap-1.5 rounded-md bg-teal-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              {uploading ? "Uploading…" : "Save photo"}
            </button>
          </div>
        </div>

        <div className="space-y-3 border-t border-stone-100 pt-4">
          <div>
            <label className="text-sm font-medium text-slate-800">
              Badge color
            </label>
            <p className="text-xs text-slate-500 mt-0.5">
              Choose the accent that best matches your portrait. The card on
              your dashboard hero updates instantly.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {BADGE_THEMES.map((t) => {
              const active = t.id === badgeThemeId;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => pickBadgeTheme(t.id)}
                  aria-label={t.label}
                  title={t.label}
                  className={`relative inline-flex size-9 items-center justify-center rounded-full ring-2 transition-transform ${
                    active
                      ? "ring-slate-900 scale-110"
                      : "ring-stone-200 hover:scale-105"
                  }`}
                  style={{ backgroundColor: t.swatch }}
                >
                  {active && <Check className="size-4 text-white drop-shadow" />}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-stone-500">
            Selected: <span className="font-medium text-slate-800">{badgeTheme.label}</span>
          </p>
        </div>
      </section>
    </PageContainer>
  );
}
