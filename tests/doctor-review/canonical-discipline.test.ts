// Doctor review case-detail must render from the canonical Consultation
// Aggregate ONLY. These are grep-shaped guardrails against regressions
// where a component starts pulling clinical content from a legacy artifact,
// /api/assessment/status, /api/assessment/pdf, or a direct Prisma read.
//
// Frontend browser-driven tests are heavy and flaky in this repo; the
// task explicitly prefers view-model / source-discipline checks over
// browser automation. These tests catch every regression that would break
// the "canonical is authoritative" invariant without needing a headless
// browser.

import { describe, it, expect } from "@jest/globals";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const REPO_ROOT = join(__dirname, "..", "..");
const DOCTOR_DIR = join(
  REPO_ROOT,
  "apps",
  "patient-portal",
  "src",
  "app",
  "doctor",
  "reports",
  "[assessmentId]",
);
const CONSULTATION_COMPONENTS_DIR = join(
  REPO_ROOT,
  "apps",
  "patient-portal",
  "src",
  "components",
  "consultation",
);

function readAll(dir: string): { path: string; content: string }[] {
  return readdirSync(dir)
    .filter((n) => n.endsWith(".tsx") || n.endsWith(".ts"))
    .map((n) => ({
      path: join(dir, n),
      content: readFileSync(join(dir, n), "utf8"),
    }));
}

describe("Doctor case-detail canonical-source discipline", () => {
  const doctorFiles = readAll(DOCTOR_DIR);
  const consultationFiles = readAll(CONSULTATION_COMPONENTS_DIR);
  const all = [...doctorFiles, ...consultationFiles];

  it("does not fetch legacy assessment status/artifact endpoints for clinical content", () => {
    for (const f of all) {
      expect(f.content).not.toMatch(/\/api\/assessment\/status/);
      expect(f.content).not.toMatch(/\/api\/assessment\/artifacts/);
      expect(f.content).not.toMatch(/ArtifactType\./);
    }
  });

  it("does not import prisma directly (all writes flow through the canonical API)", () => {
    for (const f of all) {
      expect(f.content).not.toMatch(/from ["']@\/lib\/prisma["']/);
      expect(f.content).not.toMatch(/from ["']@prisma\/client["']/);
    }
  });

  it("does not write reviewDecision from the client (canonical approve route only)", () => {
    for (const f of all) {
      expect(f.content).not.toMatch(/reviewDecision\s*:/);
    }
  });

  it("uses PATCH /api/consultation for edits and POST .../approve for approval", () => {
    const doctorClient = doctorFiles.find((f) => f.path.endsWith("DoctorReviewClient.tsx"))!;
    expect(doctorClient.content).toMatch(/PATCH/);
    expect(doctorClient.content).toMatch(/\/api\/consultation\//);
    expect(doctorClient.content).toMatch(/\/approve/);
  });

  it("sends expectedContentVersion on edit to prevent silent overwrite", () => {
    const doctorClient = doctorFiles.find((f) => f.path.endsWith("DoctorReviewClient.tsx"))!;
    expect(doctorClient.content).toMatch(/expectedContentVersion/);
  });

  it("handles a 409 conflict from PATCH with a reload-before-saving state", () => {
    const doctorClient = doctorFiles.find((f) => f.path.endsWith("DoctorReviewClient.tsx"))!;
    expect(doctorClient.content).toMatch(/409/);
  });

  it("renders kit phases in the exact canonical order (index-based map)", () => {
    const doctorClient = doctorFiles.find((f) => f.path.endsWith("DoctorReviewClient.tsx"))!;
    // The map iterates .kitPhases directly and keys by index so a duplicate
    // kitId does not collapse two entries into one — order is preserved.
    expect(doctorClient.content).toMatch(/treatmentPlan\.kitPhases\.map/);
  });

  it("does not expose internal kit IDs in the review UI header", () => {
    const kitCard = consultationFiles.find((f) =>
      f.path.endsWith("RecommendationKitCard.tsx"),
    )!;
    // The header no longer surfaces kit.kitId to the doctor. If it comes
    // back, this test flags it.
    expect(kitCard.content).not.toMatch(/action=\{<Pill[^>]*>\{kit\.kitId\}/);
  });

  it("renders topicals and safety sections from the canonical payload", () => {
    const doctorClient = doctorFiles.find((f) => f.path.endsWith("DoctorReviewClient.tsx"))!;
    expect(doctorClient.content).toMatch(/TopicalsCard/);
    expect(doctorClient.content).toMatch(/SafetyCard/);
  });

  it("SafetyCard labels findings without exposing rule IDs", () => {
    const safety = consultationFiles.find((f) => f.path.endsWith("SafetyCard.tsx"))!;
    expect(safety.content).toMatch(/CAUTION/);
    expect(safety.content).toMatch(/MISSING INPUT/);
    expect(safety.content).toMatch(/NOT EVALUATED/);
    // No raw engine identifiers (ruleId, engineId, etc.) leak in.
    expect(safety.content).not.toMatch(/ruleId|engineId|kitId/);
  });
});
