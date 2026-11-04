// Server-side Doctor/clinic identity binding on invitation accept (P0 #1).
//
// SCOPE / LABEL: this is a MOCKED integration test. It runs the real
// acceptInvitation() logic, but over an in-memory JS stub of the Prisma client
// (no SQL engine, no database). It is NOT authenticated-acceptance evidence and
// NOT real-PostgreSQL evidence — it verifies only the branching/decision logic
// of acceptInvitation. Real PostgreSQL and authenticated Google acceptance
// remain separate, unverified gates; these tests establish neither.
//
// Invariants checked here:
//   • an EXISTING Doctor is linked (never duplicated), its id/clinic preserved;
//   • an OCCUPIED identity mapping is never overwritten or cross-linked.

import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Mocks (hoisted so vi.mock factories can see them) ────────────────────────
const h = vi.hoisted(() => {
  type Doctor = {
    id: string;
    clinicId: string;
    email: string;
    name: string | null;
    phone: string | null;
    supabaseUserId: string | null;
    supabasePhoneUserId: string | null;
    isActive: boolean;
    deletedAt: Date | null;
  };
  const store: {
    doctors: Doctor[];
    invitation: Record<string, unknown> | null;
    created: Doctor[];
    seq: number;
    clinic: { id: string; isActive: boolean; deletedAt: Date | null; status: string } | null;
  } = { doctors: [], invitation: null, created: [], seq: 0, clinic: null };

  const matchesDoctor = (where: Record<string, unknown>) => {
    if (Array.isArray((where as { OR?: unknown[] }).OR)) {
      const ors = (where as { OR: Record<string, string>[] }).OR;
      return store.doctors.find((d) =>
        ors.some((c) =>
          Object.entries(c).every(([k, v]) => (d as Record<string, unknown>)[k] === v),
        ),
      );
    }
    return store.doctors.find((d) =>
      Object.entries(where).every(([k, v]) => (d as Record<string, unknown>)[k] === v),
    );
  };

  const tx = {
    clinic: { findUnique: vi.fn(async () => store.clinic ? { ...store.clinic } : null) },
    clinicInvitation: {
      findUnique: vi.fn(async ({ where }: { where: { tokenHash: string } }) =>
        store.invitation && store.invitation.tokenHash === where.tokenHash
          ? { ...store.invitation }
          : null,
      ),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        if (store.invitation) Object.assign(store.invitation, data);
        return { ...(store.invitation as object) };
      }),
    },
    doctor: {
      findMany: vi.fn(async ({ where }: { where: { OR: Record<string, string>[] } }) =>
        store.doctors.filter(d => where.OR.some(c => Object.entries(c).every(([k,v]) => (d as Record<string, unknown>)[k] === v))).map(d => ({ ...d }))),
      findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        const d = matchesDoctor(where);
        return d ? { ...d } : null;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const d = store.doctors.find((x) => x.id === where.id)!;
        Object.assign(d, data);
        return { ...d };
      }),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const d = {
          id: `new-${++store.seq}`,
          supabasePhoneUserId: null,
          isActive: true,
          deletedAt: null,
          name: null,
          phone: null,
          ...(data as object),
        } as Doctor;
        store.doctors.push(d);
        store.created.push(d);
        return { ...d };
      }),
    },
  };

  const prisma = {
    $transaction: async (cb: (t: typeof tx) => unknown) => cb(tx),
  };

  return { store, prisma };
});

vi.mock("@/lib/prisma", () => ({ prisma: h.prisma }));
vi.mock("@/lib/notifications", () => ({ getNotificationService: () => ({ send: async () => ({ ok: true }) }) }));
vi.mock("@/lib/audit/writeAuditLog", () => ({ writeAuditLog: async () => {} }));
vi.mock("@prisma/client", () => ({
  Prisma: { TransactionIsolationLevel: { Serializable: "Serializable" } },
  SystemRole: { DOCTOR: "DOCTOR", CLINIC_ADMIN: "CLINIC_ADMIN", STAFF: "STAFF", ORG_ADMIN: "ORG_ADMIN", SUPER_ADMIN: "SUPER_ADMIN", PATIENT: "PATIENT" },
  InvitationStatus: { PENDING: "PENDING", ACCEPTED: "ACCEPTED", EXPIRED: "EXPIRED", REVOKED: "REVOKED" },
  NotificationChannel: { WHATSAPP: "WHATSAPP", SMS: "SMS", EMAIL: "EMAIL", IN_APP: "IN_APP" },
}));

import { acceptInvitation, InvitationError, hashInvitationToken } from "@/lib/invitations";

const RAW = "test-raw-token";
const CLINIC = "clinic-a";
const GMAIL = "sumitahuja742@gmail.com";

