import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import { buildAdjunctProtocol } from "../../src/packages/ai-engine/kit-scorer/adjunctProtocolEngine";
import { getTopicalProduct } from "../../src/packages/registries/topicals/products";
import { resolveTopicalImage } from "../../apps/patient-portal/src/lib/kits/kitImage";
import type { ScalpState, PatientAnswers } from "../../src/packages/types";

// F-Biwash Pro is a DIFFERENT product that REPLACES the deprecated F-Biwash+.
// This is not a rename/alias: the current product has its own canonical
// internal id (F_BIWASH_PRO) and its own packshot; F-Biwash+ (F_BIWASH_PLUS)
// survives only to render historical snapshots and is never produced for a new
// recommendation.

const CURRENT_NAME = "F-Biwash Pro (Anti-Dandruff Shampoo)";
const CURRENT_CODE = "F_BIWASH_PRO";
const LEGACY_NAME = "F-Biwash+ Anti-Dandruff Shampoo";
const LEGACY_CODE = "F_BIWASH_PLUS";
const noAnswers = {} as PatientAnswers;

describe("F-Biwash Pro is a distinct current product (not F-Biwash+)", () => {
  it("the current product resolves to its own internal code F_BIWASH_PRO", () => {
    const img = resolveTopicalImage(CURRENT_NAME);
    expect(img).not.toBeNull();
    expect(img!.code).toBe(CURRENT_CODE);
    expect(img!.code).not.toBe(LEGACY_CODE);
  });

  it("the current product's packshot is its OWN asset, not the deprecated one", () => {
    const img = resolveTopicalImage(CURRENT_NAME);
    expect(img!.src).toContain("f_biwashpro.png");
    // Must NOT inherit the deprecated product's photo.
    expect(img!.src).not.toContain("f_biwashplus.png");
  });

  it("the deprecated F-Biwash+ name resolves to the distinct legacy code/asset", () => {
    // Retained only for historical evidence — a different code and a different
    // packshot from the current product.
    const legacy = resolveTopicalImage(LEGACY_NAME);
    expect(legacy!.code).toBe(LEGACY_CODE);
    expect(legacy!.src).toContain("f_biwashplus.png");
    // Proves the two are NOT the same product.
    expect(legacy!.code).not.toBe(CURRENT_CODE);
  });
});

describe("new recommendations emit F-Biwash Pro, never F-Biwash+", () => {
  it("the scorer injects F-Biwash Pro for a dandruff scalp, resolving to F_BIWASH_PRO", () => {
    const protocol = buildAdjunctProtocol(["DANDRUFF"] as ScalpState[], noAnswers);
    const names = protocol.scalpCorrection.map((i) => i.productName);
    expect(names).toContain(CURRENT_NAME);
    expect(names).not.toContain(LEGACY_NAME);
    const injected = protocol.scalpCorrection.find((i) => i.productName === CURRENT_NAME);
    expect(resolveTopicalImage(injected!.productName)?.code).toBe(CURRENT_CODE);
  });

  it("the injected item carries no 'F-Biwash+' text at all", () => {
    const protocol = buildAdjunctProtocol(["OILY_SCALP"] as ScalpState[], noAnswers);
    const blob = JSON.stringify(protocol.scalpCorrection);
    expect(blob).toContain("F-Biwash Pro");
    expect(blob).not.toContain("F-Biwash+");
  });

  it("the registry holds the current product under its own name, not the deprecated one", () => {
    expect(getTopicalProduct(CURRENT_NAME)).not.toBeNull();
    expect(getTopicalProduct(LEGACY_NAME)).toBeNull();
  });
});

describe("no active source still emits the deprecated product", () => {
  it("no recommendation-path source string contains 'F-Biwash+'", () => {
    // The recommendation/engine output path must never emit the deprecated
    // product. (The report-rendering layer — viewModel.ts / kitImage.ts /
    // productAssets.ts — legitimately still names F-Biwash+ in comments and a
    // legacy branch that resolves historical snapshots; those are covered by
    // the distinct-product tests above, not this scan.)
    const root = process.cwd();
    const files = [
      "src/packages/registries/topicals/recommendTopicals.ts",
      "src/packages/registries/topicals/products.ts",
      "src/packages/ai-engine/kit-scorer/adjunctProtocolEngine.ts",
      "src/packages/ai-engine/clinical-engine/kits/products.json",
      "src/packages/ai-engine/questionnaire-engine/schema/topical-engine.schema.json",
    ];
    for (const rel of files) {
      const text = readFileSync(path.join(root, rel), "utf8");
      expect(text, `${rel} still contains "F-Biwash+"`).not.toContain("F-Biwash+");
    }
  });

  it("the one-page report has no Biwash-specific normalisation override", () => {
    const vm = readFileSync(
      path.join(process.cwd(), "apps/patient-portal/src/lib/reports/one-page/viewModel.ts"),
      "utf8",
    );
    expect(vm).not.toContain("canonicalTopicalName");
  });
});
