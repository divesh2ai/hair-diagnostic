import type { ReactNode } from "react";
import { AppShell, AppShellProviders } from "@/components/app-shell";
import { loadSuperAdminShellData } from "@/components/app-shell/loadShellData";
import { SignOutForm } from "@/components/app-shell/SignOutForm";

// Super Admin console shell. Wraps every /admin/* page in the standard
// providers + chrome. Auth is gated by /proxy + redirected by loader.
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const data = await loadSuperAdminShellData();

  return (
    <AppShellProviders branding={data.branding} locale={data.locale}>
      <SignOutForm>
        {({ submit }) => (
          <AppShell
            nav={data.nav}
            email={data.email}
            roleLabel="Super Admin"
            onSignOut={submit}
          >
            {children}
          </AppShell>
        )}
      </SignOutForm>
    </AppShellProviders>
  );
}
