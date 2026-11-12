// First-login identity linking for pre-authorised platform administrators.
//
// ── What this pins ───────────────────────────────────────────────────────────
// A CEO / platform admin is provisioned ahead of time as an OrganizationMember
// row keyed on their e-mail, with NO Supabase identity yet (supabaseUserId
// NULL). They sign in through the existing Google OAuth; linkPendingAdminIdentity
// must claim that waiting row for the new auth user — but ONLY when the login is
// genuinely theirs. Authorisation itself stays server-side in the Postgres hook;
// this function only attaches an identity to a row an operator already created.
//
// The hardened hook grants the admin role solely when supabaseUserId = uid AND
// the auth e-mail is confirmed — the unverified-e-mail fallback is gone. So this
// function is the one place that writes that uid, and it carries the gates the
// hook can no longer imply: re-validated user, verified e-mail, trusted Google
// provider, and an ATOMIC non-hijacking claim.
//
// The prisma stand-in EVALUATES the where clause (it does not merely record it),
// so a regression that drops `supabaseUserId: null`, `isActive`, or `deletedAt`,
// or that widens the match, fails here rather than passing on a lucky call.

import { describe, it, expect, vi, beforeEach } from "vitest";

type MemberRow = {
  id: string;
  email: string;
  supabaseUserId: string | null;
  role: string;
  isActive: boolean;
  deletedAt: Date | null;
};

const h = vi.hoisted(() => {
  const state: { members: MemberRow[]; updateManyCalls: any[] } = {
    members: [],
    updateManyCalls: [],
  };

  /** The subset of Prisma's where language this call site uses. */
  function matches(row: MemberRow, where: any): boolean {
    for (const [key, value] of Object.entries(where)) {
      const actual = (row as any)[key];
      if (value !== null && typeof value === "object" && "equals" in value) {
        // email: { equals, mode: 'insensitive' }
        const mode = (value as any).mode;
        const target = (value as any).equals;
        if (mode === "insensitive") {
          if (String(actual).toLowerCase() !== String(target).toLowerCase())
            return false;
        } else if (actual !== target) {
          return false;
        }
        continue;
      }
      if (actual !== value) return false;
    }
    return true;
  }

  return { state, matches };
});

const { state } = h;

vi.mock("@/lib/prisma", () => ({
  prisma: {
    organizationMember: {
      updateMany: async ({ where, data }: any) => {
        h.state.updateManyCalls.push({ where, data });
        const hits = h.state.members.filter((m) => h.matches(m, where));
        hits.forEach((m) => Object.assign(m, data));
        return { count: hits.length };
      },
    },
  },
}));

import { linkPendingAdminIdentity } from "@/lib/auth/linkPendingAdmin";

// ── Supabase stand-in ────────────────────────────────────────────────────────
type FakeUser = {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
};

function fakeSupabase(user: FakeUser | null) {
  return {
    auth: {
      getUser: async () => ({ data: { user }, error: null }),
    },
  } as any;
}

const CEO_UID = "ceo-auth-uid-0001";
const OTHER_UID = "someone-else-uid-9999";

/** A confirmed Google user, the happy-path shape. */
function googleUser(over: Partial<FakeUser> = {}): FakeUser {
  return {
    id: CEO_UID,
    email: "ceo@example.com",
    email_confirmed_at: "2026-11-12T00:00:00Z",
    user_metadata: { email_verified: true },
    app_metadata: { provider: "google", providers: ["google"] },
    ...over,
  };
}

function pendingAdmin(over: Partial<MemberRow> = {}): MemberRow {
  return {
    id: "om-ceo",
    email: "ceo@example.com",
    supabaseUserId: null,
    role: "SUPER_ADMIN",
    isActive: true,
    deletedAt: null,
    ...over,
  };
}

beforeEach(() => {
  state.members = [];
  state.updateManyCalls = [];
});

describe("linkPendingAdminIdentity — the claim that must happen", () => {
  it("links a pending admin on a confirmed Google first login", async () => {
    state.members = [pendingAdmin()];

    const linked = await linkPendingAdminIdentity(fakeSupabase(googleUser()));

    expect(linked).toBe(true);
    expect(state.members[0]!.supabaseUserId).toBe(CEO_UID);
  });

  it("claims atomically: the where carries supabaseUserId=null + live predicates", async () => {
    state.members = [pendingAdmin()];

    await linkPendingAdminIdentity(fakeSupabase(googleUser()));

    expect(state.updateManyCalls).toHaveLength(1);
    const { where, data } = state.updateManyCalls[0]!;
    expect(where.supabaseUserId).toBeNull();
    expect(where.isActive).toBe(true);
    expect(where.deletedAt).toBeNull();
    expect(where.email).toMatchObject({ mode: "insensitive" });
    expect(data).toEqual({ supabaseUserId: CEO_UID });
  });

  it("matches the row e-mail case-insensitively", async () => {
    state.members = [pendingAdmin({ email: "CEO@Example.com" })];

    const linked = await linkPendingAdminIdentity(
      fakeSupabase(googleUser({ email: "ceo@example.com" })),
    );

    expect(linked).toBe(true);
    expect(state.members[0]!.supabaseUserId).toBe(CEO_UID);
  });

  it("accepts the provider asserted via app_metadata.providers[] alone", async () => {
    state.members = [pendingAdmin()];

    const linked = await linkPendingAdminIdentity(
      fakeSupabase(
        googleUser({ app_metadata: { provider: "email", providers: ["google"] } }),
      ),
    );

    expect(linked).toBe(true);
  });

  it("accepts a verified e-mail asserted via user_metadata.email_verified", async () => {
    state.members = [pendingAdmin()];

    const linked = await linkPendingAdminIdentity(
      fakeSupabase(
        googleUser({ email_confirmed_at: null, user_metadata: { email_verified: true } }),
      ),
    );

    expect(linked).toBe(true);
  });
});

