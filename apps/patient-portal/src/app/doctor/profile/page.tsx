"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import {
  Upload,
  Loader2,
  Check,
  Camera,
  X,
  MapPin,
  ShieldCheck,
} from "lucide-react";
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
  clinic: {
    name: string;
    logoUrl: string | null;
    tagline: string | null;
    region: string | null;
  } | null;
  doctor: {
    id: string;
    name: string | null;
    photoUrl: string | null;
    specialization: string | null;
    badgeTheme: string | null;
  } | null;
  role: string;
  email: string | null;
};

function initialsOf(name: string): string {
  const parts = name.split(/\s+/).filter((p) => !/^(dr\.?|prof\.?)$/i.test(p));
  const words = parts.length ? parts : name.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "•";
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (words[0]![0]! + words[words.length - 1]![0]!).toUpperCase();
}

export default function DoctorProfilePage() {
  const [me, setMe] = useState<DoctorMe | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [badgeThemeId, setBadgeThemeId] = useState<BadgeThemeId>(DEFAULT_BADGE_THEME);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // localStorage is the immediate first-paint cache; the server value
    // (loaded below) is the source of truth and overrides it once the
    // /api/doctor/me response lands. This is the ONLY fetch on this page —
    // name/photo/clinic/specialization all arrive in this single call.
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
      .catch((e) => toast.error(`Could not load profile: ${e}`));
  }, []);

  const badgeTheme = getBadgeTheme(badgeThemeId);

  const pickBadgeTheme = async (id: BadgeThemeId) => {
    // Optimistic: local cache + UI update first, then persist to server.
    setBadgeThemeId(id);
    writeBadgeTheme(id);
    try {
      const res = await fetch("/api/doctor/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ badgeTheme: id }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Profile accent updated");
    } catch (err) {
      toast.error(
        err instanceof Error
          ? `Could not save: ${err.message}`
          : "Could not save profile accent",
      );
    }
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) {
      toast.error("Only JPEG, PNG, or WebP images are allowed");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5 MB");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setPreview(URL.createObjectURL(f));
  };

  const cancelPick = () => {
    setPreview(null);
    if (fileRef.current) fileRef.current.value = "";
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

  const savedAvatar = me?.doctor?.photoUrl ?? null;
  const currentAvatar = preview ?? savedAvatar;
  const displayName = me?.doctor?.name ?? me?.email ?? "Doctor";
  const initials = useMemo(() => initialsOf(displayName), [displayName]);
  const specialty = me?.doctor?.specialization ?? null;
  const clinic = me?.clinic ?? null;

  return (
    <PageContainer className="max-w-6xl pb-28 space-y-8">
      {/* ── Editorial page heading ── */}
      <header className="space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-700">
          Doctor Profile
        </p>
        <h1 className="font-serif text-[2rem] leading-tight font-medium tracking-tight text-slate-900 sm:text-4xl">
          Your professional identity
        </h1>
        <p className="max-w-xl text-sm text-slate-500">
          Manage how you appear across HairOS clinical reviews, patient handoffs
          and clinic communications.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── LEFT column (~65%) ── */}
        <div className="space-y-6 lg:col-span-2">
          {/* Professional profile hero */}
          <section
            className={`relative overflow-hidden rounded-3xl border border-stone-200 bg-gradient-to-br ${badgeTheme.cardAccent} p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_18px_40px_-24px_rgba(15,23,42,0.25)] sm:p-8`}
          >
            <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
              Professional profile
            </p>
            <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:items-center sm:text-left">
              {/* Portrait — the strongest element on the page. Clicking or
                  keyboard-activating it opens the file picker. */}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                aria-label="Change profile photo"
                className={`group relative size-28 shrink-0 overflow-hidden rounded-full bg-white ring-4 ${badgeTheme.avatarRing} shadow-lg outline-none transition-transform duration-200 hover:scale-[1.02] focus-visible:ring-4 focus-visible:ring-teal-500/60 sm:size-36`}
              >
                {currentAvatar ? (
                  <Image
                    src={currentAvatar}
                    alt={displayName}
                    fill
                    sizes="144px"
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <span
                    className="flex h-full w-full items-center justify-center bg-gradient-to-br from-stone-100 to-stone-200 font-serif text-4xl font-medium text-stone-500"
                    aria-hidden="true"
                  >
                    {initials}
                  </span>
                )}
                {/* Hover overlay */}
                <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-slate-900/70 py-1.5 text-[11px] font-medium text-white opacity-0 backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
                  <Camera className="size-3" />
                  Change
                </span>
              </button>

              <div className="min-w-0 flex-1">
                <h2 className="font-serif text-[1.7rem] leading-tight text-slate-900 sm:text-3xl">
                  {displayName}
                </h2>
                {specialty && (
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
                    {specialty}
                  </p>
                )}

                {clinic?.name && (
                  <div className="mt-3 flex items-center justify-center gap-2 sm:justify-start">
                    <ClinicLogo clinic={clinic} className="size-6 rounded-md" />
                    <span className="truncate text-sm font-semibold text-slate-700">
                      {clinic.name}
                    </span>
                  </div>
                )}

                <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  Profile active
                </div>
              </div>
            </div>
          </section>

          {/* Photo management */}
          <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-7">
            <h3 className="text-base font-semibold text-slate-900">Profile photo</h3>
            <p className="mt-1 text-sm text-slate-500">
              Appears in the workspace header, greetings and on patient handoff
              surfaces.
            </p>

            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={onPick}
              className="sr-only"
            />

            <div className="mt-5 flex flex-wrap items-center gap-4">
              <div
                className={`relative size-20 shrink-0 overflow-hidden rounded-2xl bg-stone-50 ring-1 ${preview ? "ring-teal-400" : "ring-stone-200"}`}
              >
                {currentAvatar ? (
                  <Image
                    src={currentAvatar}
                    alt="Current profile photo"
                    fill
                    sizes="80px"
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center font-serif text-lg font-medium text-stone-400">
                    {initials}
                  </span>
                )}
              </div>

              <div className="min-w-0 space-y-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Camera className="size-4" />
                    {savedAvatar ? "Change photo" : "Upload photo"}
                  </button>

                  {preview && (
                    <>
                      <button
                        type="button"
                        disabled={uploading}
                        onClick={upload}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {uploading ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Upload className="size-4" />
                        )}
                        {uploading ? "Saving…" : "Save photo"}
                      </button>
                      <button
                        type="button"
                        disabled={uploading}
                        onClick={cancelPick}
                        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-stone-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:opacity-50"
                      >
                        <X className="size-4" />
                        Cancel
                      </button>
                    </>
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  {preview ? (
                    <span className="font-medium text-teal-700">
                      New photo selected — save to apply.
                    </span>
                  ) : (
                    "JPEG, PNG or WebP · Max 5 MB · Square image recommended"
                  )}
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* ── RIGHT column (~35%) ── */}
        <div className="space-y-6">
          {/* Clinic affiliation */}
          <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
              Clinic affiliation
            </p>
            {clinic ? (
              <div className="mt-4 flex items-start gap-3">
                <ClinicLogo
                  clinic={clinic}
                  className="size-12 rounded-xl"
                  monoClass="text-base"
                />
                <div className="min-w-0 pt-0.5">
                  <div className="text-base font-semibold leading-snug text-slate-900 line-clamp-2">
                    {clinic.name}
                  </div>
                  {clinic.region && (
                    <div className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                      <MapPin className="size-3 shrink-0" />
                      <span className="truncate">{clinic.region}</span>
                    </div>
                  )}
                  <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-700 ring-1 ring-teal-200">
                    <ShieldCheck className="size-3" />
                    Active clinic
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">
                No clinic affiliation on file.
              </p>
            )}
          </section>

          {/* Profile accent */}
          <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
              Profile accent
            </p>
            <p className="mt-1.5 text-xs text-slate-500">
              Used subtly on your doctor identity card and clinical workspace.
            </p>
            <div className="mt-4 flex flex-wrap gap-2.5">
              {BADGE_THEMES.map((t) => {
                const active = t.id === badgeThemeId;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => pickBadgeTheme(t.id)}
                    aria-label={t.label}
                    aria-pressed={active}
                    title={t.label}
                    className={`relative inline-flex size-9 items-center justify-center rounded-full ring-2 transition-transform duration-200 focus-visible:outline-none focus-visible:ring-teal-500 ${
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
            <p className="mt-3 text-[11px] text-stone-500">
              Selected:{" "}
              <span className="font-medium text-slate-800">{badgeTheme.label}</span>
            </p>
          </section>

          {/* Where this appears */}
          <section className="rounded-3xl border border-stone-200 bg-stone-50/60 p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
              Where this appears
            </p>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              {["Workspace header", "Patient handoff", "Clinical report surfaces"].map(
                (item) => (
                  <li key={item} className="flex items-center gap-2">
                    <span className="size-1.5 rounded-full bg-teal-500" />
                    {item}
                  </li>
                ),
              )}
            </ul>
          </section>
        </div>
      </div>
    </PageContainer>
  );
}

// Clinic logo with a graceful monogram fallback. Uses the real Clinic.logoUrl
// when present; otherwise a polished initials mark derived from the name.
function ClinicLogo({
  clinic,
  className,
  monoClass,
}: {
  clinic: { name: string; logoUrl: string | null };
  className?: string;
  monoClass?: string;
}) {
  if (clinic.logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={clinic.logoUrl}
        alt={`${clinic.name} logo`}
        className={`shrink-0 bg-white object-cover ring-1 ring-stone-200 ${className ?? ""}`}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center bg-gradient-to-br from-teal-600 to-teal-700 font-semibold text-white shadow-sm ${monoClass ?? "text-[11px]"} ${className ?? ""}`}
    >
      {initialsOf(clinic.name)}
    </span>
  );
}
