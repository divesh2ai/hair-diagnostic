"use client";

import { useState, type ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import type { NavSection } from "@/lib/navigation";

// AppShell — the canonical chrome every authenticated page renders inside.
// Caller (a role-scoped layout) provides:
//   - nav sections (pre-filtered by role)
//   - identity + role label
//   - sign-out handler
//
// Layouts further upstream wire BrandingProvider + I18nProvider + ThemeProvider.

export function AppShell({
  nav,
  email,
  displayName,
  greetingName,
  roleLabel,
  productLabel,
  unreadNotifications,
  navBadges,
  children,
}: {
  nav: NavSection[];
  email: string | null;
  displayName?: string | null;
  greetingName?: string | null;
  roleLabel: string;
  // Product/brand chip shown at the top of the sidebar. Doctor + Clinic
  // surfaces send "Dr FACT"; Super Admin sends "HairOS Intelligence".
  // Falls back to the i18n appName inside Sidebar when omitted.
  productLabel?: string;
  unreadNotifications?: number;
  navBadges?: Record<string, number>;
  children: ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-dvh flex bg-background text-foreground">
      <Sidebar
        sections={nav}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        badges={navBadges}
        productLabel={productLabel}
      />
      <div className="flex-1 min-w-0 flex flex-col">
        <Header
          onMenuClick={() => setSidebarOpen(true)}
          email={email}
          displayName={displayName ?? null}
          greetingName={greetingName ?? null}
          roleLabel={roleLabel}
          unreadNotifications={unreadNotifications}
        />
        <main className="flex-1 min-w-0">{children}</main>
        <Footer />
      </div>
    </div>
  );
}

export function PageContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto w-full max-w-7xl px-4 sm:px-6 py-6 ${className ?? ""}`}>
      {children}
    </div>
  );
}

function Footer() {
  return (
    <footer className="px-5 py-3 text-[11px] text-muted-foreground border-t border-border">
      © {new Date().getFullYear()} HairOS · All rights reserved
    </footer>
  );
}
