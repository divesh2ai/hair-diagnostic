import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell, AppShellProviders } from "@/components/app-shell";
import {
  loadShellData,
  firstNameOf,
} from "@/components/app-shell/loadShellData";
import { navForRole } from "@/lib/navigation";
export const dynamic = "force-dynamic";

// Clinic Admin console shell. Nav is pinned to CLINIC_ADMIN regardless of the
// caller's JWT role — route drives visible workspace, not the role claim.
export default async function ClinicLayout({ children }: { children: ReactNode }) {
  const data = await loadShellData();
  if (
    data.role !== "CLINIC_ADMIN" &&
    data.role !== "ORG_ADMIN" &&
    data.role !== "SUPER_ADMIN"
  ) {
    redirect("/");
  }
  const greetingName = firstNameOf(data.displayName, data.email);
  const clinicNav = navForRole("CLINIC_ADMIN");
  const clinicName = data.branding.clinicName;
  const roleLabel = clinicName ? `Clinic Admin · ${clinicName}` : "Clinic Admin";

  return (
    <AppShellProviders branding={data.branding} locale={data.locale}>
      <AppShell
        nav={clinicNav}
        email={data.email}
        displayName={data.displayName}
        greetingName={greetingName}
        roleLabel={roleLabel}
      >
        {children}
      </AppShell>
    </AppShellProviders>
  );
}
