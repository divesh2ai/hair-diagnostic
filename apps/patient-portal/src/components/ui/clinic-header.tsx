"use client";

import { useBranding } from "@/lib/branding";
import { Avatar } from "./avatar";

// Header strip used at the top of clinic-scoped pages — clinic logo + name,
// optional tagline. Pulls everything from BrandingProvider so it stays in
// sync with whatever the clinic admin uploaded.

export function ClinicHeader({ subtitle }: { subtitle?: string }) {
  const b = useBranding();
  return (
    <div className="flex items-center gap-3">
      {b.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={b.logoUrl}
          alt={b.clinicName}
          className="size-10 rounded-md object-cover bg-muted"
        />
      ) : (
        <Avatar name={b.clinicName} size="md" />
      )}
      <div className="min-w-0">
        <div className="text-sm font-semibold truncate">{b.clinicName}</div>
        {(subtitle ?? b.tagline) && (
          <div className="text-xs text-muted-foreground truncate">
            {subtitle ?? b.tagline}
          </div>
        )}
      </div>
    </div>
  );
}
