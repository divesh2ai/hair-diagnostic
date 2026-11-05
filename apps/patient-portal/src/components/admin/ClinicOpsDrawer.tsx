"use client";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AUTH_PROVIDER_LABEL } from "@/lib/admin/clinicMonitor/authProvider";
import type { ClinicOpsRow } from "@/lib/admin/clinicMonitor/model";

const date = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata",
});
const recorded = (value: string | null) => value ? date.format(new Date(value)) : "Not recorded";

export function ClinicOpsDrawer({ row, open, onOpenChange }: {
  row: ClinicOpsRow | null;
  open: boolean;
  onOpenChange: (value: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {row && (
        <DialogContent title={row.name} description="Clinic details · Dates in IST"
          className="top-0 right-0 bottom-0 left-auto max-h-dvh translate-x-0 translate-y-0 overflow-y-auto rounded-none">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <dt>Clinic status</dt><dd>{row.isActive ? row.status : "Inactive"}</dd>
            <dt>Recorded assessments</dt><dd>{row.assessmentCount}</dd>
            <dt>Assessments in last 7 days</dt><dd>{row.assessments7d}</dd>
            <dt>Latest recorded assessment</dt><dd>{recorded(row.lastAssessmentAt)}</dd>
            <dt>Latest recorded review</dt><dd>{recorded(row.lastReviewAt)}</dd>
          </dl>
          <h2 className="mt-6 text-sm font-semibold">Doctors</h2>
          {row.doctors.length ? <ul className="mt-2 divide-y divide-border text-sm">
            {row.doctors.map((doctor, index) => (
              <li key={index} className="space-y-1 py-3">
                <p className="font-medium">{doctor.name}</p>
                <p>Login method: {AUTH_PROVIDER_LABEL[doctor.authProvider]}</p>
                <p>Last sign-in: {recorded(doctor.lastSignInAt)}</p>
              </li>
            ))}
          </ul> : <p className="mt-2 text-sm text-muted-foreground">No active doctors recorded.</p>}
        </DialogContent>
      )}
    </Dialog>
  );
}
