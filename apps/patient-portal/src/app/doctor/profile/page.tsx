"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import {
  Upload,
  Loader2,
  Camera,
  X,
  MapPin,
  ShieldCheck,
  Mail,
  Phone,
  BadgeCheck,
  PenLine,
} from "lucide-react";
import { PageContainer } from "@/components/app-shell";
import { ImageUploader } from "@/components/ui/image-uploader";
import { LogoUploader } from "@/components/ui/logo-uploader";
import { canManageClinic, type SystemRole } from "@/lib/auth/roles";

// The Doctor Profile is IDENTITY ONLY: who the clinician is and how they
// appear on clinical surfaces. Operational preferences (workspace accent,
// language, account/session) live on /doctor/settings, not here.
//
// The professional-identity fields below (qualification, registration
// number, credentials, contact, signature) are authored on the Clinic Admin
// doctor editor and are read-only on this surface — a doctor cannot silently
// rewrite their own medical registration. The one thing a doctor owns here
// is their workspace photo, which is genuinely wired to POST
// /api/doctor/me/avatar.

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
    qualification: string | null;
    registrationNumber: string | null;
    credentials: string | null;
    phone: string | null;
    signatureUrl: string | null;
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
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // The ONLY fetch on this page — name/photo/clinic/specialization plus the
    // read-only professional-identity fields all arrive in this single call.
    fetch("/api/doctor/me")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((data: DoctorMe) => setMe(data))
      .catch((e) => toast.error(`Could not load profile: ${e}`));
  }, []);

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

  // ── Signature (doctor-self) ──────────────────────────────────────────────
  const uploadSignature = async (file: File): Promise<string> => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/doctor/me/signature", { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error ?? "Upload failed");
    setMe((prev) =>
      prev?.doctor
        ? { ...prev, doctor: { ...prev.doctor, signatureUrl: data.signatureUrl } }
        : prev,
    );
    toast.success("Signature updated");
    return data.signatureUrl;
  };

  const removeSignature = async () => {
    const res = await fetch("/api/doctor/me/signature", { method: "DELETE" });
    if (!res.ok) {
      toast.error("Could not remove signature");
      return;
    }
    setMe((prev) =>
      prev?.doctor ? { ...prev, doctor: { ...prev.doctor, signatureUrl: null } } : prev,
    );
    toast.success("Signature removed");
  };

  // ── Clinic logo (clinic-wide — managers only) ────────────────────────────
  const uploadClinicLogo = async (file: File): Promise<string> => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/clinic/logo", { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error ?? "Upload failed");
    setMe((prev) =>
      prev?.clinic
        ? { ...prev, clinic: { ...prev.clinic, logoUrl: data.logoUrl } }
        : prev,
    );
    toast.success("Clinic logo updated");
    return data.logoUrl;
  };

  const removeClinicLogo = async () => {
    const res = await fetch("/api/clinic/logo", { method: "DELETE" });
    if (!res.ok) {
      toast.error("Could not remove logo");
      return;
    }
    setMe((prev) =>
      prev?.clinic ? { ...prev, clinic: { ...prev.clinic, logoUrl: null } } : prev,
    );
    toast.success("Clinic logo removed");
  };

  const role = (me?.role ?? null) as SystemRole | null;
  const canManageLogo = canManageClinic(role);

  const savedAvatar = me?.doctor?.photoUrl ?? null;
  const currentAvatar = preview ?? savedAvatar;
  const displayName = me?.doctor?.name ?? me?.email ?? "Doctor";
  const initials = useMemo(() => initialsOf(displayName), [displayName]);
  const specialty = me?.doctor?.specialization ?? null;
  const clinic = me?.clinic ?? null;
  const doctor = me?.doctor ?? null;
  const contactEmail = me?.email ?? null;
  const phone = doctor?.phone ?? null;
  const signatureUrl = doctor?.signatureUrl ?? null;

  const registrationRows: { label: string; value: string | null }[] = [
    { label: "Qualification", value: doctor?.qualification ?? null },
    { label: "Registration No.", value: doctor?.registrationNumber ?? null },
    { label: "Credentials", value: doctor?.credentials ?? null },
  ];
  const hasRegistration = registrationRows.some((r) => r.value);

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
          Your clinical identity as it appears across HairOS reviews, patient
          handoffs and reports. Workspace preferences live in{" "}
          <a href="/doctor/settings" className="font-medium text-teal-700 underline">
            Settings
          </a>
          .
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── LEFT column (~65%) ── */}
        <div className="space-y-6 lg:col-span-2">
          {/* Professional profile hero */}
          <section className="relative overflow-hidden rounded-3xl border border-stone-200 bg-gradient-to-br from-stone-50 to-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_18px_40px_-24px_rgba(15,23,42,0.25)] sm:p-8">
            <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
              Professional profile
            </p>
            <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:items-center sm:text-left">
              {/* Display only — the single photo uploader lives in the
                  "Profile photo" section below, so there is one obvious place
                  to change it rather than two competing controls. */}
              <div className="relative size-28 shrink-0 overflow-hidden rounded-full bg-white ring-4 ring-teal-500/20 shadow-lg sm:size-36">
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
              </div>

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

          {/* Registration details */}
          <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-7">
            <div className="flex items-center gap-2">
              <BadgeCheck className="size-4 text-teal-700" />
              <h3 className="text-base font-semibold text-slate-900">
                Registration & credentials
              </h3>
            </div>
            {hasRegistration ? (
              <dl className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
                {registrationRows
                  .filter((r) => r.value)
                  .map((r) => (
                    <div key={r.label}>
                      <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-500">
                        {r.label}
                      </dt>
                      <dd className="mt-0.5 text-sm text-slate-800">{r.value}</dd>
                    </div>
                  ))}
              </dl>
            ) : (
              <p className="mt-3 text-sm text-slate-500">
                No registration details on file yet. These are set by your clinic
                administrator.
              </p>
            )}
            <p className="mt-4 text-[11px] text-stone-400">
              Managed by your clinic administrator. Appears on approved reports and
              PDFs.
            </p>
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
          {/* Contact information */}
          <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
              Contact information
            </p>
            <ul className="mt-4 space-y-3 text-sm">
              <li className="flex items-start gap-2.5">
                <Mail className="mt-0.5 size-4 shrink-0 text-stone-400" />
                <span className="min-w-0 break-words text-slate-700">
                  {contactEmail ?? (
                    <span className="text-slate-400">No email on file</span>
                  )}
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <Phone className="mt-0.5 size-4 shrink-0 text-stone-400" />
                <span className="min-w-0 break-words text-slate-700">
                  {phone ?? <span className="text-slate-400">No phone on file</span>}
                </span>
              </li>
            </ul>
          </section>

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

            {clinic && canManageLogo && (
              // Clinic-wide branding — only clinic managers (admins / super
              // admins) can change it, so a plain doctor never sees this and
              // the logo stays display-only for them.
              <div className="mt-5 border-t border-stone-100 pt-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">
                  Clinic logo
                </p>
                <p className="mb-3 mt-1 text-xs text-slate-500">
                  Shown on reports, patient handoffs and the clinic landing page.
                </p>
                <LogoUploader
                  value={clinic.logoUrl}
                  onUpload={uploadClinicLogo}
                  onRemove={removeClinicLogo}
                />
              </div>
            )}
          </section>

          {/* Signature */}
          <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <PenLine className="size-4 text-stone-400" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                Signature
              </p>
            </div>
            {signatureUrl && (
              <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={signatureUrl}
                  alt="Doctor signature"
                  className="mx-auto max-h-16 w-auto object-contain"
                />
              </div>
            )}
            <div className="mt-4">
              {/* Doctor owns their own signature, so this is a real upload —
                  ImageUploader's built-in square preview is hidden because a
                  signature reads better in the wide preview above. */}
              <ImageUploader
                value={signatureUrl}
                onUpload={uploadSignature}
                onRemove={removeSignature}
                accept="image/png,image/jpeg,image/webp"
                maxBytes={4 * 1024 * 1024}
                label={signatureUrl ? "Replace signature" : "Upload signature"}
                hint="PNG with a transparent background works best · Max 4 MB"
                previewClassName="hidden"
              />
            </div>
            <p className="mt-3 text-[11px] text-stone-400">
              Applied to your approved reports and PDFs.
            </p>
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
