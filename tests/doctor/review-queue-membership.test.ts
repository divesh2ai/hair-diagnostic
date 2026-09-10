import { describe, it, expect } from "vitest";
import {
  REVIEWABLE_SOURCE_SQL,
  UNOPENABLE_SOURCE_SQL,
  REVIEW_QUEUE_STATUSES,
  reviewQueueSql,
  unopenableQueueSql,
} from "@/lib/doctor/reviewQueue";

// Queue membership is the rule that decides what the dashboard counts, what
// the deck shows, which patient "Next patient" opens, and what the Review
// Queue lists. It has to be ONE rule, and it has to be the rule that matches
// what the consultation orchestrator will actually agree to open.
//
// These assertions are about the SQL the module emits, because that is what
// the four surfaces share. The behaviour against real rows was verified
// empirically on staging — see the corrective-pass report.

const CLINIC = "clinic-under-test";

/** The literal SQL text, with `$1`-style placeholders where values are bound. */
function text(sql: { sql: string }): string {
  return sql.sql.replace(/\s+/g, " ");
}

describe("review queue membership — the composability half", () => {
  it("refuses a row with no questionnaire and no stored consultation", () => {
    const s = text(REVIEWABLE_SOURCE_SQL);
    // Composable from answers …
    expect(s).toContain(`jsonb_typeof(a."rawResponses") = 'object'`);
    expect(s).toContain(`a."rawResponses" <> '{}'::jsonb`);
    // … or readable from an already-persisted consultation.
    expect(s).toContain(`EXISTS (SELECT 1 FROM "Consultation" ct`);
    expect(s).toContain(`ct."assessmentId" = a.id`);
  });

  it("guards NULL explicitly, so the negative filter is not silently empty", () => {
    // Regression: jsonb_typeof(NULL) is NULL, so without this test the whole
    // predicate evaluated to NULL on exactly the rows it exists to catch.
    // `NOT NULL` is also NULL, so the dashboard counted zero withheld records
    // and reported nothing wrong while silently dropping a real one.
    expect(text(REVIEWABLE_SOURCE_SQL)).toContain(`a."rawResponses" IS NOT NULL`);
  });

  it("defines unopenable as the exact negation, never a second opinion", () => {
    expect(text(UNOPENABLE_SOURCE_SQL)).toBe(`NOT ${text(REVIEWABLE_SOURCE_SQL)}`);
  });
});

describe("review queue membership — the full predicate", () => {
  it("requires pending decision, a queue status, and an openable source", () => {
    const s = text(reviewQueueSql(CLINIC));
    expect(s).toContain(`a."deletedAt" IS NULL`);
    expect(s).toContain(`a."reviewDecision"::text = 'PENDING'`);
    expect(s).toContain(`a.status::text IN`);
    expect(s).toContain(`jsonb_typeof(a."rawResponses") = 'object'`);
  });

  it("excludes FAILED and PARTIAL_FAILURE from the queue statuses", () => {
    const statuses = REVIEW_QUEUE_STATUSES.map(String);
    expect(statuses).toEqual(["CLINICAL_READY", "REPORT_GENERATING", "COMPLETED"]);
    expect(statuses).not.toContain("FAILED");
    expect(statuses).not.toContain("PARTIAL_FAILURE");
  });

  it("binds the clinic as a parameter — never interpolates it into the SQL", () => {
    // The clinic id is always server-derived from the authenticated Doctor
    // row. Binding rather than interpolating is what makes that true even if
    // a caller one day passes something it read from a request.
    const sql = reviewQueueSql(CLINIC);
    expect(sql.values).toContain(CLINIC);
    expect(sql.sql).not.toContain(CLINIC);
  });

  it("scopes the withheld-record count to the same single clinic", () => {
    const sql = unopenableQueueSql(CLINIC);
    expect(sql.values).toContain(CLINIC);
    expect(sql.sql).not.toContain(CLINIC);
    expect(text(sql)).toContain(`a."clinicId" =`);
  });

  it("counts ready and withheld over the SAME population", () => {
    // Identical apart from the reviewable clause, so a row is in exactly one
    // of the two counts and can never be in neither or both.
    const ready = text(reviewQueueSql(CLINIC));
    const withheld = text(unopenableQueueSql(CLINIC));
    // The withheld predicate is the ready one with a single NOT inserted
    // before the reviewable clause, and nothing else changed.
    expect(withheld.replace(" AND NOT (", " AND (")).toBe(ready);
  });
});