describe("linkPendingAdminIdentity — refusals that keep the role server-side", () => {
  it("refuses an UNCONFIRMED e-mail and never touches the table", async () => {
    state.members = [pendingAdmin()];

    const linked = await linkPendingAdminIdentity(
      fakeSupabase(googleUser({ email_confirmed_at: null, user_metadata: {} })),
    );

    expect(linked).toBe(false);
    expect(state.updateManyCalls).toHaveLength(0);
    expect(state.members[0]!.supabaseUserId).toBeNull();
  });

  it("refuses a non-Google provider and never touches the table", async () => {
    state.members = [pendingAdmin()];

    const linked = await linkPendingAdminIdentity(
      fakeSupabase(
        googleUser({ app_metadata: { provider: "email", providers: ["email"] } }),
      ),
    );

    expect(linked).toBe(false);
    expect(state.updateManyCalls).toHaveLength(0);
    expect(state.members[0]!.supabaseUserId).toBeNull();
  });

  it("refuses when no user is returned", async () => {
    state.members = [pendingAdmin()];
    expect(await linkPendingAdminIdentity(fakeSupabase(null))).toBe(false);
    expect(state.updateManyCalls).toHaveLength(0);
  });

  it("refuses when the user has no e-mail", async () => {
    state.members = [pendingAdmin()];
    const linked = await linkPendingAdminIdentity(
      fakeSupabase(googleUser({ email: null })),
    );
    expect(linked).toBe(false);
    expect(state.updateManyCalls).toHaveLength(0);
  });

  it("links nothing for an e-mail that is not a pre-authorised admin", async () => {
    // A doctor or patient signing in through Google: no OrganizationMember row
    // carries their e-mail, so the claim matches nothing and writes nothing.
    state.members = [pendingAdmin({ email: "ceo@example.com" })];

    const linked = await linkPendingAdminIdentity(
      fakeSupabase(googleUser({ email: "doctor@example.com" })),
    );

    expect(linked).toBe(false);
    expect(state.members[0]!.supabaseUserId).toBeNull();
  });

  it("never links an INACTIVE pending row", async () => {
    state.members = [pendingAdmin({ isActive: false })];
    expect(await linkPendingAdminIdentity(fakeSupabase(googleUser()))).toBe(false);
    expect(state.members[0]!.supabaseUserId).toBeNull();
  });

  it("never links a SOFT-DELETED pending row", async () => {
    state.members = [pendingAdmin({ deletedAt: new Date("2026-01-01") })];
    expect(await linkPendingAdminIdentity(fakeSupabase(googleUser()))).toBe(false);
    expect(state.members[0]!.supabaseUserId).toBeNull();
  });
});

describe("linkPendingAdminIdentity — idempotence and anti-hijack", () => {
  it("is a no-op for an admin already linked to THIS uid (count 0, role intact)", async () => {
    // Already linked: supabaseUserId is set, so the supabaseUserId=null
    // predicate matches nothing — the function reports no NEW link, while the
    // row (and the role the hook mints from it) is untouched. On the callback
    // path this means refreshSession is skipped; the admin already carries the
    // role from the token they just minted.
    state.members = [pendingAdmin({ supabaseUserId: CEO_UID })];

    const linked = await linkPendingAdminIdentity(fakeSupabase(googleUser()));

    expect(linked).toBe(false);
    expect(state.members[0]!.supabaseUserId).toBe(CEO_UID); // unchanged
  });

  it("never overwrites an admin row already linked to a DIFFERENT uid", async () => {
    // The anti-hijack invariant: even with a matching confirmed Google e-mail,
    // a row already claimed by another auth user is never re-pointed.
    state.members = [pendingAdmin({ supabaseUserId: OTHER_UID })];

    const linked = await linkPendingAdminIdentity(
      fakeSupabase(googleUser({ id: CEO_UID })),
    );

    expect(linked).toBe(false);
    expect(state.members[0]!.supabaseUserId).toBe(OTHER_UID); // not overwritten
  });

  it("claims exactly one of two concurrent pending rows is impossible to double-claim", async () => {
    // Two first-logins racing: the null predicate is the compare half of a
    // compare-and-set. Once the first write lands, the second matches nothing.
    state.members = [pendingAdmin()];

    const first = await linkPendingAdminIdentity(fakeSupabase(googleUser()));
    const second = await linkPendingAdminIdentity(
      fakeSupabase(googleUser({ id: OTHER_UID })),
    );

    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(state.members[0]!.supabaseUserId).toBe(CEO_UID); // first winner holds
  });
});
