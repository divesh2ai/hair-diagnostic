import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell, AppShellProviders } from "@/components/app-shell";
import { loadShellData } from "@/components/app-shell/loadShellData";
import { SignOutForm } from "@/components/app-shell/SignOutForm";

// Doctor workspace shell. Doctors, plus clinic-admin / org-admin / super-admin
// roles who may need preview access into the doctor surface.
export default async function DoctorLayout({ children }: { children: ReactNode }) {
  const data = await loadShellData();
  if (
    data.role !== "DOCTOR" &&
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
            roleLabel="Doctor"
            onSignOut={submit}
          >
            {children}
          </AppShell>
        )}
      </SignOutForm>
    </AppShellProviders>
  );
}
