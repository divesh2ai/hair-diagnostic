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

  it("renders the 'Next patient' primary action from one CSS treatment, not a second copy of it", () => {
    // hd-command-cta is the ONE bold-styled CTA class; hd-command-cta-quiet is
    // the visually secondary treatment used for "Full queue" / "Open review
    // queue". If hd-command-cta starts being applied a second time, a second
    // primary-weight action has been added to the band.
    const primaryUses = commandBand.match(/className="hd-command-cta"/g) ?? [];
    expect(primaryUses.length).toBe(1);
  });

  it("only ever shows the front-of-queue link OR the empty-queue link, never both", () => {
    // hasNext branches the whole CTA cluster; the empty-queue link
    // ("Open review queue") is in the else branch, so the two can never
    // render together, whatever the queue count is.
    expect(commandBand).toContain("hasNext ? (");
    expect(commandBand).toContain("Open review queue");
    expect(commandBand).toContain("Full queue");
  });

  it("names the next patient rather than reimplementing FIFO in the component", () => {
    // The band takes nextPatientName/nextPatientHref as props — it has no
    // query, no sort, no filter of its own to disagree with the shared one.
    expect(commandBand).not.toMatch(/ORDER BY|\.sort\(|reviewQueueSql/);
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

  it("derives the command band's primary target from the same toDeckCard as the deck, not a separate lookup", () => {
    expect(dashboardClient).toContain("toDeckCard(queue[0])");
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
