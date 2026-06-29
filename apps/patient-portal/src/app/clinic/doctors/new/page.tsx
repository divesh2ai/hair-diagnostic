"use client";

import { PageContainer } from "@/components/app-shell";
import { DoctorForm } from "../DoctorForm";

export default function NewDoctorPage() {
  return (
    <PageContainer className="space-y-4 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Add doctor</h1>
        <p className="text-sm text-muted-foreground">
          Identity, credentials, and language preference.
        </p>
      </div>
      <DoctorForm mode="create" />
    </PageContainer>
  );
}
