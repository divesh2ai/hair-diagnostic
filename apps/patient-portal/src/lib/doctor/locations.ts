// The branches a doctor practises across, and what a branch context may claim.
//
// ── The relationship, stated once ───────────────────────────────────────────
// A doctor belongs to a Clinic; a Clinic owns its ClinicLocations. There is no
// Doctor-to-ClinicLocation join, and adding one would not describe anything
// truer for the launch cohort -- each of those clinics has exactly one
// clinician, who works at every branch the clinic runs. The authorization
// boundary is, and stays, the clinic.
//
// ── What a branch context may and may not do ────────────────────────────────
// No clinical row carries a location id. Assessment, Patient, Consultation and
// KitOrderIntent are clinic-scoped; ClinicVisit omits the column on purpose and
// says why in the schema. So a branch selector CANNOT filter a queue, a patient
// list or an order, and one that appeared to would be misreporting records
// that were never branch-tagged.
//
// What it can honestly do is orient: name the premises the clinician is
// working from and surface that branch's own reception line. That is the whole
// contract, and `recordsAreBranchScoped: false` states it in the payload so no
// consumer has to infer it.

import { prisma } from "@/lib/prisma";

export interface DoctorLocation {
  id: string;
  branchName: string;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  /** Branch reception line. Never a doctor's personal login contact. */
  phone: string | null;
  isPrimary: boolean;
  status: string;
}

export interface DoctorLocationContext {
  clinicId: string;
  locations: DoctorLocation[];
  /** True only with two or more live branches. The selector renders on this. */
  multiLocation: boolean;
  /** Always "clinic" — see the header. Present so the payload is self-describing. */
  scope: "clinic";
  /** Always false today. Present so a future change is a visible one. */
  recordsAreBranchScoped: false;
}

export async function loadDoctorLocations(
  clinicId: string,
): Promise<DoctorLocationContext> {
  const locations = await prisma.clinicLocation.findMany({
    where: {
      clinicId,
      deletedAt: null,
      // A closed branch is not somewhere a clinician can be sitting today.
      status: { not: "CLOSED" },
    },
    orderBy: [{ isPrimary: "desc" }, { branchName: "asc" }],
    select: {
      id: true,
      branchName: true,
      addressLine1: true,
      city: true,
      state: true,
      pincode: true,
      phone: true,
      isPrimary: true,
      status: true,
    },
  });

  return {
    clinicId,
    locations,
    multiLocation: locations.length > 1,
    scope: "clinic",
    recordsAreBranchScoped: false,
  };
}
