// The platform's people, assembled from the four places identity actually
// lives.
//
// ── Why this is a query and not a table ─────────────────────────────────────
// There is no single "users" table. An account is a row in Supabase
// `auth.users`; what that account may DO comes from whichever of
// OrganizationMember / ClinicMember / Doctor / Patient references it. A person
// with none of those can sign in perfectly well and reach nothing — the
// roleless account — and until now the Super Admin console had no way to see
// that such an account existed.
//
// That is not hypothetical. `divesh2ai+@gmail.com` was created on staging by a
// mistyped address (the staff login calls signInWithOtp with
// `shouldCreateUser: true`), holds no membership of any kind, and was
// invisible to every existing screen.
//
// ── Read-only, and narrow ───────────────────────────────────────────────────
// auth.users is outside the Prisma schema, so this is a raw read. It selects
// id, email, created_at and last_sign_in_at and nothing else: no password
// hash, no confirmation or recovery tokens, no phone, no raw app metadata.
// Widening this SELECT is a security decision, not a convenience one.

import { prisma } from "@/lib/prisma";
import type { SystemRole } from "@prisma/client";

export type AccessLevel =
  | "SUPER_ADMIN"
  | "ORG_ADMIN"
  | "CLINIC_ADMIN"
  | "STAFF"
  | "DOCTOR"
  | "PATIENT"
  | "NONE";

export interface PersonRow {
  /** Supabase auth user id. The immutable identifier. */
  userId: string;
  email: string | null;
  name: string | null;
  /**
   * The strongest role any membership grants. `NONE` means the account exists
   * and can authenticate but holds no membership at all.
   */
  accessLevel: AccessLevel;
  /** Every membership found, so a stacked identity is visible rather than flattened. */
  memberships: {
    kind: "organization" | "clinic" | "doctor" | "patient";
    role: SystemRole | "DOCTOR" | "PATIENT";
    clinicId: string | null;
    clinicName: string | null;
    isActive: boolean;
  }[];
  clinicNames: string[];
  createdAt: string;
  lastSignInAt: string | null;
  /**
   * True when the account holds memberships but none of them resolves to a
   * clinic — an operator cannot tell which tenant the person belongs to.
   */
  clinicUnclear: boolean;
  /** Every membership found is soft-deleted or inactive. */
  inactive: boolean;
}

interface AuthUserRow {
  id: string;
  email: string | null;
  created_at: Date;
  last_sign_in_at: Date | null;
}

/** Strongest-wins ordering. Index 0 is the most privileged. */
const PRECEDENCE: AccessLevel[] = [
  "SUPER_ADMIN",
  "ORG_ADMIN",
  "CLINIC_ADMIN",
  "STAFF",
  "DOCTOR",
  "PATIENT",
  "NONE",
];

function strongest(levels: AccessLevel[]): AccessLevel {
  for (const level of PRECEDENCE) {
    if (levels.includes(level)) return level;
  }
  return "NONE";
}

export interface PeopleDirectory {
  people: PersonRow[];
  summary: {
    totalAccounts: number;
    byAccessLevel: Record<AccessLevel, number>;
    rolelessAccounts: number;
    clinicUnclear: number;
    inactiveAccounts: number;
    neverSignedIn: number;
  };
  invitations: {
    available: boolean;
    pending: number;
    accepted: number;
    revoked: number;
    expired: number;
  };
  /**
   * False when auth.users could not be read. The caller must surface this
   * rather than rendering an empty directory as though the platform had no
   * accounts — the two look identical and mean opposite things.
   */
  authReadable: boolean;
}

/**
 * Build the directory.
 *
 * One raw read of auth.users plus four indexed Prisma reads. Membership tables
 * are small (they hold staff, not patients-at-scale) and are read whole, then
 * joined in memory — simpler and cheaper than four correlated subqueries, and
 * it keeps the precedence rule in one readable place.
 */
