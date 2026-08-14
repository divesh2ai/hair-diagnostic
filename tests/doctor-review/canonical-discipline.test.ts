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
import { readFileSync, readdirSync, statSync } from "fs";
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
/** The pure model that owns kit-phase ordering. */
const PROTOCOL_MODEL = join(
  REPO_ROOT,
  "apps",
  "patient-portal",
  "src",
  "lib",
  "doctor",
  "protocolModel.ts",
);
const CONSULTATION_COMPONENTS_DIR = join(
  REPO_ROOT,
  "apps",
  "patient-portal",
  "src",
  "components",
  "consultation",
);

/**
 * Recursive: the doctor review surface is no longer one file.
 *
 * The case is now composed of sections (findings, why, attention, protocol,
 * secondary detail, decision bar) under `sections/`. A non-recursive read
 * would have silently stopped covering the components that actually render
 * clinical content — the discipline below has to follow the content, not the
 * filename it used to live in.
 */
function readAll(dir: string): { path: string; content: string }[] {
  return readdirSync(dir).flatMap((n) => {
    const full = join(dir, n);
    if (statSync(full).isDirectory()) {
      // `skin/` is the Skin FACT review surface: separate product, separate
      // canonical source, and server components that legitimately read Prisma
      // directly. The discipline asserted here is about the hair consultation
      // review client, so walking into it would apply a rule it was never
      // written for.
      if (n === "skin") return [];
      return readAll(full);
    }
    if (!n.endsWith(".tsx") && !n.endsWith(".ts")) return [];
    return [{ path: full, content: readFileSync(full, "utf8") }];
  });
}

describe("Doctor case-detail canonical-source discipline", () => {
  const doctorFiles = readAll(DOCTOR_DIR);
  const consultationFiles = readAll(CONSULTATION_COMPONENTS_DIR);
  const all = [...doctorFiles, ...consultationFiles];
  /** Every file that renders the doctor's case, concatenated. */
  const doctorSurface = doctorFiles.map((f) => f.content).join("\n");

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
    // The lineup is still read straight off the canonical payload — now by
    // ProtocolSection rather than the client shell.
    expect(doctorSurface).toMatch(/treatmentPlan\.kitPhases/);
    // And it is still mapped positionally, numbering each entry from its index
    // so a duplicate kitId cannot collapse two phases into one. The ordering
    // guarantee moved into the model; it did not disappear.
    const model = readFileSync(PROTOCOL_MODEL, "utf8");
    expect(model).toMatch(/phases\.map\(\(p, i\)/);
    expect(model).toMatch(/phase: i \+ 1/);
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
    // Both still render, from the canonical payload, somewhere on the doctor
    // review surface: topicals alongside the protocol they belong to, safety
    // disclosures in the secondary detail. This asserts the content survives
    // the restructure — not which file happens to host it.
    expect(doctorSurface).toMatch(/TopicalsCard/);
    expect(doctorSurface).toMatch(/SafetyCard/);
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
