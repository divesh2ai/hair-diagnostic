import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Doctor dashboard CTA hierarchy (FACT Doctor Dashboard CTA cleanup, Part B).
//
// The dashboard is meant to answer "who do I review next?" with exactly one
// dominant action, backed by the same FIFO/eligibility logic used everywhere
// else a doctor can be sent to a case. This suite pins the structural
// invariants by reading the actual component/route source, the same style
// tests/doctor/skin-acne-not-hair.test.ts uses — these components have no
// React Testing Library harness in this repo, and a source-pattern assertion
// is what actually protects against the two ways this regresses: someone
// re-adding a second link to a destination that already has one, or the
// primary CTA drifting onto its own client-side queue logic instead of the
// one query every other surface reads.

const root = process.cwd();
const read = (relPath: string) => readFileSync(join(root, "apps/patient-portal/src", relPath), "utf8");

describe("dashboard — single dominant primary CTA", () => {
  const commandBand = read("components/doctor/dashboard/CommandBand.tsx");
  const deckCard = read("components/doctor/dashboard/PatientDeckCard.tsx");

  it("keeps the command band identity-only, with no queue CTA competing with the deck", () => {
    // V2 moved the single dominant action out of the header and onto the
    // patient deck (the front card IS the next patient). The band is now a
    // plain identity header; it must not grow a primary CTA or a review-queue
    // link back, or the deck's card would no longer be the one dominant action.
    expect(commandBand).not.toMatch(/hd-command-cta/);
    expect(commandBand).not.toMatch(/href="\/doctor\/reports"/);
    expect(commandBand).not.toMatch(/Open review queue|Full queue/);
  });

  it("puts the one review action on the deck card, as a single stretched link", () => {
    // The interactive front card carries exactly one action element — a
    // stretched Link (::after inset-0) covering the whole face, its href from
    // the shared resolver — while the non-interactive back cards carry a plain
    // span, never a second link. One <Link> in the whole component is that
    // single primary treatment.
    const links = deckCard.match(/<Link\b/g) ?? [];
    expect(links.length).toBe(1);
    expect(deckCard).toMatch(/href=\{card\.href\}/);
  });

  it("names the next patient rather than reimplementing FIFO in the component", () => {
    // Neither the band nor the deck card runs a query, sort or filter of its
    // own to disagree with the shared queue resolver.
    for (const src of [commandBand, deckCard]) {
      expect(src).not.toMatch(/ORDER BY|\.sort\(|reviewQueueSql/);
    }
  });
});

describe("dashboard — no duplicate empty-queue CTA", () => {
  const patientDeck = read("components/doctor/dashboard/PatientDeck.tsx");

  it("has no link to the review queue anywhere in the deck component", () => {
    // CommandBand's "Open review queue" link renders under the exact same
    // condition (queue.length === 0) as the deck's empty state, so a second
    // link to /doctor/reports here would always double up, never just
    // sometimes — checked structurally (not by label text) so a copy change
    // can't quietly reintroduce the duplicate under different wording.
    const reportsLinks = patientDeck.match(/href="\/doctor\/reports"/g) ?? [];
    expect(reportsLinks.length).toBe(0);
  });

  it("keeps that reasoning documented so it isn't silently re-added", () => {
    expect(patientDeck).toMatch(/same empty-queue condition/);
  });
});

describe("dashboard — no card-as-link plus inner button duplication", () => {
  const card = read("components/doctor/dashboard/PatientDeckCard.tsx");

  it("wraps the card in a plain div, not a Link, so only the action button is clickable", () => {
    // The outermost element must not itself be an <a>/<Link> — only the
    // "Review patient" button inside should be interactive, per the task's
    // "choose one interaction pattern" rule.
    const firstReturnedElement = card.slice(card.indexOf("return ("), card.indexOf("return (") + 400);
    expect(firstReturnedElement).toMatch(/<div\b/);
    expect(firstReturnedElement).not.toMatch(/<Link\b/);
  });
});

describe("dashboard — next-patient target uses the shared route-safe resolver", () => {
  const patientDeckLib = read("lib/doctor/patientDeck.ts");
  const dashboardClient = readFileSync(
    join(root, "apps/patient-portal/src/app/doctor/DoctorDashboardClient.tsx"),
    "utf8",
  );

  it("derives every deck card's href from reviewHref, the same resolver skin-acne safety depends on", () => {
    expect(patientDeckLib).toContain("import { reviewHref } from \"@/lib/doctor/reviewHref\"");
    expect(patientDeckLib).toContain("href: reviewHref(row)");
  });

  it("derives the deck from the one shared queue, not a separate next-patient lookup", () => {
    // V2: there is no command-band target any more. The deck consumes the same
    // queue the dashboard already holds (stats.queue) and builds its own cards
    // via reviewHref; there is no separate queue[0] lookup feeding a duplicate
    // primary target elsewhere.
    expect(dashboardClient).toContain("rows={queue}");
  });
});

describe("dashboard — queue source shared with the post-approval handoff", () => {
  const dashboardStats = read("lib/doctor/dashboardStats.ts");
  const queueNextRoute = read("app/api/doctor/queue/next/route.ts");

  it("both read the same reviewQueueSql membership rule", () => {
    expect(dashboardStats).toContain("reviewQueueSql");
    expect(queueNextRoute).toContain("reviewQueueSql");
  });

  it("both order the queue FIFO by submittedAt ascending", () => {
    expect(dashboardStats).toMatch(/ORDER BY a\."submittedAt" ASC NULLS LAST/);
    expect(queueNextRoute).toMatch(/ORDER BY a\."submittedAt" ASC NULLS LAST/);
  });
});

describe("dashboard — secondary navigation reachable outside the dashboard body", () => {
  const nav = read("lib/navigation/nav.ts");

  it("keeps Reports (Review Queue) and Orders in the persistent doctor sidebar", () => {
    const doctorSection = nav.slice(nav.indexOf("NAV_DOCTOR"), nav.indexOf("NAV_DOCTOR") + 800);
    expect(doctorSection).toContain('href: "/doctor/reports"');
    expect(doctorSection).toContain('href: "/doctor/orders"');
  });
});
