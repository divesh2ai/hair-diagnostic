"use client";

// Test-only visual harness client. Renders the REAL chrome + dashboard
// components (AppShell → Sidebar + Header/UserMenu, and PatientDeck →
// PatientDeckCard) with deterministic fixture props. No data fetching, no auth.
import "@/styles/doctor-tokens.css";

import { AppShell, AppShellProviders } from "@/components/app-shell";
import { PatientDeck } from "@/components/doctor/dashboard/PatientDeck";
import { navForRole } from "@/lib/navigation";
import { FIXTURE_BRANDING, FIXTURE_ROWS } from "./fixtures";

export function HarnessClient({ activePath }: { activePath?: string }) {
  return (
    <AppShellProviders branding={FIXTURE_BRANDING} locale="en">
      <AppShell
        nav={navForRole("DOCTOR")}
        email="divesh2ai@example.com"
        displayName="Dr Divesh Shah"
        greetingName="Divesh"
        roleLabel="Doctor · DrFACT Mumbai Test Clinic"
        productLabel="Dr FACT"
        sidebarVariant="doctor"
        // The one route-override point: production never passes this, so the
        // live URL decides. Defaults to the dashboard route so Dashboard reads
        // as active; the harness flips it to prove reusability for other routes.
        activePath={activePath ?? "/doctor"}
      >
        <div data-surface="doctor" className="v2-canvas min-h-full" data-testid="dashboard-surface">
          <div className="mx-auto w-full max-w-7xl space-y-7 px-4 pb-20 pt-7 sm:px-6">
            <section aria-label="Patient deck" className="space-y-3" data-testid="patient-deck">
              <PatientDeck
                rows={FIXTURE_ROWS}
                tick={0}
                loading={false}
                error={false}
                approvedToday={3}
                inProgress={2}
                onRetry={() => {}}
              />
            </section>
          </div>
        </div>
      </AppShell>
    </AppShellProviders>
  );
}
