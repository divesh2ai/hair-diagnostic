import 'server-only';

import type { PrismaClient, Prisma } from '@prisma/client';

// Branch (ClinicLocation) resolution for the patient-facing flow and the
// doctor registry.
//
// ── The one rule ─────────────────────────────────────────────────────────────
// A branch is ALWAYS resolved inside a clinic that has already been resolved.
// Every function here takes a `clinicId` and scopes on it first; the slug is
// unique only per clinic, so it can never select a branch in another clinic.
// clinicLocationId is scope, never a tenant boundary — Clinic.id stays the one
// boundary isolation relies on. Nothing here widens what a caller may read.

/** A branch, trimmed to what the patient flow and the registry need. */
export interface ClinicBranch {
  id: string;
  /** URL-safe handle, e.g. "bandra". Null when the branch has no QR handle. */
  slug: string | null;
  /** Human label, e.g. "Mulund". */
  branchName: string;
  isPrimary: boolean;
}

type Db = PrismaClient | Prisma.TransactionClient;

/** URL-safe branch slug: lowercase, alphanumeric + hyphen + underscore. */
const SAFE_BRANCH_SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;

/**
 * Normalise a raw `?branch=` value to a comparable slug, or null if it could
 * not be a slug. Shape-only — it says nothing about whether the branch exists.
 */
export function normaliseBranchSlug(raw: string | undefined | null): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim().toLowerCase();
  if (!SAFE_BRANCH_SLUG_RE.test(trimmed)) return null;
  return trimmed;
}

/** A cuid/uuid-ish opaque id the QR could carry instead of a slug. */
const OPAQUE_ID_RE = /^[a-z0-9][a-z0-9-]{7,63}$/i;

/**
 * Resolve and VALIDATE a branch param against one clinic.
 *
 * Accepts either the branch slug ("bandra") or the raw ClinicLocation id, so a
 * QR minted against either keeps working. Returns the branch only when it
 * belongs to `clinicId`, is not soft-deleted and is not CLOSED; otherwise null.
 *
 * A null is not an error. A generic clinic link carries no branch, an old QR
 * may name a branch that has since closed, and a hand-edited param may name
 * nothing real — all three must leave the assessment attributed to no branch
 * rather than refused or mis-attributed.
 */
export async function resolveClinicBranch(
  db: Db,
  clinicId: string,
  rawBranch: string | undefined | null,
): Promise<ClinicBranch | null> {
  if (!clinicId || !rawBranch || typeof rawBranch !== 'string') return null;
  const raw = rawBranch.trim();
  if (!raw) return null;

  const slug = normaliseBranchSlug(raw);
  const byId = OPAQUE_ID_RE.test(raw) ? raw : null;
  if (!slug && !byId) return null;

  const or: Prisma.ClinicLocationWhereInput[] = [];
  if (slug) or.push({ slug });
  if (byId) or.push({ id: byId });

  const branch = await db.clinicLocation.findFirst({
    where: {
      clinicId,
      deletedAt: null,
      status: { not: 'CLOSED' },
      OR: or,
    },
    select: { id: true, slug: true, branchName: true, isPrimary: true },
  });

  return branch ?? null;
}

/**
 * List a clinic's selectable branches — not soft-deleted, not CLOSED — primary
 * first then by name. Used by the clinic landing page's branch picker and the
 * doctor registry's branch filter. `withSlugOnly` keeps only branches that have
 * a QR handle, which is what the patient-facing picker can actually link to.
 */
export async function listClinicBranches(
  db: Db,
  clinicId: string,
  opts: { withSlugOnly?: boolean } = {},
): Promise<ClinicBranch[]> {
  if (!clinicId) return [];
  const branches = await db.clinicLocation.findMany({
    where: {
      clinicId,
      deletedAt: null,
      status: { not: 'CLOSED' },
      ...(opts.withSlugOnly ? { slug: { not: null } } : {}),
    },
    orderBy: [{ isPrimary: 'desc' }, { branchName: 'asc' }],
    select: { id: true, slug: true, branchName: true, isPrimary: true },
  });
  return branches;
}
