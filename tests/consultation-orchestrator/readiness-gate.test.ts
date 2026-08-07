// orchestrator.approve blocks when the persisted clinical-readiness snapshot
// isn't clear:
//   • grounding violation → ReadinessBlockedError, no APPROVED event, no
//     status change on the version.
//   • reasoning gap → same behavior.
//   • historical rows with no snapshot → fail closed (same error class,
//     READINESS_SNAPSHOT_MISSING).
//   • clean snapshot → approves and emits CONSULTATION_APPROVED exactly once.
// Reject / revision-request paths must NOT be gated — a doctor must be able
// to reject or ask for edits precisely because readiness fails.

import { describe, it, expect } from "@jest/globals";
import {
  ConsultationOrchestrator,
  OrchestratorError,
  ReadinessBlockedError,
} from "../../src/packages/consultation-orchestrator/orchestrator";
import type {
  AssessmentLoader,
  ClinicBrandingLoader,
  ConsultationRepo,
  DoctorPreferencesLoader,
  EventBus,
  OrgDefaultsLoader,
  PreviousConsultationsLoader,
  StoredVersion,
} from "../../src/packages/consultation-orchestrator/ports";
import type { ConsultationEvent } from "../../src/packages/consultation-orchestrator/events/types";
import type {
  ClinicalReadinessSnapshot,
  Consultation,
} from "../../packages/shared/types/consultation";

const CLINIC = "clinic-A";
const ASSESSMENT_ID = "asm-1";
const CONSULTATION_ID = "cons-1";
const doctorCtx = { actorId: "doc-A", role: "DOCTOR", clinicId: CLINIC };

function fakeContent(snapshot?: ClinicalReadinessSnapshot): Consultation {
  return {
    assessment: { id: ASSESSMENT_ID },
    diagnosis: { primary: "AGA" },
    treatmentPlan: [],
    followUp: {},
    patientEducation: {},
    doctorNotes: [],
    attachments: [],
    version: { engines: {}, contentVersion: 1 },
    audit: { lastUpdatedAt: new Date().toISOString(), lastUpdatedBy: "seed", events: [] },
    clinicalReadiness: snapshot,
  } as unknown as Consultation;
}

function cleanSnap(): ClinicalReadinessSnapshot {
  return {
    schemaVersion: 1,
    evaluatedAt: "2026-07-03T00:00:00.000Z",
    sourceClinicalArtifactVersion: "v4",
    isReadyForApproval: true,
    groundingViolations: [],
    reasoningGaps: [],
    blockingCodes: [],
    summary: { groundingViolationCount: 0, reasoningGapCount: 0 },
  };
}

function blockedGrounding(): ClinicalReadinessSnapshot {
  return {
    schemaVersion: 1,
    evaluatedAt: "2026-07-03T00:00:00.000Z",
    sourceClinicalArtifactVersion: "v4",
    isReadyForApproval: false,
    groundingViolations: [
      { ruleId: "scalp.dandruff", section: "What We Found", summary: "mentions dandruff" },
    ],
    reasoningGaps: [],
    blockingCodes: ["GROUNDING_VIOLATION_PRESENT"],
    summary: { groundingViolationCount: 1, reasoningGapCount: 0 },
  };
}

function blockedReasoning(): ClinicalReadinessSnapshot {
  return {
    schemaVersion: 1,
    evaluatedAt: "2026-07-03T00:00:00.000Z",
    sourceClinicalArtifactVersion: "v4",
    isReadyForApproval: false,
    groundingViolations: [],
    reasoningGaps: [
      { kind: "kit.notDiscussedInNarrative", subject: "HAIR FACT TE GOLD", summary: "not named" },
    ],
    blockingCodes: ["REASONING_GAP_PRESENT"],
    summary: { groundingViolationCount: 0, reasoningGapCount: 1 },
  };
}

function seed(content: Consultation): StoredVersion {
  return {
    id: "v-1",
    consultationId: CONSULTATION_ID,
    clinicId: CLINIC,
    contentVersion: 1,
    content,
    contentHash: "seed-hash",
    createdAt: new Date().toISOString(),
    createdBy: "seed",
    metadata: {
      approvalStatus: "PENDING_REVIEW",
      approvedBy: null,
      approvedAt: null,
      approvalNotes: null,
    },
  };
}

function makeRepo(startingContent: Consultation) {
  const versions: StoredVersion[] = [seed(startingContent)];
  const eventsWritten: ConsultationEvent[] = [];
  const repo: ConsultationRepo = {
    async getLatestByAssessment() {
      return versions[versions.length - 1] ?? null;
    },
    async getVersion() {
      return null;
    },
    async createWithInitialVersion() {
      throw new Error("not used");
    },
    async appendVersion() {
      throw new Error("not used");
    },
    async setApproval(args) {
      const cur = versions[versions.length - 1]!;
      const next: StoredVersion = {
        ...cur,
        metadata: {
          ...cur.metadata,
          approvalStatus: args.status,
          approvedBy: args.approverId,
        },
      };
      versions.push(next);
      eventsWritten.push(...args.events);
      return next;
    },
  };
  return { repo, versions, eventsWritten };
}

