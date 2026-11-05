"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import type { ClinicOpsRow } from "@/lib/admin/clinicMonitor/model";
import type { ClinicDetail } from "@/lib/admin/clinicMonitor/detailModel";
import { ClinicDetailSections } from "./ClinicDetailSections";

const sections = ["Overview", "Patients", "Reports & Kits", "Activity"] as const;
export type ClinicSection = (typeof sections)[number];

function DrawerContent({ row }: { row: ClinicOpsRow }) {
  const [section, setSection] = useState<ClinicSection>("Overview");
  const [attempt, setAttempt] = useState(0);
  const [detail, setDetail] = useState<ClinicDetail | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/admin/clinics/${encodeURIComponent(row.clinicId)}/operations`, {
      cache: "no-store", signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) throw new Error("Clinic details unavailable");
      const payload: ClinicDetail = await response.json();
      if (!controller.signal.aborted) setDetail(payload);
    }).catch(() => {
      if (!controller.signal.aborted) setError(true);
    });
    return () => controller.abort();
  }, [row.clinicId, attempt]);

  const primary = detail?.doctors.find((doctor) => doctor.isPrimary)?.name ?? row.topDoctor?.name;
  const branch = detail?.branches.find((item) => item.primary);
  const location = branch ? [branch.name, branch.city].filter(Boolean).join(", ")
    : detail?.branches.length ? `${detail.branches.length} recorded branches` : null;
  return (
    <>
      <header className="sticky top-0 z-10 border-b bg-card px-4 pt-5 sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Dialog.Title className="break-words text-xl font-semibold">{row.name}</Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-muted-foreground">
              {[primary ?? "No primary doctor recorded", location, row.isActive ? "Active clinic" : row.status].filter(Boolean).join(" · ")}
            </Dialog.Description>
          </div>
          <Dialog.Close aria-label="Close clinic details" className="shrink-0 rounded-md p-2 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
            <X aria-hidden="true" className="size-5" />
          </Dialog.Close>
        </div>
        <nav aria-label="Clinic detail sections" className="mt-3 grid grid-cols-4 gap-1">
          {sections.map((label) => (
            <button key={label} type="button" aria-pressed={section === label} onClick={() => setSection(label)}
              className={`min-h-11 border-b-2 px-1 py-2 text-xs font-medium focus-visible:ring-2 focus-visible:ring-ring sm:text-sm ${section === label ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:bg-muted"}`}>
              {label}
            </button>
          ))}
        </nav>
      </header>
      <div className="px-4 py-5 sm:px-6">
        {detail ? <ClinicDetailSections section={section} detail={detail} usage={row.usage} clinicId={row.clinicId} /> :
          error ? <div role="alert" className="space-y-3 text-sm">
            <p>Clinic operations could not be loaded.</p>
            <button type="button" className="rounded-md border px-3 py-2" onClick={() => { setError(false); setAttempt((n) => n + 1); }}>Retry</button>
          </div> : <p role="status" className="text-sm text-muted-foreground">Loading clinic operations…</p>}
      </div>
    </>
  );
}

export function ClinicOpsDrawer({ row, open, onOpenChange }: {
  row: ClinicOpsRow | null; open: boolean; onOpenChange: (value: boolean) => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Popup className="fixed inset-y-0 right-0 z-50 w-full overflow-y-auto overscroll-contain border-l bg-card text-card-foreground shadow-xl outline-none sm:max-w-[46rem]">
          {row && open && <DrawerContent key={row.clinicId} row={row} />}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
