"use client";

import { use, useEffect, useState } from "react";
import { PageContainer } from "@/components/app-shell";
import { DoctorForm, type DoctorFormValues } from "../../DoctorForm";
import { LoadingState, ErrorState } from "@/components/ui/states";

export default function EditDoctorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [initial, setInitial] = useState<Partial<DoctorFormValues> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/clinic/doctors/${id}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((j) => {
        const d = j.doctor;
        setInitial({
          id: d.id,
          name: d.name,
          email: d.email,
          phone: d.phone ?? "",
          qualification: d.qualification ?? "",
          registrationNumber: d.registrationNumber ?? "",
          biography: d.biography ?? d.bio ?? "",
          specialization: d.specialization ?? "",
          preferredLanguage: d.preferredLanguage,
          avatarUrl: d.avatarUrl ?? d.photoUrl ?? "",
          signatureUrl: d.signatureUrl ?? "",
          isActive: d.isActive,
        });
      })
      .catch((e) => setError(String(e)));
  }, [id]);

  if (error)
    return (
      <PageContainer>
        <ErrorState title="Couldn't load doctor" description={error} />
      </PageContainer>
    );
  if (!initial)
    return (
      <PageContainer>
        <LoadingState />
      </PageContainer>
    );

  return (
    <PageContainer className="space-y-4 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{initial.name}</h1>
        <p className="text-sm text-muted-foreground">Edit doctor profile</p>
      </div>
      <DoctorForm mode="edit" initial={initial} />
    </PageContainer>
  );
}
