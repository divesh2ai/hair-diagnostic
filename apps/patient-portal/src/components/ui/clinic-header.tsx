"use client";

import { useBranding } from "@/lib/branding";

// Clinic brand lockup shown at the top of the doctor/clinic sidebar. This is a
// BRAND header — clinic logo (or a polished monogram fallback) + clinic name +
// a muted workspace descriptor — not a user avatar. Everything is pulled from
// BrandingProvider so it stays in sync with whatever the clinic admin uploaded.
//
// The clinic name is allowed up to two lines before it truncates, so real
// names like "DrFACT Mumbai Test Clinic" read in full instead of collapsing to
// "DrFACT Mumbai Test Cli…".

function monogram(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "•";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function ClinicHeader({ subtitle }: { subtitle?: string }) {
  const b = useBranding();
  const secondary = subtitle ?? b.tagline ?? "Clinical workspace";

  return (
    <div className="flex items-start gap-3">
      {b.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={b.logoUrl}
          alt={`${b.clinicName} logo`}
          className="size-10 shrink-0 rounded-xl object-cover bg-white ring-1 ring-sidebar-border shadow-sm"
        />
      ) : (
        <span
          aria-hidden="true"
          className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-sidebar-primary/90 to-sidebar-primary text-sidebar-primary-foreground text-[13px] font-semibold tracking-wide shadow-sm ring-1 ring-black/5"
        >
          {monogram(b.clinicName)}
        </span>
      )}
      <div className="min-w-0 pt-0.5">
        <div className="text-[15px] font-semibold leading-[1.2] tracking-tight text-sidebar-foreground line-clamp-2">
          {b.clinicName}
        </div>
        <div className="mt-0.5 truncate text-[11px] font-medium uppercase tracking-[0.08em] text-sidebar-foreground/55">
          {secondary}
        </div>
      </div>
    </div>
  );
}
