import { describe, it, expect } from "vitest";
import {
  formatAgeGender,
  formatInrCompact,
  deltaSummary,
  deltaLines,
  systemRecommendedText,
  kitListText,
} from "@/lib/doctor/orderSummary/present";
import { buildSummaryCsv } from "@/lib/doctor/orderSummary/csv";
import type { SummaryRow } from "@/lib/doctor/orderSummary/query";
import { computeOrderDelta } from "@/lib/doctor/orderSummary/delta";

// Presentation + export semantics. The row shape is built by hand so the test
// does not need a database — it exercises exactly what the CSV/Excel and the
// page render from a row.

function line(kitId: string, displayName: string, price: number | null) {
  return { kitId, displayName, quantity: 1, unitPriceInr: price };
}

function makeRow(over: Partial<SummaryRow> = {}): SummaryRow {
  const system = [line("FPHL", "FPHL Pro", 6500), line("TE_GOLD", "TE Gold", 5900)];
  const final = [line("FPHL", "FPHL Pro", 6500), line("IRON_UP_GOLD", "PRO FACT IRON UP", 5200)];
  return {
    intentId: "int_1",
    createdAt: new Date("2026-08-24T09:30:00.000Z"),
    status: "READY_FOR_FULFILMENT",
    clinicId: "clinic_1",
    clinicName: "Dr FACT Mumbai",
    doctorName: "Dr Divesh",
    assessmentId: "asmt_1",
    patientName: "Neha Verma",
    age: 29,
    gender: "Female",
    goals: ["Reduce shedding"],
    symptoms: ["Shedding", "Thinning"],
    systemRecommended: system,
    finalKits: final,
    finalKitCount: 2,
    delta: computeOrderDelta(
      system.map((l) => ({ kitId: l.kitId })),
      final.map((l) => ({ kitId: l.kitId })),
    ),
    totalInr: 6500 + 5200,
    dataQualityFlags: [],
    ...over,
  };
}

describe("formatAgeGender", () => {
  it("combines, falls back, and dashes when empty", () => {
    expect(formatAgeGender(29, "Female")).toBe("29 · Female");
    expect(formatAgeGender(29, null)).toBe("29");
    expect(formatAgeGender(null, "Male")).toBe("Male");
    expect(formatAgeGender(null, null)).toBe("—");
  });
});

describe("formatInrCompact", () => {
  it("uses lakh notation above 1L", () => {
    expect(formatInrCompact(382500)).toBe("₹3.83L");
    expect(formatInrCompact(12000)).toBe("₹12,000");
  });
});

describe("delta rendering", () => {
  it("renders a clean one-for-one swap as a replacement", () => {
    // makeRow removes TE Gold and adds Iron Up — a single clean swap.
    const row = makeRow();
    expect(deltaLines(row)).toEqual(["TE Gold → PRO FACT IRON UP"]);
    expect(deltaSummary(row)).toBe("TE Gold → PRO FACT IRON UP");
  });

  it("shows independent add/remove lines when it is not a clean swap", () => {
    const system = [line("FPHL", "FPHL Pro", 6500), line("TE_GOLD", "TE Gold", 5900)];
    const final = [
      line("FPHL", "FPHL Pro", 6500),
      line("IRON_UP_GOLD", "PRO FACT IRON UP", 5200),
      line("GI_GOLD", "GI Gold", 5500),
    ];
    const row = makeRow({
      systemRecommended: system,
      finalKits: final,
      finalKitCount: 3,
      delta: computeOrderDelta(
        system.map((l) => ({ kitId: l.kitId })),
        final.map((l) => ({ kitId: l.kitId })),
      ),
    });
    const lines = deltaLines(row);
    expect(lines).toContain("− TE Gold");
    expect(lines).toContain("+ PRO FACT IRON UP");
    expect(lines).toContain("+ GI Gold");
  });

  it("renders 'No change' when unchanged", () => {
    const same = [line("FPHL", "FPHL Pro", 6500)];
    const row = makeRow({
      systemRecommended: same,
      finalKits: same,
      finalKitCount: 1,
      delta: computeOrderDelta([{ kitId: "FPHL" }], [{ kitId: "FPHL" }]),
    });
    expect(deltaSummary(row)).toBe("No change");
  });

  it("renders truthful fallback when the system snapshot is missing", () => {
    const row = makeRow({
      systemRecommended: null,
      delta: computeOrderDelta(null, [{ kitId: "FPHL" }]),
    });
    expect(systemRecommendedText(row)).toBe("Historical recommendation unavailable");
    expect(deltaSummary(row)).toBe("Historical recommendation unavailable");
  });
});

describe("kitListText", () => {
  it("joins names and marks quantity > 1", () => {
    expect(
      kitListText([
        { kitId: "A", displayName: "Kit A", quantity: 2, unitPriceInr: 1 },
        { kitId: "B", displayName: "Kit B", quantity: 1, unitPriceInr: 1 },
      ]),
    ).toBe("Kit A ×2; Kit B");
    expect(kitListText([])).toBe("—");
  });
});

describe("buildSummaryCsv", () => {
  it("emits a BOM, a header, and a raw numeric amount", () => {
    const csv = buildSummaryCsv([makeRow()]);
    expect(csv.startsWith("﻿")).toBe(true);
    const [header, row] = csv.replace("﻿", "").trim().split("\r\n");
    expect(header).toContain("Final Order Amount (INR)");
    // Raw number, no ₹ or commas, so a spreadsheet can sum it.
    expect(row).toContain("11700");
    expect(row).not.toContain("₹11,700");
  });

  it("leaves the amount cell empty (not 0) when unpriced", () => {
    const row = makeRow({
      finalKits: [
        { kitId: "MYSTERY", displayName: "Mystery", quantity: 1, unitPriceInr: null },
      ],
      totalInr: null,
      finalKitCount: 1,
    });
    const csv = buildSummaryCsv([row]);
    const dataRow = csv.replace("﻿", "").trim().split("\r\n")[1];
    expect(dataRow).toContain("Indicative value unavailable");
  });

  it("escapes a formula-injection attempt in a name", () => {
    const row = makeRow({ patientName: "=cmd()" });
    const csv = buildSummaryCsv([row]);
    expect(csv).toContain("'=cmd()");
  });
});
