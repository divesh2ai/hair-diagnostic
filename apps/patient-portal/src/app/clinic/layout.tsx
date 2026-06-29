import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell, AppShellProviders } from "@/components/app-shell";
import { loadShellData } from "@/components/app-shell/loadShellData";
import { SignOutForm } from "@/components/app-shell/SignOutForm";

// Clinic Admin console shell. Clinic-scoped roles plus Super Admin can enter
// for preview mode (Sprint 2 ticket — tenant impersonation).
export default async function ClinicLayout({ children }: { children: ReactNode }) {
  const data = await loadShellData();
  if (
    data.role !== "CLINIC_ADMIN" &&
    data.role !== "ORG_ADMIN" &&
    data.role !== "SUPER_ADMIN"
  ) {
    redirect("/");
  }

  return (
    <AppShellProviders branding={data.branding} locale={data.locale}>
      <SignOutForm>
        {({ submit }) => (
          <AppShell
            nav={data.nav}
            email={data.email}
            roleLabel="Clinic Admin"
            onSignOut={submit}
          >
            {children}
          </AppShell>
        )}
      </SignOutForm>
    </AppShellProviders>
  );
}
