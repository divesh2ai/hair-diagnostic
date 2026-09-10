import type { ReactNode } from "react";
import { AppShell, AppShellProviders } from "@/components/app-shell";
import { BranchContextBar } from "@/components/doctor/BranchContextBar";
import { loadDoctorLocations } from "@/lib/doctor/locations";
import {
  loadDoctorShellData,
  firstNameOf,
} from "@/components/app-shell/loadShellData";
import { navForRole } from "@/lib/navigation";
export const dynamic = "force-dynamic";

// Doctor workspace shell. The visible identity is driven by the ROUTE, not by
// the caller's JWT role — a SUPER_ADMIN previewing the doctor surface must
// still see the Doctor workspace and Doctor nav, otherwise multi-role users
// leak admin navigation into the clinical workspace.
//
// Slice-0 hardening (2026-08-10): role alone no longer grants access. A
// live Doctor row (isActive, not soft-deleted) must exist for the caller's
// supabaseUserId. `loadDoctorShellData` enforces this and routes admins
// without a Doctor row back to their own default surface.
export default async function DoctorLayout({ children }: { children: ReactNode }) {
  const data = await loadDoctorShellData();
  // Branches follow the DOCTOR ROW's clinic, which is what every
  // /api/doctor/* handler authorizes against — not the JWT clinic claim,
  // which an admin operating here may not carry at all.
  const branches = await loadDoctorLocations(data.doctorClinicId);
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
        {/* Renders nothing below two live branches, so eleven of the twelve
            launch clinics see no branch UI at all. */}
        {branches.multiLocation && (
          <div className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6">
            <BranchContextBar
              clinicId={branches.clinicId}
              clinicName={clinicName ?? "Your clinic"}
              locations={branches.locations}
            />
          </div>
        )}
        {children}
      </AppShell>
    </AppShellProviders>
  );
}
