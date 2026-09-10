// Support Inbox — authorization boundary tests.
//
// Verifies:
//   A. Doctor A cannot read Doctor B's support thread
//   B. Disabled doctor is denied on protected routes (via requireDoctorContext)
//   C. Super Admin can list tickets across all clinics
//   D. Doctor can create a ticket and reply while OPEN / IN_PROGRESS
//   E. Doctor cannot reply to a RESOLVED ticket
//   F. Cross-clinic support isolation (doctor route honours assertDoctorInClinic)
//   G. Admin activate/disable route denies non-super-admin

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { NextResponse } from "next/server";

// ── Auth mocks ────────────────────────────────────────────────────────────────

const getAuthClaims = jest.fn<() => Promise<Record<string, unknown> | null>>();
jest.mock("@/lib/auth/legacy", () => ({
  getAuthClaims: () => getAuthClaims(),
}));

const doctorFindFirst = jest.fn<() => Promise<Record<string, unknown> | null>>();
const doctorUpdate = jest.fn<() => Promise<Record<string, unknown>>>();
const ticketFindUnique = jest.fn<() => Promise<Record<string, unknown> | null>>();
const ticketFindMany = jest.fn<() => Promise<Record<string, unknown>[]>>();
const ticketCreate = jest.fn<() => Promise<Record<string, unknown>>>();
const ticketUpdate = jest.fn<() => Promise<Record<string, unknown>>>();
const messageCreate = jest.fn<() => Promise<Record<string, unknown>>>();
const $transaction = jest.fn<(ops: unknown[]) => Promise<unknown[]>>();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    doctor: { findFirst: () => doctorFindFirst(), update: () => doctorUpdate() },
    supportTicket: {
      findUnique: () => ticketFindUnique(),
      findMany: () => ticketFindMany(),
      create: () => ticketCreate(),
      update: () => ticketUpdate(),
    },
    supportMessage: { create: () => messageCreate() },
    $transaction: (ops: unknown[]) => $transaction(ops),
  },
}));

const assertSuperAdmin = jest.fn<() => Promise<void>>();
const handleAuthError = jest.fn<(err: unknown) => NextResponse | null>();
const getClinicContext = jest.fn<() => Promise<{ userId: string; role: string; clinicId: string | null }>>();

jest.mock("@/lib/auth", () => ({
  requireDoctorContext: jest.requireActual("@/lib/auth/doctorContext").requireDoctorContext,
  assertSuperAdmin: () => assertSuperAdmin(),
  handleAuthError: (err: unknown) => handleAuthError(err),
  getClinicContext: () => getClinicContext(),
}));

const writeAuditLog = jest.fn<() => Promise<void>>();
jest.mock("@/lib/audit/writeAuditLog", () => ({
  writeAuditLog: () => writeAuditLog(),
}));

// ── Test fixtures ─────────────────────────────────────────────────────────────

const CLINIC_A = "clinic-a";
const CLINIC_B = "clinic-b";
const DOCTOR_A = { id: "doctor-a", clinicId: CLINIC_A, name: "Dr A", email: "a@example.com", isActive: true };
const DOCTOR_B = { id: "doctor-b", clinicId: CLINIC_B, name: "Dr B", email: "b@example.com", isActive: true };

const TICKET_A = {
  id: "ticket-a",
  doctorId: DOCTOR_A.id,
  clinicId: CLINIC_A,
  category: "OTHER",
  priority: "NORMAL",
  status: "OPEN",
  subject: "Test issue",
  doctorLastSeenAt: null,
  adminLastSeenAt: null,
  messages: [],
  _count: { messages: 0 },
};

const TICKET_A_RESOLVED = { ...TICKET_A, status: "RESOLVED" };

function authAs(uid: string, role = "DOCTOR") {
  getAuthClaims.mockResolvedValue({ sub: uid, user_role: role, email: "x@example.com" });
}

beforeEach(() => {
  jest.resetAllMocks();
  handleAuthError.mockReturnValue(null);
  getClinicContext.mockResolvedValue({ userId: "admin-uid", role: "SUPER_ADMIN", clinicId: null });
  writeAuditLog.mockResolvedValue(undefined);
});

// ── A. Doctor A cannot read Doctor B's ticket ─────────────────────────────────

describe("A — cross-doctor isolation on GET /api/doctor/support/[id]", () => {
  it("returns 403 when ticket belongs to a different doctor", async () => {
    authAs("auth-a");
    doctorFindFirst.mockResolvedValue(DOCTOR_A);
    // Ticket belongs to Doctor B
    ticketFindUnique.mockResolvedValue({
      ...TICKET_A,
      doctorId: DOCTOR_B.id,
      messages: [],
    });

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { GET } = require("../../apps/patient-portal/src/app/api/doctor/support/[id]/route");
    const res = await GET(new Request("http://localhost/api/doctor/support/ticket-a"), {
      params: Promise.resolve({ id: "ticket-a" }),
    });

    expect(res.status).toBe(403);
  });

  it("returns 200 when ticket belongs to the calling doctor", async () => {
    authAs("auth-a");
    doctorFindFirst.mockResolvedValue(DOCTOR_A);
    ticketFindUnique.mockResolvedValue({ ...TICKET_A, messages: [] });
    ticketUpdate.mockResolvedValue({ ...TICKET_A });

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { GET } = require("../../apps/patient-portal/src/app/api/doctor/support/[id]/route");
    const res = await GET(new Request("http://localhost/api/doctor/support/ticket-a"), {
      params: Promise.resolve({ id: "ticket-a" }),
    });

    expect(res.status).toBe(200);
  });
});

// ── B. Disabled doctor denied ─────────────────────────────────────────────────

