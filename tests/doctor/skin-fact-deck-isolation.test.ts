import { describe, it, expect } from "vitest";
import { toDeckCard, type DeckQueueRow } from "@/lib/doctor/patientDeck";
import { reviewHref } from "@/lib/doctor/reviewHref";

// Validation for PR #21 (Skin FACT vertical isolation): a doctor's patient deck
// / reports list is built from a MIX of concerns. A single unsupported Skin FACT
// row must never throw and take the whole list down, and no skin row's card may
// point at the HairOS consultation.
//
// The deck mapping (toDeckCard) is pure — it reads the queue row's projected
// `concern` string and never invokes an engine — so this exercises it directly
// with every vertical the database can hold.

const HAIR_CONSULTATION = /^\/doctor\/reports\/[^/]+$/;

function row(concern: string | null, id = "x"): DeckQueueRow {
  return {
    id,
    submittedAt: "2026-09-04T06:00:00.000Z",
    status: "COMPLETED",
    patientName: "Test Patient",
    patientAge: 35,
    patientGender: "F",
    clinicName: "DrFACT Mumbai Test Clinic",
    primaryDiagnosis: null,
    severity: null,
    reviewPathway: null,
    reviewPathwayReasons: [],
    concern,
    recommendedKitCount: null,
  };
}

// Every concern the DB can carry, including a skin track that does not exist yet.
const MIX: Array<string | null> = [
  "hair",
  null, // legacy row, no concern → HairOS
  "skin_acne",
  "skin_pigmentation",
  "skin_anti_ageing",
  "skin_rosacea", // unknown future Skin FACT track
];

describe("patient deck tolerates a mixed-vertical list", () => {
  it("maps every concern to a card without throwing", () => {
    const cards = MIX.map((c, i) => toDeckCard(row(c, `a${i}`)));
    // One unsupported Skin FACT row cannot drop the rest of the list.
    expect(cards).toHaveLength(MIX.length);
    for (const card of cards) {
      expect(typeof card.href).toBe("string");
      expect(card.href.length).toBeGreaterThan(0);
    }
  });

  it("no Skin FACT card points at the HairOS consultation", () => {
    for (const c of ["skin_acne", "skin_pigmentation", "skin_anti_ageing", "skin_rosacea"]) {
      const card = toDeckCard(row(c));
      expect(card.href).not.toMatch(HAIR_CONSULTATION);
      expect(card.href).toContain("/skin/");
      // The card's destination always agrees with the router.
      expect(card.href).toBe(reviewHref({ id: "x", concern: c }));
    }
  });

  it("HairOS cards still route to the hair consultation", () => {
    for (const c of ["hair", null]) {
      const card = toDeckCard(row(c));
      expect(card.href).toMatch(HAIR_CONSULTATION);
      expect(card.href).toBe(reviewHref({ id: "x", concern: c }));
    }
  });

  it("pigmentation / anti-ageing carry their own interpretation line, not a hair diagnosis", () => {
    expect(toDeckCard(row("skin_pigmentation")).interpretation).toBe(
      "Skin FACT · Pigmentation",
    );
    expect(toDeckCard(row("skin_anti_ageing")).interpretation).toBe(
      "Skin FACT · Anti-ageing",
    );
  });
});
