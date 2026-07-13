import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell, AppShellProviders } from "@/components/app-shell";
import {
  loadShellData,
  firstNameOf,
} from "@/components/app-shell/loadShellData";
import { navForRole } from "@/lib/navigation";
export const dynamic = "force-dynamic";

// Doctor workspace shell. The visible identity is driven by the ROUTE, not by
// the caller's JWT role — a SUPER_ADMIN previewing the doctor surface must
// still see the Doctor workspace and Doctor nav, otherwise multi-role users
// leak admin navigation into the clinical workspace.
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
  const greetingName = firstNameOf(data.displayName, data.email);
  const doctorNav = navForRole("DOCTOR");
  const clinicName = data.branding.clinicName;
  const roleLabel = clinicName ? `Doctor · ${clinicName}` : "Doctor";

  return (
    <AppShellProviders branding={data.branding} locale={data.locale}>
      <AppShell
        nav={doctorNav}
        email={data.email}
        displayName={data.displayName}
        greetingName={greetingName}
        roleLabel={roleLabel}
        productLabel="Dr FACT"
      >
        {children}
      </AppShell>
    </AppShellProviders>
  );
}
