import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import { buildAdjunctProtocol } from "../../src/packages/ai-engine/kit-scorer/adjunctProtocolEngine";
import { getTopicalProduct } from "../../src/packages/registries/topicals/products";
import { resolveTopicalImage } from "../../apps/patient-portal/src/lib/kits/kitImage";
import type { ScalpState, PatientAnswers } from "../../src/packages/types";

// Regression for the "F-Biwash+" → "F-Biwash Pro" patient-facing rename.
//
// The invariant under test: ONLY the display name changed. The internal topical
// identity (`F_BIWASH_PLUS`) that the scorer's injection, the image resolver and
// the registry all key off is unchanged — so nothing in the recommendation or
// asset-resolution path moves, only the string a patient/doctor reads.

const NEW_NAME = "F-Biwash Pro (Anti-Dandruff Shampoo)";
const OLD_NAME = "F-Biwash+ Anti-Dandruff Shampoo";
const INTERNAL_CODE = "F_BIWASH_PLUS";

const noAnswers = {} as PatientAnswers;

describe("F-Biwash Pro rename — internal code is unchanged", () => {
  it("still resolves the anti-dandruff shampoo asset to F_BIWASH_PLUS from the NEW name", () => {
    const img = resolveTopicalImage(NEW_NAME);
    expect(img).not.toBeNull();
    expect(img!.code).toBe(INTERNAL_CODE);
  });

  it("also resolves the LEGACY name to the same F_BIWASH_PLUS code (historical data stays valid)", () => {
    // The image/identity resolver matches on the BIWASH/ANTI-DANDRUFF/SHAMPOO
    // substring, so an old snapshot that still reads "F-Biwash+" keeps resolving
    // to the same internal code and packshot.
    const img = resolveTopicalImage(OLD_NAME);
    expect(img?.code).toBe(INTERNAL_CODE);
  });
});

describe("F-Biwash Pro rename — the scorer injection is unchanged in behaviour", () => {
  it("still injects the anti-dandruff shampoo for a dandruff scalp, under the new name", () => {
    const protocol = buildAdjunctProtocol(["DANDRUFF"] as ScalpState[], noAnswers);
    const names = protocol.scalpCorrection.map((i) => i.productName);
    expect(names).toContain(NEW_NAME);
    // The injected item still resolves to the same internal code.
    const injected = protocol.scalpCorrection.find((i) => i.productName === NEW_NAME);
    expect(resolveTopicalImage(injected!.productName)?.code).toBe(INTERNAL_CODE);
  });

  it("emits no lingering 'F-Biwash+' anywhere in the injected item's text", () => {
    const protocol = buildAdjunctProtocol(["OILY_SCALP"] as ScalpState[], noAnswers);
    const blob = JSON.stringify(protocol.scalpCorrection);
    expect(blob).toContain("F-Biwash Pro");
    expect(blob).not.toContain("F-Biwash+");
  });
});

describe("F-Biwash Pro rename — the registry is the single source of the name", () => {
  it("finds the product under the new name and no longer under the old one", () => {
    expect(getTopicalProduct(NEW_NAME)).not.toBeNull();
    expect(getTopicalProduct(OLD_NAME)).toBeNull();
  });

  it("no renamed source still emits the old 'F-Biwash+' name", () => {
    // Guards the whole rename: the recommender's AUTO_01 rule, the scorer's
    // product constant, the two product catalogues and the schema must all
    // carry the new name. (The generated assistant formulations file is out of
    // scope — it regenerates from an external spreadsheet.)
    const root = process.cwd();
    const files = [
      "src/packages/registries/topicals/recommendTopicals.ts",
      "src/packages/registries/topicals/products.ts",
      "src/packages/ai-engine/kit-scorer/adjunctProtocolEngine.ts",
      "src/packages/ai-engine/clinical-engine/kits/products.json",
      "src/packages/ai-engine/questionnaire-engine/schema/topical-engine.schema.json",
      "apps/patient-portal/src/lib/reports/one-page/viewModel.ts",
    ];
    for (const rel of files) {
      const text = readFileSync(path.join(root, rel), "utf8");
      expect(text, `${rel} still contains "F-Biwash+"`).not.toContain("F-Biwash+");
    }
  });

  it("the one-page report no longer carries a Biwash-specific normalisation override", () => {
    const vm = readFileSync(
      path.join(process.cwd(), "apps/patient-portal/src/lib/reports/one-page/viewModel.ts"),
      "utf8",
    );
    expect(vm).not.toContain("canonicalTopicalName");
  });
});
