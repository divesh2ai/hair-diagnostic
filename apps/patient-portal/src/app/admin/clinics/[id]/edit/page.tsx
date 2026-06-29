"use client";

import { useEffect, useState, use } from "react";
import { PageContainer } from "@/components/app-shell";
import { ClinicForm, type ClinicFormValues } from "../../ClinicForm";
import { LoadingState, ErrorState } from "@/components/ui/states";

export default function EditClinicPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [initial, setInitial] = useState<Partial<ClinicFormValues> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/clinics/${id}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((j) => {
        const c = j.clinic;
        setInitial({
          id: c.id,
          name: c.name,
          slug: c.slug,
          region: c.region,
          language: c.language,
          timezone: c.timezone,
          email: c.email ?? "",
          phone: c.phone ?? "",
          whatsappNumber: c.whatsappNumber ?? "",
          address: c.address ?? "",
          primaryColor: c.primaryColor ?? "",
          secondaryColor: c.secondaryColor ?? "",
          accentColor: c.accentColor ?? "",
          logoUrl: c.logoUrl ?? "",
          tagline: c.tagline ?? "",
          website: c.website ?? "",
          subscriptionPlan: c.subscription?.plan ?? "TRIAL",
          subscriptionStatus: c.subscription?.status ?? "ACTIVE",
        });
      })
      .catch((e) => setError(String(e)));
  }, [id]);

  if (error)
    return (
      <PageContainer>
        <ErrorState title="Couldn't load clinic" description={error} />
      </PageContainer>
    );
  if (!initial)
    return (
      <PageContainer>
        <LoadingState />
      </PageContainer>
    );

  return (
    <PageContainer className="space-y-4 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{initial.name}</h1>
        <p className="text-sm text-muted-foreground">Edit clinic</p>
      </div>
      <ClinicForm mode="edit" initial={initial} />
    </PageContainer>
  );
}
