import { describe, expect, it } from "vitest";
import {
  KIT_CLINICAL_COPY,
  clinicalMeaningForKit,
  resolveKitCopyFamily,
  supportBenefitsForKit,
  type KitCopyFamily,
} from "../../apps/patient-portal/src/lib/reports/one-page/clinicalCopy";

// The care-plan band's CLINICAL MEANING and HOW THIS SUPPORT WILL HELP
// columns are both served by the approved copy registry in clinicalCopy.ts.
// These tests assert the registry's behaviour directly (the renderer is a
// thin pass-through) and mechanically enforce the Content Master's copy
// budgets so new kit copy cannot drift out of spec.

const wordCount = (text: string) => text.trim().split(/\s+/).length;

const meaningsOf = (family: KitCopyFamily): string[] => {
  const copy = KIT_CLINICAL_COPY[family];
  return [copy.meaning, ...(copy.variants ?? []).map((variant) => variant.text)];
};

const families = Object.keys(KIT_CLINICAL_COPY) as KitCopyFamily[];

describe("Clinical Meaning — Content Master copy budget", () => {
  it("keeps every meaning (default and variant) within 18–32 words", () => {
    const violations: string[] = [];
    for (const family of families) {
      for (const text of meaningsOf(family)) {
        const words = wordCount(text);
        if (words < 18 || words > 32) violations.push(`${family} (${words}w): ${text}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it("uses hedged language — never asserts a confirmed cause", () => {
    const violations: string[] = [];
    for (const family of families) {
      for (const text of meaningsOf(family)) {
        if (!/\b(may|can|could|is consistent with|suggests?)\b/i.test(text)) {
          violations.push(`${family}: ${text}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("never promises a guaranteed or absolute outcome", () => {
    for (const family of families) {
      for (const text of meaningsOf(family)) {
        expect(text).not.toMatch(/\b(guarantee|will regrow|permanent cure|100%)\b/i);
      }
    }
  });
});

describe("How This Support Will Help — Content Master copy budget", () => {
  it("ships one or two purpose lines of 8–14 words each", () => {
    const violations: string[] = [];
    for (const family of families) {
      const support = KIT_CLINICAL_COPY[family].support;
      expect(support.length).toBeGreaterThanOrEqual(1);
      expect(support.length).toBeLessThanOrEqual(2);
      for (const line of support) {
        const words = wordCount(line);
        if (words < 8 || words > 14) violations.push(`${family} (${words}w): ${line}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it("states the kit's purpose without repeating the trigger list", () => {
    // Content Master §1: column 4 carries the kit's purpose only. Naming a
    // patient factor here duplicates the TRIGGERED BY chips in column 1.
    const triggerVocabulary =
      /\b(dandruff|itching|redness|burning|alcohol|smoking|vaping|acne|eczema|asthma|allerg|bloating|constipation|indigestion|obesity|sedentary|night[- ]shift|jet lag)\b/i;
    for (const family of families) {
      for (const line of KIT_CLINICAL_COPY[family].support) {
        expect(line).not.toMatch(triggerVocabulary);
      }
    }
  });
});

describe("Clinical Meaning — trigger-gated variants", () => {
  it("uses the combined inflammatory + oxidative meaning when both are present", () => {
    const meaning = clinicalMeaningForKit({
      kitCode: "PHENOTYPE_INFLAMMATION",
      name: "Phenotype Inflammation",
      triggers: ["Redness", "Burning", "Alcohol"],
    });
    expect(meaning).toBe(
      "Scalp inflammation together with oxidative load may create an unfavourable follicular environment, slowing cellular repair and holding back normal hair-growth activity.",
    );
  });

  it("never names a factor the row does not display", () => {
    // Scalp-only row: the meaning must not mention alcohol or smoking even
    // though the same kit family carries variants for both.
    const meaning = clinicalMeaningForKit({
      kitCode: "PHENOTYPE_INFLAMMATION",
      name: "Phenotype Inflammation",
      triggers: ["Redness or irritation"],
    });
    expect(meaning).toMatch(/scalp inflammation/i);
    expect(meaning).not.toMatch(/alcohol|smok|vaping/i);
  });

  it("frames Meta B by the patient's own metabolic driver", () => {
    const hypo = clinicalMeaningForKit({
      kitCode: "PRO_FACT_META_B",
      name: "Pro Fact Meta B",
      triggers: ["Hypothyroidism"],
    });
    expect(hypo).toMatch(/thyroid-related metabolic slowing/i);

    const pcos = clinicalMeaningForKit({
      kitCode: "PRO_FACT_META_B",
      name: "Pro Fact Meta B",
      triggers: ["PMOS / PCOS"],
    });
    expect(pcos).toMatch(/PCOS/);
    expect(pcos).not.toMatch(/thyroid/i);
  });

  it("falls back to the neutral family meaning when no trigger matches", () => {
    const meaning = clinicalMeaningForKit({
      kitCode: "PRO_FACT_META_B",
      name: "Pro Fact Meta B",
      triggers: [],
    });
    expect(meaning).toBe(KIT_CLINICAL_COPY.meta_b.meaning);
  });

  it("distinguishes Alopecia Areata (targeted autoimmune) from Pro Immune (broader immune support)", () => {
    const areata = clinicalMeaningForKit({
      kitCode: "HAIR_FACT_ALOPECIA_AREATA",
      name: "Hair Fact Alopecia Areata",
      triggers: ["Alopecia areata"],
    });
    const immune = clinicalMeaningForKit({
      kitCode: "PRO_IMMUNE_GOLD",
      name: "Pro Immune 5",
      triggers: ["Frequent infections"],
    });
    expect(areata).toMatch(/immune privilege/i);
    expect(immune).toMatch(/frequent infections/i);
    expect(areata).not.toBe(immune);
  });

  it("keeps Male and Female pattern meanings distinct", () => {
    const male = clinicalMeaningForKit({ kitCode: "MPHL", name: "MPHL Pro", triggers: [] });
    const female = clinicalMeaningForKit({ kitCode: "FPHL", name: "FPHL Pro", triggers: [] });
    expect(male).toMatch(/androgen-sensitive follicles/i);
    expect(female).toMatch(/mid-scalp and temporal areas/i);
    expect(male).not.toBe(female);
  });

  it("uses the locked Trichotillomania / OCD wording", () => {
    expect(clinicalMeaningForKit({ kitCode: "TTM", name: "Hair Fact TTM", triggers: [] })).toBe(
      "Repeated compulsive pulling can mechanically damage growing hairs and stress the affected follicles, interrupting recovery across the areas that are pulled.",
    );
  });
});

describe("Kit identity → copy family resolution", () => {
  it("routes Meta B variants before the base Meta B family", () => {
    expect(resolveKitCopyFamily("PRO_FACT_META_B_PCOS", "Pro Fact Meta B PCOS")).toBe("meta_b_pcos");
    expect(resolveKitCopyFamily("PRO_FACT_META_B_HYPOTHYROID", "Pro Fact Meta B Hypothyroid")).toBe(
      "meta_b_hypothyroid",
    );
    expect(resolveKitCopyFamily("PRO_FACT_META_B_POSTMENOPAUSE", "Pro Fact Meta B Postmenopause")).toBe(
      "meta_b_menopause",
    );
    expect(resolveKitCopyFamily("PRO_FACT_META_B", "Pro Fact Meta B")).toBe("meta_b");
  });

  it("returns null for kits with no approved copy so the caller can fall back", () => {
    expect(resolveKitCopyFamily("SOME_UNKNOWN_KIT", "Some Unknown Kit")).toBeNull();
    expect(clinicalMeaningForKit({ kitCode: "SOME_UNKNOWN_KIT", name: "Unknown", triggers: [] })).toBeNull();
    expect(supportBenefitsForKit("SOME_UNKNOWN_KIT", "Unknown")).toBeNull();
  });

  it("serves support copy for every kit family it resolves", () => {
    for (const family of families) {
      expect(KIT_CLINICAL_COPY[family].support.length).toBeGreaterThan(0);
    }
  });
});
