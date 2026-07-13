import type { ReactNode } from "react";
import { AppShell, AppShellProviders } from "@/components/app-shell";
import { navForRole } from "@/lib/navigation";

export const dynamic = "force-dynamic";

import {
  loadSuperAdminShellData,
  firstNameOf,
} from "@/components/app-shell/loadShellData";

// Super Admin console shell. Nav is pinned to SUPER_ADMIN regardless of the
// caller's JWT role — route drives visible workspace, not the role claim.
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const data = await loadSuperAdminShellData();
  const greetingName = firstNameOf(data.displayName, data.email);
  const adminNav = navForRole("SUPER_ADMIN");

  return (
    <AppShellProviders branding={data.branding} locale={data.locale}>
      <AppShell
        nav={adminNav}
        email={data.email}
        displayName={data.displayName}
        greetingName={greetingName}
        roleLabel="Super Admin"
        productLabel="HairOS Intelligence"
      >
        {children}
      </AppShell>
    </AppShellProviders>
  );
}