function seedInvitation(email = GMAIL) {
  h.store.invitation = {
    id: "inv-1",
    tokenHash: hashInvitationToken(RAW),
    clinicId: CLINIC,
    organizationId: null,
    role: "DOCTOR",
    email,
    phone: null,
    status: "PENDING",
    revokedAt: null,
    expiresAt: new Date(Date.now() + 3_600_000),
  };
}

function doctor(partial: Partial<Record<string, unknown>> & { id: string }) {
  return {
    clinicId: CLINIC,
    email: GMAIL,
    name: "Dr. Sumit Ahuja",
    phone: null,
    supabaseUserId: null,
    supabasePhoneUserId: null,
    isActive: true,
    deletedAt: null,
    ...partial,
  };
}

beforeEach(() => {
  h.store.doctors = [];
  h.store.invitation = null;
  h.store.created = [];
  h.store.seq = 0;
  h.store.clinic = { id: CLINIC, isActive: true, deletedAt: null, status: "ACTIVE" };
  vi.clearAllMocks();
});

describe("onboarding regressions", () => {
  it.each([
    { isActive: false, deletedAt: null },
    { isActive: true, deletedAt: new Date("2026-01-01") },
  ])("rejects a non-live Doctor without changing its state: %o", async (state) => {
    seedInvitation();
    h.store.doctors = [doctor({ id: "disabled", ...state }) as never];
    await expect(acceptInvitation({ rawToken: RAW, supabaseUserId: "uid-1", email: GMAIL, name: "test" })).rejects.toMatchObject({ code: "inactive_scope" });
    expect(h.store.doctors[0]).toMatchObject({ ...state, supabaseUserId: null });
    expect(h.store.invitation!.status).toBe("PENDING");
    expect(h.store.created).toHaveLength(0);
  });
  it.each(["missing", "inactive", "deleted", "suspended", "archived"])("rejects %s clinic before linking", async (kind) => {
    seedInvitation();
    h.store.doctors = [doctor({ id: "target" }) as never];
    if (kind === "missing") h.store.clinic = null;
    else if (kind === "inactive") h.store.clinic!.isActive = false;
    else if (kind === "deleted") h.store.clinic!.deletedAt = new Date("2026-01-01");
    else h.store.clinic!.status = kind.toUpperCase();
    await expect(acceptInvitation({ rawToken: RAW, supabaseUserId: "uid-1", email: GMAIL, name: "test" })).rejects.toMatchObject({ code: "inactive_scope" });
    expect(h.store.doctors[0]!.supabaseUserId).toBeNull();
    expect(h.store.invitation!.status).toBe("PENDING");
    expect(h.store.created).toHaveLength(0);
  });
  it.each([false, true])("rejects ANY other cross-column UID owner regardless of return order: %s", async (reverse) => {
    seedInvitation();
    const rows = [doctor({ id: "intended", supabaseUserId: "uid-1" }), doctor({ id: "other", clinicId: "clinic-b", email: "other@example.invalid", supabasePhoneUserId: "uid-1" })];
    h.store.doctors = (reverse ? rows.reverse() : rows) as never;
    await expect(acceptInvitation({ rawToken: RAW, supabaseUserId: "uid-1", email: GMAIL, name: "test" })).rejects.toMatchObject({ code: "identity_conflict" });
    expect(h.store.invitation!.status).toBe("PENDING");
    expect(h.store.created).toHaveLength(0);
  });
  it.each([null, "uid-1"])("preserves separate legacy phone UID with canonical %s", async (canonical) => {
    seedInvitation();
    h.store.doctors = [doctor({ id: "dual", supabaseUserId: canonical, supabasePhoneUserId: "legacy-phone" }) as never];
    await expect(acceptInvitation({ rawToken: RAW, supabaseUserId: "uid-1", email: GMAIL, name: "test" })).resolves.toMatchObject({ membershipId: "dual" });
    expect(h.store.doctors[0]).toMatchObject({ supabaseUserId: "uid-1", supabasePhoneUserId: "legacy-phone" });
    expect(h.store.created).toHaveLength(0);
  });
  it("never overwrites another canonical identity even if the phone identity matches", async () => {
    seedInvitation();
    h.store.doctors = [doctor({ id: "dual", supabaseUserId: "occupied", supabasePhoneUserId: "uid-1" }) as never];
    await expect(acceptInvitation({ rawToken: RAW, supabaseUserId: "uid-1", email: GMAIL, name: "test" })).rejects.toMatchObject({ code: "identity_conflict" });
    expect(h.store.doctors[0]).toMatchObject({ supabaseUserId: "occupied", supabasePhoneUserId: "uid-1" });
  });
});

