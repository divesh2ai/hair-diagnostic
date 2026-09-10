// Every clinician the platform knows about, whether or not they can sign in.
//
// ── Why this is not part of the people directory ────────────────────────────
// `loadPeopleDirectory` is keyed on the Supabase auth account: one row per
// thing that can authenticate. That is the right shape for a governance screen
// about access, and it is the wrong shape for this question, because it can
// only see doctors that already hold an account -- it filters on
// `supabaseUserId: { not: null }`.
//
// A clinician onboarded ahead of their login is exactly the population an
// operator needs to see: the profile and the clinic relationship are real, the
// account does not exist yet, and until this file existed the Super Admin
// console could not show that such a doctor had been provisioned at all.
//
// So the roster is keyed on the Doctor row instead, and access is one of its
// attributes rather than its identity. The two views answer different
// questions and neither replaces the other.
//
// ── Locations ───────────────────────────────────────────────────────────────
// A doctor's branches are the branches of their clinic. There is no
// Doctor-to-ClinicLocation relation and this file does not invent one: the
// authorization boundary is the clinic, so listing the clinic's live locations
// is a faithful description of where that doctor practises, not an
// approximation of a link that exists elsewhere.

import { prisma } from "@/lib/prisma";
import {
  describeDoctorProvisioning,
  type DoctorProvisioningView,
} from "@/lib/doctor/provisioning";

export interface ClinicianRow extends DoctorProvisioningView {
  doctorId: string;
  name: string;
  /** Null when no personal login address has been recorded. */
  email: string | null;
  phone: string | null;
  /** Null until an invitation is accepted and the auth account is linked. */
  authUserId: string | null;
  clinicId: string;
  clinicName: string;
  clinicSlug: string;
  organizationName: string | null;
  locations: { id: string; branchName: string; city: string | null; status: string }[];
  locationCount: number;
  /**
   * Null when the doctor holds no account, and also null when the account
   * exists but has never been used. `authUserId` distinguishes the two.
   */
  lastSignInAt: string | null;
  provisioningSource: string | null;
  provisionedAt: string | null;
  createdAt: string;
}

export interface ClinicianRoster {
  clinicians: ClinicianRow[];
  summary: {
    total: number;
    dashboardReady: number;
    contactRequired: number;
    unconfirmedContact: number;
    invited: number;
    deactivated: number;
    multiLocation: number;
  };
  /**
   * False when auth.users could not be read. Last sign-in is then unknown
   * rather than "never", and the caller must say so -- the two look identical
   * on screen and mean opposite things.
   */
  authReadable: boolean;
}

interface AuthUserRow {
  id: string;
  last_sign_in_at: Date | null;
}

export async function loadClinicianRoster(): Promise<ClinicianRoster> {
  const doctors = await prisma.doctor.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      supabaseUserId: true,
      isActive: true,
      deletedAt: true,
      provisioningStatus: true,
      provisioningSource: true,
      provisionedAt: true,
      createdAt: true,
      clinic: {
        select: {
          id: true,
          name: true,
          slug: true,
          organization: { select: { name: true } },
          locations: {
            where: { deletedAt: null },
            orderBy: { branchName: "asc" },
            select: { id: true, branchName: true, city: true, status: true },
          },
        },
      },
    },
    orderBy: [{ clinic: { name: "asc" } }, { name: "asc" }],
  });

  // Narrow read: the ids we already hold, and one timestamp. Nothing else from
  // auth.users belongs in an operations screen.
  const linkedIds = doctors
    .map((d) => d.supabaseUserId)
    .filter((v): v is string => v !== null);

  let lastSignIn = new Map<string, Date | null>();
  let authReadable = true;
  if (linkedIds.length > 0) {
    try {
      const rows = await prisma.$queryRaw<AuthUserRow[]>`
        SELECT id::text AS id, last_sign_in_at
        FROM auth.users
        WHERE id::text = ANY(${linkedIds}::text[])
      `;
      lastSignIn = new Map(rows.map((r) => [r.id, r.last_sign_in_at]));
    } catch {
      authReadable = false;
    }
  }

  const clinicians: ClinicianRow[] = doctors.map((d) => {
    const view = describeDoctorProvisioning({
      email: d.email,
      phone: d.phone,
      supabaseUserId: d.supabaseUserId,
      isActive: d.isActive,
      deletedAt: d.deletedAt,
      provisioningStatus: d.provisioningStatus,
    });
    const signIn = d.supabaseUserId ? lastSignIn.get(d.supabaseUserId) : null;
    return {
      ...view,
      doctorId: d.id,
      name: d.name,
      email: d.email,
      phone: d.phone,
      authUserId: d.supabaseUserId,
      clinicId: d.clinic.id,
      clinicName: d.clinic.name,
      clinicSlug: d.clinic.slug,
      organizationName: d.clinic.organization?.name ?? null,
      locations: d.clinic.locations,
      locationCount: d.clinic.locations.length,
      lastSignInAt: signIn ? signIn.toISOString() : null,
      provisioningSource: d.provisioningSource,
      provisionedAt: d.provisionedAt ? d.provisionedAt.toISOString() : null,
      createdAt: d.createdAt.toISOString(),
    };
  });

  return {
    clinicians,
    summary: {
      total: clinicians.length,
      dashboardReady: clinicians.filter((c) => c.dashboardAccess).length,
      contactRequired: clinicians.filter(
        (c) => c.contactStatus === "CONTACT_REQUIRED",
      ).length,
      unconfirmedContact: clinicians.filter(
        (c) => c.contactStatus === "UNCONFIRMED",
      ).length,
      invited: clinicians.filter((c) => c.provisioningStatus === "INVITED").length,
      deactivated: clinicians.filter((c) => c.accountStatus !== "ACTIVE").length,
      multiLocation: clinicians.filter((c) => c.locationCount > 1).length,
    },
    authReadable,
  };
}
