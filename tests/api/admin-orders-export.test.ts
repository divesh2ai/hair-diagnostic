// Super Admin — Kit Order Intent Excel export.
//
// The export is the widest cross-tenant read in the console: one request
// returns every clinic's order intents. So the tests below assert three
// separate things, and a failure in any one of them is a security finding,
// not a formatting nit:
//
//   1. Only SUPER_ADMIN can reach it.
//   2. No patient-identifying or clinical field can leak into the workbook
//      or into the audit envelope.
//   3. The export FAILS CLOSED — no audit row, no file.
//
// Reconciliation tests matter for a different reason: every summary tab is
// derived from the same in-memory rows, and these lock that property in so a
// future refactor cannot let one tab silently disagree with another.
//
// Runner: JEST. `npm test` is vitest and will mis-report this file.
//   npx jest tests/api/admin-orders-export.test.ts

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import ExcelJS from "exceljs";

type Row = Record<string, unknown>;

// ── Auth, switchable per test ──────────────────────────────────────────────
class ForbiddenError extends Error {
  constructor(m = "Super Admin only") {
    super(m);
    this.name = "ForbiddenError";
  }
}
class UnauthorizedError extends Error {
  constructor(m = "Unauthorized") {
    super(m);
    this.name = "Unauthorized";
  }
}

const SUPER_ADMIN_CTX = {
  userId: "admin-77",
  role: "SUPER_ADMIN",
  clinicId: null,
};
let authImpl: () => Promise<typeof SUPER_ADMIN_CTX> = () =>
  Promise.resolve(SUPER_ADMIN_CTX);

jest.mock("@/lib/auth", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { NextResponse } = require("next/server");
  return {
    assertSuperAdmin: () => authImpl(),
    handleAuthError: (err: Error) => {
      if (err?.name === "ForbiddenError")
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      if (err?.name === "Unauthorized")
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      return null;
    },
  };
});

// ── Prisma, with captured query shapes ─────────────────────────────────────
let capturedWhere: Row | null = null;
let intentRows: Row[] = [];
let intentCount = 0;
let clinicRows: Row[] = [];
const auditCreate = jest.fn<(a: { data: Row }) => Promise<Row>>();

const txMock = {
  clinic: { findMany: () => Promise.resolve(clinicRows) },
  kitOrderIntent: {
    count: (args: { where: Row }) => {
      capturedWhere = args.where;
      return Promise.resolve(intentCount);
    },
    findMany: (args: { where: Row }) => {
      capturedWhere = args.where;
      return Promise.resolve(intentRows);
    },
  },
};

jest.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: (fn: (tx: typeof txMock) => unknown) => Promise.resolve(fn(txMock)),
    auditLog: { create: (a: { data: Row }) => auditCreate(a) },
  },
}));

jest.mock("@hairos/packages/registries/kits/info", () => ({
  getKitInfo: (kitId: string) =>
    kitId === "RETIRED_KIT" ? null : { displayName: `Kit ${kitId}` },
}));

/* eslint-disable @typescript-eslint/no-var-requires */
const exportRoute = require("../../apps/patient-portal/src/app/api/admin/orders/export/route");

// ── Fixtures ───────────────────────────────────────────────────────────────
const CLINIC_A = {
  id: "clinic-a",
  name: "Mumbai Hair Clinic",
  locations: [{ state: "Maharashtra", city: "Mumbai" }],
};
const CLINIC_B = {
  id: "clinic-b",
  name: "Delhi Scalp Centre",
  locations: [{ state: "Delhi", city: "New Delhi" }],
};

function intent(over: Partial<Row> = {}): Row {
  return {
    id: "intent-1",
    createdAt: new Date("2026-08-01T06:30:00.000Z"),
    status: "READY_FOR_FULFILMENT",
    clinicId: "clinic-a",
    kitIds: ["MPHL"],
    quantities: null,
    doctor: { name: "Dr Meera Rao" },
    assessment: { id: "assess-1", source: "QR", patientId: "patient-cuid-1" },
    ...over,
  };
}

