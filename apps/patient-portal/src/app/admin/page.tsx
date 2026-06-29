"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  Stethoscope,
  Users,
  ClipboardCheck,
  FileText,
  TrendingUp,
  Activity,
  Plus,
  ListChecks,
  ShieldCheck,
} from "lucide-react";
import { PageContainer } from "@/components/app-shell";
import { MetricCard } from "@/components/ui/metric-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { StatusBadge, toneForAssessmentStatus } from "@/components/ui/status-badge";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LoadingState, ErrorState } from "@/components/ui/states";

type Payload = {
  metrics: {
    clinicsTotal: number;
    clinicsActive: number;
    doctorsTotal: number;
    patientsTotal: number;
    assessmentsToday: number;
    reportsToday: number;
    monthlyGrowth: number;
    platformHealth: number;
  };
  recent: {
    clinics: Array<{
      id: string;
      name: string;
      slug: string;
      logoUrl: string | null;
      status: string;
      createdAt: string;
    }>;
    doctors: Array<{
      id: string;
      name: string;
      email: string;
      avatarUrl: string | null;
      clinicName: string;
      createdAt: string;
    }>;
    assessments: Array<{
      id: string;
      status: string;
      submittedAt: string | null;
      patientName: string;
      clinicName: string;
    }>;
  };
};

export default function AdminDashboardPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/dashboard", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then(setData)
      .catch((e) => setError(String(e)));
  }, []);

  if (error) {
    return (
      <PageContainer>
        <ErrorState title="Couldn't load dashboard" description={error} />
      </PageContainer>
    );
  }
  if (!data) {
    return (
      <PageContainer>
        <LoadingState />
      </PageContainer>
    );
  }

  const m = data.metrics;

  return (
    <PageContainer className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Platform overview</h1>
          <p className="text-sm text-muted-foreground">
            Operational pulse across every clinic.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/clinics/new">
            <Button>
              <Plus />
              Create clinic
            </Button>
          </Link>
          <Link href="/admin/clinics">
            <Button variant="outline">
              <ListChecks />
              View clinics
            </Button>
          </Link>
          <Link href="/admin/audit">
            <Button variant="outline">
              <ShieldCheck />
              Audit
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={<Building2 className="size-4" />}
          label="Total clinics"
          value={m.clinicsTotal}
          hint={`${m.clinicsActive} active`}
        />
        <MetricCard
          icon={<Stethoscope className="size-4" />}
          label="Doctors"
          value={m.doctorsTotal}
        />
        <MetricCard
          icon={<Users className="size-4" />}
          label="Patients"
          value={m.patientsTotal}
        />
        <MetricCard
          icon={<ClipboardCheck className="size-4" />}
          label="Assessments today"
          value={m.assessmentsToday}
        />
        <MetricCard
          icon={<FileText className="size-4" />}
          label="Reports today"
          value={m.reportsToday}
        />
        <MetricCard
          icon={<TrendingUp className="size-4" />}
          label="Monthly growth"
          value={`${m.monthlyGrowth > 0 ? "+" : ""}${m.monthlyGrowth}%`}
          delta={{ value: m.monthlyGrowth, period: "vs last month" }}
        />
        <MetricCard
          icon={<Activity className="size-4" />}
          label="Platform health"
          value={`${m.platformHealth}/100`}
          hint={
            m.platformHealth >= 90
              ? "Healthy"
              : m.platformHealth >= 70
                ? "Watch"
                : "Degraded"
          }
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New clinics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.recent.clinics.length === 0 && (
              <p className="text-sm text-muted-foreground">No recent clinics.</p>
            )}
            {data.recent.clinics.map((c) => (
              <Link
                key={c.id}
                href={`/admin/clinics/${c.id}/edit`}
                className="flex items-center gap-3 rounded-md p-2 -mx-2 hover:bg-muted"
              >
                {c.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.logoUrl}
                    alt=""
                    className="size-8 rounded-md object-cover"
                  />
                ) : (
                  <Avatar name={c.name} size="sm" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{c.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{c.slug}</div>
                </div>
                <StatusBadge tone={c.status === "ACTIVE" ? "success" : "neutral"}>
                  {c.status}
                </StatusBadge>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">New doctors</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.recent.doctors.length === 0 && (
              <p className="text-sm text-muted-foreground">No recent doctors.</p>
            )}
            {data.recent.doctors.map((d) => (
              <div key={d.id} className="flex items-center gap-3">
                <Avatar name={d.name} src={d.avatarUrl} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{d.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {d.clinicName}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent assessments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.recent.assessments.length === 0 && (
              <p className="text-sm text-muted-foreground">No recent assessments.</p>
            )}
            {data.recent.assessments.map((a) => (
              <div key={a.id} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {a.patientName}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {a.clinicName}
                  </div>
                </div>
                <StatusBadge tone={toneForAssessmentStatus(a.status)}>
                  {a.status}
                </StatusBadge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
