"use client";

import { createContext, useContext, useEffect, useMemo } from "react";
import type { ReactNode } from "react";
import { PLATFORM_BRANDING, type ClinicBranding } from "./types";

// Branding is injected at the root of every authenticated layout via the
// server loader. The client provider:
//   - exposes the payload via useBranding()
//   - applies primary/secondary as CSS custom properties on documentElement,
//     so any Tailwind/CSS rule can pull them via var(--brand-primary).
//
// Why CSS vars and not Tailwind classes: clinics pick arbitrary hex; we
// can't pre-generate utility classes for every value.

type Ctx = ClinicBranding;

const BrandingContext = createContext<Ctx>(PLATFORM_BRANDING);

export function BrandingProvider({
  branding,
  children,
}: {
  branding: ClinicBranding;
  children: ReactNode;
}) {
  const value = useMemo<Ctx>(() => branding, [branding]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (branding.primaryColor) {
      root.style.setProperty("--brand-primary", branding.primaryColor);
    } else {
      root.style.removeProperty("--brand-primary");
    }
    if (branding.secondaryColor) {
      root.style.setProperty("--brand-secondary", branding.secondaryColor);
    } else {
      root.style.removeProperty("--brand-secondary");
    }
  }, [branding.primaryColor, branding.secondaryColor]);

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding(): ClinicBranding {
  return useContext(BrandingContext);
}