export async function loadPeopleDirectory(): Promise<PeopleDirectory> {
  let authUsers: AuthUserRow[] = [];
  let authReadable = true;
  try {
    authUsers = await prisma.$queryRaw<AuthUserRow[]>`
      SELECT id::text AS id, email, created_at, last_sign_in_at
      FROM auth.users
      ORDER BY created_at DESC
    `;
  } catch {
    authReadable = false;
  }

  const [orgMembers, clinicMembers, doctors, patients, invitationCounts] =
    await Promise.all([
      prisma.organizationMember.findMany({
        where: { deletedAt: null },
        select: {
          supabaseUserId: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
        },
      }),
      prisma.clinicMember.findMany({
        where: { deletedAt: null },
        select: {
          supabaseUserId: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          clinic: { select: { id: true, name: true } },
        },
      }),
      prisma.doctor.findMany({
        where: { deletedAt: null, supabaseUserId: { not: null } },
        select: {
          supabaseUserId: true,
          name: true,
          email: true,
          isActive: true,
          clinic: { select: { id: true, name: true } },
        },
      }),
      prisma.patient.findMany({
        where: { deletedAt: null, supabaseUserId: { not: null } },
        select: {
          supabaseUserId: true,
          name: true,
          email: true,
          isActive: true,
          clinic: { select: { id: true, name: true } },
        },
      }),
      prisma.clinicInvitation
        .groupBy({ by: ["status"], _count: { _all: true } })
        .catch(() => null),
    ]);

  const byUser = new Map<string, PersonRow>();

  const ensure = (userId: string): PersonRow => {
    let row = byUser.get(userId);
    if (!row) {
      row = {
        userId,
        email: null,
        name: null,
        accessLevel: "NONE",
        memberships: [],
        clinicNames: [],
        createdAt: "",
        lastSignInAt: null,
        clinicUnclear: false,
        inactive: false,
      };
      byUser.set(userId, row);
    }
    return row;
  };

  for (const u of authUsers) {
    const row = ensure(u.id);
    row.email = u.email;
    row.createdAt = u.created_at.toISOString();
    row.lastSignInAt = u.last_sign_in_at
      ? u.last_sign_in_at.toISOString()
      : null;
  }

  for (const m of orgMembers) {
    const row = ensure(m.supabaseUserId);
    row.name ??= m.name;
    row.email ??= m.email;
    row.memberships.push({
      kind: "organization",
      role: m.role,
      clinicId: null,
      clinicName: null,
      isActive: m.isActive,
    });
  }
  for (const m of clinicMembers) {
    const row = ensure(m.supabaseUserId);
    row.name ??= m.name;
    row.email ??= m.email;
    row.memberships.push({
      kind: "clinic",
      role: m.role,
      clinicId: m.clinic.id,
      clinicName: m.clinic.name,
      isActive: m.isActive,
    });
  }
  for (const d of doctors) {
    if (!d.supabaseUserId) continue;
    const row = ensure(d.supabaseUserId);
    row.name ??= d.name;
    row.email ??= d.email;
    row.memberships.push({
      kind: "doctor",
      role: "DOCTOR",
      clinicId: d.clinic.id,
      clinicName: d.clinic.name,
      isActive: d.isActive,
    });
  }
  for (const p of patients) {
    if (!p.supabaseUserId) continue;
    const row = ensure(p.supabaseUserId);
    row.name ??= p.name;
    row.email ??= p.email;
    row.memberships.push({
      kind: "patient",
      role: "PATIENT",
      clinicId: p.clinic.id,
      clinicName: p.clinic.name,
      isActive: p.isActive,
    });
  }

  const people = [...byUser.values()];
  for (const row of people) {
    row.accessLevel = strongest(
      row.memberships.map((m) => m.role as AccessLevel),
    );
    row.clinicNames = [
      ...new Set(
        row.memberships
          .map((m) => m.clinicName)
          .filter((n): n is string => !!n),
      ),
    ];
    // Organization-level roles are platform-wide by design, so "no clinic" is
    // correct for them and must not be flagged as unclear.
    const platformWide =
      row.accessLevel === "SUPER_ADMIN" || row.accessLevel === "ORG_ADMIN";
    row.clinicUnclear =
      !platformWide && row.memberships.length > 0 && row.clinicNames.length === 0;
    row.inactive =
      row.memberships.length > 0 && row.memberships.every((m) => !m.isActive);
  }

  people.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  const byAccessLevel = PRECEDENCE.reduce(
    (acc, level) => ({ ...acc, [level]: 0 }),
    {} as Record<AccessLevel, number>,
  );
  for (const row of people) byAccessLevel[row.accessLevel] += 1;

  const invCount = (status: string) =>
    invitationCounts?.find((c) => c.status === status)?._count._all ?? 0;

  return {
    people,
    summary: {
      totalAccounts: people.length,
      byAccessLevel,
      rolelessAccounts: people.filter((p) => p.accessLevel === "NONE").length,
      clinicUnclear: people.filter((p) => p.clinicUnclear).length,
      inactiveAccounts: people.filter((p) => p.inactive).length,
      neverSignedIn: people.filter((p) => !p.lastSignInAt).length,
    },
    invitations: {
      available: invitationCounts !== null,
      pending: invCount("PENDING"),
      accepted: invCount("ACCEPTED"),
      revoked: invCount("REVOKED"),
      expired: invCount("EXPIRED"),
    },
    authReadable,
  };
}
