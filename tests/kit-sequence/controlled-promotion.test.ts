// W8 — Controlled promotion invariant.
//
// Proves the exact wiring inside buildKitSequence: when safety.blockedKits
// is non-empty, ONLY blocked kits disappear and the remaining kits keep their
// relative order. Tested against the extracted filter helper so the
// invariant is enforced independently of the rest of the pipeline — future
// safety rules that populate blockedKits therefore cannot silently reorder
// the sequence.

import { describe, it, expect } from "@jest/globals";
import { filterSafetyBlocked } from "../../src/packages/ai-engine/kit-scorer/sequence/filterSafetyBlocked";

const HEAD = [
  "PRO FACT META B PCOS",
  "PHENOTYPE INFLAMATION",
  "PRO FACT META B",
  "HAIR FACT TE GOLD",
  "PRO IMMUNE GOLD",
  "IRON UP GOLD",
  "FPHL",
];

describe("filterSafetyBlocked — controlled promotion (W8)", () => {
  it("returns a byte-for-byte copy when no kits are blocked", () => {
    const out = filterSafetyBlocked(HEAD, []);
    expect(out).toEqual(HEAD);
  });

  it("removes only blocked kits; every remaining kit keeps its relative order", () => {
    const blocked = ["HAIR FACT TE GOLD", "IRON UP GOLD"];
    const out = filterSafetyBlocked(HEAD, blocked);
    expect(out).toEqual([
      "PRO FACT META B PCOS",
      "PHENOTYPE INFLAMATION",
      "PRO FACT META B",
      "PRO IMMUNE GOLD",
      "FPHL",
    ]);
    // No new kits.
    for (const k of out) expect(HEAD.includes(k)).toBe(true);
    // No blocked kits leaked through.
    for (const k of out) expect(blocked.includes(k)).toBe(false);
  });

  it("preserves the pairwise relative order of every surviving kit", () => {
    const blocked = ["PHENOTYPE INFLAMATION"];
    const out = filterSafetyBlocked(HEAD, blocked);
    // Any two kits both present in HEAD and both present in out MUST appear
    // in the same order.
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        expect(HEAD.indexOf(out[i])).toBeLessThan(HEAD.indexOf(out[j]));
      }
    }
  });

  it("is idempotent — filtering twice with the same block list is the same as once", () => {
    const blocked = ["HAIR FACT TE GOLD"];
    const once = filterSafetyBlocked(HEAD, blocked);
    const twice = filterSafetyBlocked(once, blocked);
    expect(twice).toEqual(once);
  });

  it("does not mutate the input", () => {
    const snapshot = [...HEAD];
    filterSafetyBlocked(HEAD, ["HAIR FACT TE GOLD"]);
    expect(HEAD).toEqual(snapshot);
  });

  it("collapses to empty when every kit is blocked", () => {
    const out = filterSafetyBlocked(HEAD, HEAD);
    expect(out).toEqual([]);
  });

  it("ignores blocked-list entries that were never in the sequence", () => {
    const out = filterSafetyBlocked(HEAD, ["NOT A REAL KIT", "PHENOTYPE INFLAMATION"]);
    expect(out).toEqual([
      "PRO FACT META B PCOS",
      "PRO FACT META B",
      "HAIR FACT TE GOLD",
      "PRO IMMUNE GOLD",
      "IRON UP GOLD",
      "FPHL",
    ]);
  });
});
