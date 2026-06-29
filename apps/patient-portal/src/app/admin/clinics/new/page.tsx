"use client";

import { PageContainer } from "@/components/app-shell";
import { ClinicForm } from "../ClinicForm";

export default function NewClinicPage() {
  return (
    <PageContainer className="space-y-4 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Create clinic</h1>
        <p className="text-sm text-muted-foreground">
          Identity, branding, contact, and locale.
        </p>
      </div>
      <ClinicForm mode="create" />
    </PageContainer>
  );
}