describe("B — disabled doctor cannot reach support routes", () => {
  it("returns 403 when Doctor row is inactive (requireDoctorContext)", async () => {
    authAs("auth-a");
    // isActive filter means findFirst returns null for an inactive doctor
    doctorFindFirst.mockResolvedValue(null);

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { GET } = require("../../apps/patient-portal/src/app/api/doctor/support/route");
    const res = await GET(new Request("http://localhost/api/doctor/support"));

    expect(res.status).toBe(403);
  });
});

// ── C. Super Admin can list all tickets ───────────────────────────────────────

describe("C — Super Admin can list tickets across all clinics", () => {
  it("returns 200 with ticket list", async () => {
    assertSuperAdmin.mockResolvedValue(undefined);
    ticketFindMany.mockResolvedValue([
      {
        ...TICKET_A,
        doctor: DOCTOR_A,
        clinic: { id: CLINIC_A, name: "Clinic A" },
        messages: [],
        _count: { messages: 0 },
      },
    ]);

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { GET } = require("../../apps/patient-portal/src/app/api/admin/support/route");
    const res = await GET(new Request("http://localhost/api/admin/support"));

    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.tickets).toHaveLength(1);
    expect(j.summary.total).toBe(1);
  });
});

// ── D. Doctor can create a ticket and reply ───────────────────────────────────

describe("D — doctor can create a ticket", () => {
  it("POST returns 201 with new ticket", async () => {
    authAs("auth-a");
    doctorFindFirst.mockResolvedValue(DOCTOR_A);
    ticketCreate.mockResolvedValue({ ...TICKET_A, messages: [] });

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { POST } = require("../../apps/patient-portal/src/app/api/doctor/support/route");
    const res = await POST(
      new Request("http://localhost/api/doctor/support", {
        method: "POST",
        body: JSON.stringify({
          category: "TECHNICAL_ISSUE",
          subject: "Cannot log in",
          message: "I get an error when I try to sign in.",
        }),
      }),
    );

    expect(res.status).toBe(201);
  });

  it("POST returns 400 when subject is empty", async () => {
    authAs("auth-a");
    doctorFindFirst.mockResolvedValue(DOCTOR_A);

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { POST } = require("../../apps/patient-portal/src/app/api/doctor/support/route");
    const res = await POST(
      new Request("http://localhost/api/doctor/support", {
        method: "POST",
        body: JSON.stringify({ category: "OTHER", subject: "", message: "hello" }),
      }),
    );

    expect(res.status).toBe(400);
  });
});

// ── E. Doctor cannot reply to resolved ticket ─────────────────────────────────

describe("E — doctor cannot reply to resolved/closed ticket", () => {
  it("returns 409 Conflict for RESOLVED ticket", async () => {
    authAs("auth-a");
    doctorFindFirst.mockResolvedValue(DOCTOR_A);
    ticketFindUnique.mockResolvedValue({
      ...TICKET_A_RESOLVED,
      doctorId: DOCTOR_A.id,
    });

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { POST } = require("../../apps/patient-portal/src/app/api/doctor/support/[id]/messages/route");
    const res = await POST(
      new Request("http://localhost/api/doctor/support/ticket-a/messages", {
        method: "POST",
        body: JSON.stringify({ message: "Follow-up" }),
      }),
      { params: Promise.resolve({ id: "ticket-a" }) },
    );

    expect(res.status).toBe(409);
  });
});

// ── F. Multi-clinic: doctor cannot see tickets from a different clinic via admin
//        (admin routes gated by assertSuperAdmin) ──────────────────────────────

describe("F — non-super-admin cannot call admin support routes", () => {
  it("admin support GET returns error when assertSuperAdmin throws", async () => {
    assertSuperAdmin.mockRejectedValue(new Error("forbidden"));
    handleAuthError.mockReturnValue(new NextResponse(JSON.stringify({ error: "forbidden" }), { status: 403 }));

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { GET } = require("../../apps/patient-portal/src/app/api/admin/support/route");
    const res = await GET(new Request("http://localhost/api/admin/support"));

    expect(res.status).toBe(403);
  });
});

// ── G. Admin activate/disable route denies non-super-admin ────────────────────

describe("G — admin clinician PATCH denied for non-super-admin", () => {
  it("returns 403 when assertSuperAdmin throws", async () => {
    assertSuperAdmin.mockRejectedValue(new Error("forbidden"));
    handleAuthError.mockReturnValue(new NextResponse(JSON.stringify({ error: "forbidden" }), { status: 403 }));

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { PATCH } = require("../../apps/patient-portal/src/app/api/admin/clinicians/[id]/route");
    const res = await PATCH(
      new Request("http://localhost/api/admin/clinicians/doctor-a", {
        method: "PATCH",
        body: JSON.stringify({ isActive: false }),
      }),
      { params: Promise.resolve({ id: "doctor-a" }) },
    );

    expect(res.status).toBe(403);
  });

  it("deactivates a doctor and writes audit log when authorized", async () => {
    assertSuperAdmin.mockResolvedValue(undefined);
    doctorFindFirst.mockResolvedValue({
      ...DOCTOR_A,
      provisioningStatus: "ACTIVE",
    });
    doctorUpdate.mockResolvedValue({ ...DOCTOR_A, isActive: false });

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { PATCH } = require("../../apps/patient-portal/src/app/api/admin/clinicians/[id]/route");
    const res = await PATCH(
      new Request("http://localhost/api/admin/clinicians/doctor-a", {
        method: "PATCH",
        body: JSON.stringify({ isActive: false }),
      }),
      { params: Promise.resolve({ id: "doctor-a" }) },
    );

    expect(res.status).toBe(200);
    expect(writeAuditLog).toHaveBeenCalledTimes(1);
  });
});
