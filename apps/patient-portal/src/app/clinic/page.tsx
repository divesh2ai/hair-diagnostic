"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ListChecks,
  ClipboardCheck,
  CheckCircle2,
  Stethoscope,
  Users,
  Plus,
  Settings,
} from "lucide-react";
import { PageContainer } from "@/components/app-shell";
import { MetricCard } from "@/components/ui/metric-card";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/states";

type Payload = {
  metrics: {
    todayQueue: number;
    pendingReviews: number;
    approvedReports: number;
    doctors: number;
    patients: number;
  };
};

export default function ClinicDashboardPage() {
  const [data, setData] = useState<Payload | null>(null);

  useEffect(() => {
    fetch("/api/clinic/dashboard", { cache: "no-store" })
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null));
  }, []);

  if (!data)
    return (
      <PageContainer>
        <LoadingState />
      </PageContainer>
    );

  const m = data.metrics;
  return (
    <PageContainer className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Clinic dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Today's activity at a glance.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/clinic/doctors/new">
            <Button>
              <Plus />
              Add doctor
            </Button>
          </Link>
          <Link href="/doctor/queue">
            <Button variant="outline">
              <ListChecks />
              View queue
            </Button>
          </Link>
          <Link href="/clinic/settings">
            <Button variant="outline">
              <Settings />
              Settings
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard
          icon={<ListChecks className="size-4" />}
          label="Today's queue"
          value={m.todayQueue}
        />
        <MetricCard
          icon={<ClipboardCheck className="size-4" />}
          label="Pending reviews"
          value={m.pendingReviews}
        />
        <MetricCard
          icon={<CheckCircle2 className="size-4" />}
          label="Approved reports"
          value={m.approvedReports}
        />
        <MetricCard
          icon={<Stethoscope className="size-4" />}
          label="Doctors"
          value={m.doctors}
        />
        <MetricCard
          icon={<Users className="size-4" />}
          label="Patients"
          value={m.patients}
        />
      </div>
    </PageContainer>
  );
}