describe("acceptInvitation — existing Doctor linking", () => {
  it("links the EXISTING Doctor row and never creates a duplicate", async () => {
    seedInvitation();
    h.store.doctors = [doctor({ id: "doc-sumit", supabaseUserId: null }) as never];

    const res = await acceptInvitation({ rawToken: RAW, supabaseUserId: "uid-1", email: GMAIL, name: "Dr. Sumit Ahuja" });

    expect(res.membershipType).toBe("doctor");
    expect(res.membershipId).toBe("doc-sumit"); // SAME id preserved
    expect(h.store.created).toHaveLength(0); // no duplicate created
    expect(h.store.doctors[0]!.supabaseUserId).toBe("uid-1"); // linked
    expect(h.store.invitation!.status).toBe("ACCEPTED");
  });

  it("is idempotent when re-accepted with the SAME identity", async () => {
    seedInvitation();
    h.store.doctors = [doctor({ id: "doc-sumit", supabaseUserId: "uid-1" }) as never];

    const res = await acceptInvitation({ rawToken: RAW, supabaseUserId: "uid-1", email: GMAIL, name: "x" });

    expect(res.membershipId).toBe("doc-sumit");
    expect(h.store.created).toHaveLength(0);
    expect(h.store.doctors[0]!.supabaseUserId).toBe("uid-1");
  });

  it("creates a row only for a genuinely new, unlinked clinician", async () => {
    seedInvitation("new.doctor@gmail.com");
    const res = await acceptInvitation({ rawToken: RAW, supabaseUserId: "uid-new", email: "new.doctor@gmail.com", name: "New Doc" });
    expect(res.membershipType).toBe("doctor");
    expect(h.store.created).toHaveLength(1);
    expect(h.store.created[0]!.supabaseUserId).toBe("uid-new");
  });
});

describe("acceptInvitation — refuses to overwrite / cross-link an occupied identity", () => {
  it("refuses when the matched Doctor is already bound to a DIFFERENT identity", async () => {
    seedInvitation();
    h.store.doctors = [doctor({ id: "doc-sumit", supabaseUserId: "uid-OTHER" }) as never];

    await expect(
      acceptInvitation({ rawToken: RAW, supabaseUserId: "uid-1", email: GMAIL, name: "x" }),
    ).rejects.toMatchObject({ code: "identity_conflict" });

    expect(h.store.doctors[0]!.supabaseUserId).toBe("uid-OTHER"); // unchanged
    expect(h.store.created).toHaveLength(0);
  });

  it("refuses when the account is already linked to ANOTHER clinician record", async () => {
    seedInvitation(); // invite email GMAIL, but the GMAIL row is NOT the one holding uid-1
    h.store.doctors = [
      doctor({ id: "doc-sumit", email: GMAIL, supabaseUserId: null }) as never,
      doctor({ id: "doc-elsewhere", email: "else@x.com", supabaseUserId: "uid-1" }) as never,
    ];

    await expect(
      acceptInvitation({ rawToken: RAW, supabaseUserId: "uid-1", email: GMAIL, name: "x" }),
    ).rejects.toBeInstanceOf(InvitationError);

    expect(h.store.doctors.find((d) => d.id === "doc-sumit")!.supabaseUserId).toBeNull();
    expect(h.store.created).toHaveLength(0);
  });

  it("refuses when the account is already a PHONE identity on another Doctor (cross-column)", async () => {
    // The two UNIQUE indexes are per-column; they do NOT stop one uid from being
    // supabaseUserId on one row and supabasePhoneUserId on another. The app-level
    // check (OR over both columns) is what prevents this cross-column collision.
    seedInvitation(); // invite email GMAIL → matches doc-sumit
    h.store.doctors = [
      doctor({ id: "doc-sumit", email: GMAIL, supabaseUserId: null, supabasePhoneUserId: null }) as never,
      doctor({ id: "doc-phone", email: "p@x.com", supabaseUserId: null, supabasePhoneUserId: "uid-1" }) as never,
    ];

    await expect(
      acceptInvitation({ rawToken: RAW, supabaseUserId: "uid-1", email: GMAIL, name: "x" }),
    ).rejects.toMatchObject({ code: "identity_conflict" });

    expect(h.store.doctors.find((d) => d.id === "doc-sumit")!.supabaseUserId).toBeNull();
    expect(h.store.created).toHaveLength(0);
  });

  it("refuses to cross-link an account already tied to a Doctor in ANOTHER clinic", async () => {
    seedInvitation(); // clinic-a, email GMAIL (no clinic-a doctor with that email)
    h.store.doctors = [doctor({ id: "doc-b", clinicId: "clinic-b", email: "b@x.com", supabaseUserId: "uid-1" }) as never];

    await expect(
      acceptInvitation({ rawToken: RAW, supabaseUserId: "uid-1", email: GMAIL, name: "x" }),
    ).rejects.toMatchObject({ code: "identity_conflict" });
    expect(h.store.created).toHaveLength(0);
  });
});