function req(qs = ""): Request {
  return new Request(`https://x.test/api/admin/orders/export${qs}`);
}

async function loadWorkbook(res: Response): Promise<ExcelJS.Workbook> {
  const buf = Buffer.from(await res.arrayBuffer());
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  return wb;
}

beforeEach(() => {
  authImpl = () => Promise.resolve(SUPER_ADMIN_CTX);
  capturedWhere = null;
  clinicRows = [CLINIC_A, CLINIC_B];
  intentRows = [intent()];
  intentCount = 1;
  auditCreate.mockReset();
  auditCreate.mockResolvedValue({});
});

// ── 1–4 Authorization and validation ───────────────────────────────────────

describe("authorization", () => {
  it("rejects an unauthenticated request with 401", async () => {
    authImpl = () => Promise.reject(new UnauthorizedError());
    const res = await exportRoute.GET(req());
    expect(res.status).toBe(401);
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it("rejects a non-Super-Admin role with 403", async () => {
    // assertSuperAdmin gates on canAccessSuperAdminConsole, which admits
    // SUPER_ADMIN only — ORG_ADMIN, CLINIC_ADMIN, STAFF and DOCTOR all throw.
    authImpl = () => Promise.reject(new ForbiddenError());
    const res = await exportRoute.GET(req());
    expect(res.status).toBe(403);
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it("allows SUPER_ADMIN and returns a workbook", async () => {
    const res = await exportRoute.GET(req());
    expect(res.status).toBe(200);
  });

  it("rejects invalid filters with 400", async () => {
    const bad = await exportRoute.GET(req("?status=DELIVERED"));
    expect(bad.status).toBe(400);
    expect((await bad.json()).error).toBe("validation");

    const badDate = await exportRoute.GET(req("?from=last-tuesday"));
    expect(badDate.status).toBe(400);
    expect(auditCreate).not.toHaveBeenCalled();
  });
});

// ── 5–8 Filtering and soft deletion ────────────────────────────────────────

describe("filtering", () => {
  it("applies a date range to createdAt", async () => {
    await exportRoute.GET(
      req("?from=2026-07-01T00:00:00.000Z&to=2026-07-31T23:59:59.000Z"),
    );
    const range = (capturedWhere as Row).createdAt as { gte: Date; lt?: Date; lte: Date };
    expect(range.gte).toEqual(new Date("2026-07-01T00:00:00.000Z"));
    expect(range.lte).toEqual(new Date("2026-07-31T23:59:59.000Z"));
  });

  it("filters by state via the clinic's primary location", async () => {
    await exportRoute.GET(req("?state=Delhi"));
    // Geography lives on ClinicLocation, so a state filter resolves to a
    // clinic id scope rather than a column on the intent.
    expect((capturedWhere as Row).clinicId).toEqual({ in: ["clinic-b"] });
  });

  it("filters by clinic", async () => {
    await exportRoute.GET(req("?clinicId=clinic-a"));
    expect((capturedWhere as Row).clinicId).toEqual({ in: ["clinic-a"] });
  });

  it("excludes soft-deleted related records", async () => {
    await exportRoute.GET(req());
    const w = capturedWhere as Row;
    // KitOrderIntent itself has no deletedAt column, so soft deletion is
    // enforced through every relation that does support it.
    expect(w.clinic).toEqual({ deletedAt: null });
    expect(w.assessment).toEqual({ deletedAt: null });
    expect(w.doctor).toEqual({ deletedAt: null });
  });
});

// ── 9–12 Workbook structure and reconciliation ─────────────────────────────

describe("workbook structure", () => {
  it("contains every expected tab and no blank default sheet", async () => {
    const wb = await loadWorkbook(await exportRoute.GET(req()));
    const names = wb.worksheets.map((w) => w.name);
    expect(names).toEqual([
      "Executive Summary",
      "State Summary",
      "Clinic Summary",
      "Intent Details",
      "Kit Summary",
      "Export Metadata",
      "Data Dictionary",
    ]);
    // No Payment & Fulfilment tab: this application stores neither.
    expect(names).not.toContain("Payment & Fulfilment");
  });

  it("reconciles state totals to Intent Details", async () => {
    intentRows = [
      intent({ id: "i1", clinicId: "clinic-a", kitIds: ["MPHL"] }),
      intent({ id: "i2", clinicId: "clinic-a", kitIds: ["MPHL"] }),
      intent({ id: "i3", clinicId: "clinic-b", kitIds: ["MPHL"] }),
    ];
    intentCount = 3;
    const wb = await loadWorkbook(await exportRoute.GET(req()));

    const details = wb.getWorksheet("Intent Details")!;
    const detailValues: number[] = [];
    details.eachRow((row, n) => {
      if (n > 3) detailValues.push(row.getCell(10).value as number);
    });
    expect(detailValues).toHaveLength(3);

    const state = wb.getWorksheet("State Summary")!;
    let stateIntents = 0;
    let stateValue = 0;
    state.eachRow((row, n) => {
      if (n > 3) {
        stateIntents += row.getCell(2).value as number;
        stateValue += row.getCell(4).value as number;
      }
    });
    expect(stateIntents).toBe(3);
    expect(stateValue).toBe(detailValues.reduce((a, b) => a + b, 0));
  });

  it("reconciles clinic totals to Intent Details", async () => {
    intentRows = [
      intent({ id: "i1", clinicId: "clinic-a" }),
      intent({ id: "i2", clinicId: "clinic-b" }),
    ];
    intentCount = 2;
    const wb = await loadWorkbook(await exportRoute.GET(req()));
    const clinic = wb.getWorksheet("Clinic Summary")!;
    let intents = 0;
    clinic.eachRow((row, n) => {
      if (n > 3) intents += row.getCell(5).value as number;
    });
    expect(intents).toBe(2);
  });

  it("reconciles kit units to the lineups in Intent Details", async () => {
    intentRows = [
      intent({ id: "i1", kitIds: ["MPHL", "GI_GOLD"], quantities: { MPHL: 2 } }),
    ];
    intentCount = 1;
    const wb = await loadWorkbook(await exportRoute.GET(req()));

    const kit = wb.getWorksheet("Kit Summary")!;
    let units = 0;
    kit.eachRow((row, n) => {
      if (n > 3) units += row.getCell(4).value as number;
    });
    // MPHL ×2 plus GI_GOLD ×1 (absent quantity means one of that kit).
    expect(units).toBe(3);

    const details = wb.getWorksheet("Intent Details")!;
    expect(details.getRow(4).getCell(9).value).toBe(3);
  });
});

// ── 13–14 Cell typing ──────────────────────────────────────────────────────

describe("cell types", () => {
  it("writes currency as a number with a rupee format, never a string", async () => {
    const wb = await loadWorkbook(await exportRoute.GET(req()));
    const cell = wb.getWorksheet("Intent Details")!.getRow(4).getCell(10);
    expect(typeof cell.value).toBe("number");
    expect(cell.numFmt).toBe('"₹"#,##0');
  });

  it("writes timestamps as typed dates, not text", async () => {
    const wb = await loadWorkbook(await exportRoute.GET(req()));
    const cell = wb.getWorksheet("Intent Details")!.getRow(4).getCell(2);
    expect(cell.value).toBeInstanceOf(Date);
    expect(cell.numFmt).toBe("yyyy-mm-dd hh:mm");
    // Stored 06:30 UTC must display as 12:00 IST (UTC+05:30).
    expect((cell.value as Date).toISOString()).toContain("12:00");
  });
});

// ── 15–16 Privacy and injection ────────────────────────────────────────────

describe("privacy and injection safety", () => {
  it("never writes patient-identifying or clinical fields", async () => {
    intentRows = [
      intent({
        assessment: {
          id: "assess-1",
          source: "QR",
          patientId: "patient-cuid-1",
          // Even if a future select accidentally widens, these must not
          // reach the sheet — the builder only reads whitelisted fields.
          patient: {
            name: "Anita Sharma",
            phone: "+919876543210",
            email: "anita@example.com",
          },
        },
      }),
    ];
    const wb = await loadWorkbook(await exportRoute.GET(req()));

    let dump = "";
    wb.eachSheet((ws) => {
      ws.eachRow((row) => {
        row.eachCell((c) => {
          dump += ` ${String(c.value ?? "")}`;
        });
      });
    });

    for (const forbidden of [
      "Anita Sharma",
      "+919876543210",
      "anita@example.com",
    ]) {
      expect(dump).not.toContain(forbidden);
    }
    // The pseudonymous reference IS present — it is what reconciliation needs.
    expect(dump).toContain("patient-cuid-1");
  });

  it("escapes formula-injection strings from the database", async () => {
    clinicRows = [
      {
        id: "clinic-a",
        name: "=HYPERLINK(\"http://evil\",\"click\")",
        locations: [{ state: "+SUM(A1)", city: "@cmd" }],
      },
    ];
    intentRows = [intent({ doctor: { name: "-2+3" } })];
    const wb = await loadWorkbook(await exportRoute.GET(req()));
    const row = wb.getWorksheet("Intent Details")!.getRow(4);

    expect(String(row.getCell(6).value)).toMatch(/^'=/); // clinic name
    expect(String(row.getCell(3).value)).toMatch(/^'\+/); // state
    expect(String(row.getCell(4).value)).toMatch(/^'@/); // city
    expect(String(row.getCell(12).value)).toMatch(/^'-/); // doctor

    // And nothing was written as a live formula.
    expect(row.getCell(6).type).not.toBe(ExcelJS.ValueType.Formula);
  });
});

// ── 17–19 Audit ────────────────────────────────────────────────────────────

describe("audit", () => {
  it("writes ADMIN_ORDER_EXPORT with actor, filters and row count", async () => {
    intentRows = [intent({ id: "i1" }), intent({ id: "i2" })];
    intentCount = 2;
    const res = await exportRoute.GET(req("?state=Maharashtra"));
    expect(res.status).toBe(200);

    expect(auditCreate).toHaveBeenCalledTimes(1);
    const data = auditCreate.mock.calls[0]![0].data;
    expect(data.action).toBe("ADMIN_ORDER_EXPORT");
    expect(data.actorId).toBe("admin-77");
    expect(data.actorRole).toBe("SUPER_ADMIN");
    expect(data.actorType).toBe("admin");

    const meta = data.metadata as Row;
    expect(meta.rowCount).toBe(2);
    expect(meta.filters).toEqual({ state: "Maharashtra" });
    expect(typeof meta.durationMs).toBe("number");
    expect(String(meta.filename)).toMatch(/^drfact-kit-order-intents-.*IST\.xlsx$/);
  });

  it("keeps patient and clinical data out of audit metadata", async () => {
    await exportRoute.GET(req());
    const meta = JSON.stringify(auditCreate.mock.calls[0]![0].data.metadata);
    for (const forbidden of [
      "patient-cuid-1",
      "Dr Meera Rao",
      "MPHL",
      "assess-1",
      "Mumbai Hair Clinic",
    ]) {
      expect(meta).not.toContain(forbidden);
    }
  });

  it("FAILS CLOSED: an audit write failure withholds the workbook", async () => {
    auditCreate.mockRejectedValue(new Error("audit table unavailable"));
    const res = await exportRoute.GET(req());
    // A privileged cross-tenant export absent from the audit trail is not an
    // acceptable outcome, so the file is sacrificed instead.
    expect(res.status).toBe(500);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(res.headers.get("content-disposition")).toBeNull();
  });
});

// ── 20–22 Limits, transport, contracts ─────────────────────────────────────

describe("row limit and transport", () => {
  it("refuses an oversized export instead of truncating it", async () => {
    intentCount = 500_000;
    const res = await exportRoute.GET(req());
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("too_many_rows");
    expect(body.message).toMatch(/Narrow the date range/);
    expect(body.count).toBe(500_000);
    // Nothing partial was produced, and nothing was audited.
    expect(res.headers.get("content-disposition")).toBeNull();
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it("returns the correct MIME type and attachment filename", async () => {
    const res = await exportRoute.GET(req());
    expect(res.headers.get("content-type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    const cd = res.headers.get("content-disposition") ?? "";
    expect(cd).toMatch(/^attachment; filename="drfact-kit-order-intents-/);
    expect(cd).toMatch(/-IST\.xlsx"$/);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("REGRESSION: an unpriced kit is excluded from value, never defaulted to ₹5,500", async () => {
    // priceForKit() substitutes an undocumented DEFAULT_PRICE_INR of ₹5,500
    // for any kit missing from the sheet. Folding that into a financial total
    // makes the dashboard look more complete than the data is. UNPRICED_KIT
    // is absent from KIT_PRICE_INR, so this intent must contribute nothing.
    intentRows = [
      intent({ id: "priced", kitIds: ["MPHL"] }),
      intent({ id: "unpriced", kitIds: ["UNPRICED_KIT"] }),
    ];
    intentCount = 2;
    const wb = await loadWorkbook(await exportRoute.GET(req()));

    const details = wb.getWorksheet("Intent Details")!;
    const values: unknown[] = [];
    details.eachRow((row, n) => {
      if (n > 3) values.push(row.getCell(10).value);
    });
    // One real number, one explicit "Unavailable" — never a 0 (which a reader
    // would sum) and never 5500 (which would be invented).
    expect(values).toContain("Unavailable");
    expect(values).not.toContain(5500);
    expect(values).not.toContain(0);

    const state = wb.getWorksheet("State Summary")!;
    let stateValue = 0;
    let excluded = 0;
    state.eachRow((row, n) => {
      if (n > 3) {
        stateValue += (row.getCell(4).value as number) || 0;
        excluded += (row.getCell(5).value as number) || 0;
      }
    });
    // Only the priced intent contributes: 6500, not 6500 + 5500.
    expect(stateValue).toBe(6500);
    expect(excluded).toBe(1);
  });

  it("REGRESSION: the exclusion count is stated in the Executive Summary", async () => {
    intentRows = [
      intent({ id: "priced", kitIds: ["MPHL"] }),
      intent({ id: "unpriced", kitIds: ["UNPRICED_KIT"] }),
    ];
    intentCount = 2;
    const wb = await loadWorkbook(await exportRoute.GET(req()));
    let dump = "";
    wb.getWorksheet("Executive Summary")!.eachRow((row) => {
      row.eachCell((c) => {
        dump += ` ${String(c.value ?? "")}`;
      });
    });
    expect(dump).toContain("EXCLUDED from indicative value");
    expect(dump).toMatch(/1 of 2 order intents are excluded/);
  });

  it("REGRESSION: units are still counted for an unpriced kit", async () => {
    // Volume is known even when value is not — suppressing both would lose
    // real operational information.
    intentRows = [
      intent({ id: "unpriced", kitIds: ["UNPRICED_KIT"], quantities: { UNPRICED_KIT: 4 } }),
    ];
    intentCount = 1;
    const wb = await loadWorkbook(await exportRoute.GET(req()));
    expect(wb.getWorksheet("Intent Details")!.getRow(4).getCell(9).value).toBe(4);

    const kit = wb.getWorksheet("Kit Summary")!;
    expect(kit.getRow(4).getCell(4).value).toBe(4); // units
    expect(kit.getRow(4).getCell(5).value).toBe("Unavailable"); // value
    expect(kit.getRow(4).getCell(6).value).toBe("Unavailable"); // unit price
  });

  it("records unavailable commercial fields honestly in metadata", async () => {
    // Guards the central promise of this feature: the workbook must never
    // imply a payment or fulfilment state the database cannot support.
    const wb = await loadWorkbook(await exportRoute.GET(req()));
    let dump = "";
    wb.getWorksheet("Export Metadata")!.eachRow((row) => {
      row.eachCell((c) => {
        dump += ` ${String(c.value ?? "")}`;
      });
    });
    expect(dump).toContain("No payment/invoice/transaction model exists");
    expect(dump).toContain("No fulfilment model exists");
    expect(dump).toContain("Indicative only");
  });
});
