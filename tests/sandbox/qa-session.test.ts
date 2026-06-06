import { describe, it, expect } from "vitest";
import { runQASession } from "../../src/sandbox/runQASession";
import { listAllFixtureIds } from "../../src/sandbox/loaders/fixtureAdapter";

describe("sandbox QA sessions", () => {
  const fixtures = listAllFixtureIds().slice(0, 5);

  it("loads fixture library", () => {
    expect(listAllFixtureIds().length).toBeGreaterThanOrEqual(40);
  });

  fixtures.forEach((fixtureId) => {
    it(`runs QA session for ${fixtureId}`, async () => {
      const report = await runQASession(fixtureId);
      expect(report.session.fixtureId).toBe(fixtureId);
      expect(report.scorecards.length).toBeGreaterThan(0);
      const branching = report.scorecards.find((s) => s.label === "Branching Accuracy");
      expect(branching).toBeDefined();
    }, 30_000);
  });
});