const bus: EventBus = { dispatchPending: async () => {} };
const unused = <T>(): T => ({}) as T;
const staticLoaders = {
  branding: { load: async () => null } as ClinicBrandingLoader,
  doctorPrefs: { load: async () => null } as DoctorPreferencesLoader,
  orgDefaults: unused<OrgDefaultsLoader>(),
  previousConsultations: { load: async () => [] } as PreviousConsultationsLoader,
};
const okAssessments: AssessmentLoader = {
  async load(id) {
    return {
      id,
      clinicId: CLINIC,
      patientId: "pat-1",
      submittedAt: new Date().toISOString(),
      source: "test",
      rawAnswers: {},
      reviewingDoctorId: null,
      status: "COMPLETED",
      patient: {
        id: "pat-1",
        name: "P",
        age: 30,
        sex: "male",
        phone: null,
        email: null,
      },
    };
  },
};
function makeOrch(repo: ConsultationRepo) {
  return new ConsultationOrchestrator({
    ...staticLoaders,
    assessments: okAssessments,
    repo,
    bus,
  });
}

describe("orchestrator.approve — clinical readiness gate", () => {
  it("clean snapshot: approves and emits exactly one CONSULTATION_APPROVED", async () => {
    const { repo, eventsWritten } = makeRepo(fakeContent(cleanSnap()));
    const orch = makeOrch(repo);
    await orch.approve({ assessmentId: ASSESSMENT_ID, ctx: doctorCtx, status: "APPROVED" });
    expect(eventsWritten.filter((e) => e.type === "CONSULTATION_APPROVED")).toHaveLength(1);
  });

  it("grounding violation: throws ReadinessBlockedError; no approval event; no status change", async () => {
    const { repo, versions, eventsWritten } = makeRepo(fakeContent(blockedGrounding()));
    const orch = makeOrch(repo);
    const before = versions.length;
    await expect(
      orch.approve({ assessmentId: ASSESSMENT_ID, ctx: doctorCtx, status: "APPROVED" }),
    ).rejects.toBeInstanceOf(ReadinessBlockedError);
    expect(versions.length).toBe(before);
    expect(eventsWritten.some((e) => e.type === "CONSULTATION_APPROVED")).toBe(false);
  });

  it("reasoning gap: same block", async () => {
    const { repo, eventsWritten } = makeRepo(fakeContent(blockedReasoning()));
    const orch = makeOrch(repo);
    await expect(
      orch.approve({ assessmentId: ASSESSMENT_ID, ctx: doctorCtx, status: "APPROVED" }),
    ).rejects.toBeInstanceOf(ReadinessBlockedError);
    expect(eventsWritten.some((e) => e.type === "CONSULTATION_APPROVED")).toBe(false);
  });

  it("historical row with no snapshot: fail closed with READINESS_SNAPSHOT_MISSING", async () => {
    const { repo } = makeRepo(fakeContent(undefined));
    const orch = makeOrch(repo);
    let err: unknown;
    try {
      await orch.approve({ assessmentId: ASSESSMENT_ID, ctx: doctorCtx, status: "APPROVED" });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(ReadinessBlockedError);
    expect((err as ReadinessBlockedError).decision.blockingCodes).toContain(
      "READINESS_SNAPSHOT_MISSING",
    );
  });

  it("REJECTED / REVISION_REQUESTED are NOT gated by readiness — doctor can act on blocked drafts", async () => {
    const { repo } = makeRepo(fakeContent(blockedGrounding()));
    const orch = makeOrch(repo);
    // Both must resolve without throwing readiness blocks; a doctor
    // rejecting a blocked draft is the intended flow.
    await expect(
      orch.approve({
        assessmentId: ASSESSMENT_ID,
        ctx: doctorCtx,
        status: "REVISION_REQUESTED",
        notes: "please rewrite",
      }),
    ).resolves.toBeTruthy();
  });

  it("does not throw a plain OrchestratorError for readiness — the discriminator matters for the 422 route response", async () => {
    const { repo } = makeRepo(fakeContent(blockedGrounding()));
    const orch = makeOrch(repo);
    try {
      await orch.approve({ assessmentId: ASSESSMENT_ID, ctx: doctorCtx, status: "APPROVED" });
    } catch (e) {
      expect(e).not.toBeInstanceOf(OrchestratorError);
      expect(e).toBeInstanceOf(ReadinessBlockedError);
    }
  });
});
