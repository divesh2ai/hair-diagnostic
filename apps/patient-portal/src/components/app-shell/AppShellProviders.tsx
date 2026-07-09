"use client";

import type { ReactNode } from "react";
import { I18nProvider } from "@/lib/i18n";
import { BrandingProvider, type ClinicBranding } from "@/lib/branding";
import { ThemeProvider } from "@/lib/theme";

// Single wrapper used by every authenticated layout. Order matters:
//   - ThemeProvider sets the .dark class on <html> before children render.
//   - BrandingProvider applies CSS vars; must be inside Theme so dark-mode
//     swaps don't clobber brand vars.
//   - I18nProvider supplies useT() to everything below.
//   - Toaster is mounted once at the root layout so toast() works on
//     unauthenticated pages (/login, /q/...) too.

export function AppShellProviders({
  branding,
  locale,
  children,
}: {
  branding: ClinicBranding;
  locale?: string;
  children: ReactNode;
}) {
  return (
    <ThemeProvider>
      <BrandingProvider branding={branding}>
        <I18nProvider initialLocale={locale}>
          {children}
        </I18nProvider>
      </BrandingProvider>
    </ThemeProvider>
  );
}
