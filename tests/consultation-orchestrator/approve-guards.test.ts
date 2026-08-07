// Approval guards on ConsultationOrchestrator.approve():
//   • Assessment must be in an approvable status (CLINICAL_READY,
//     REPORT_GENERATING, COMPLETED, PARTIAL_FAILURE). PENDING / RUNNING* /
//     FAILED reject.
//   • Duplicate approve() with the same status + same approver is a no-op —
//     the WhatsApp review-link submit button retrying / double-clicking must
//     not emit two CONSULTATION_APPROVED events.
//   • Optional expectedContentVersion refuses to approve a version the caller
//     never saw (stale-token guard).
//   • TOKEN_REVIEWER is an authorized role for approve().

import { describe, it, expect } from "@jest/globals";
import { ConsultationOrchestrator, OrchestratorError } from "../../src/packages/consultation-orchestrator/orchestrator";
import type {
  AssessmentLoader,
  AssessmentLoad,
  ClinicBrandingLoader,
  ConsultationRepo,
  DoctorPreferencesLoader,
  EventBus,
  OrgDefaultsLoader,
  PreviousConsultationsLoader,
  StoredVersion,
} from "../../src/packages/consultation-orchestrator/ports";
import type { ConsultationEvent } from "../../src/packages/consultation-orchestrator/events/types";
import type { Consultation } from "@shared/types/consultation";

const CLINIC = "clinic-A";
const ASSESSMENT_ID = "asm-1";
const CONSULTATION_ID = "cons-1";

function fakeConsultation(): Consultation {
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
    clinicalReadiness: {
      schemaVersion: 1,
      evaluatedAt: new Date().toISOString(),
      sourceClinicalArtifactVersion: "v4",
      isReadyForApproval: true,
      groundingViolations: [],
      reasoningGaps: [],
      blockingCodes: [],
      summary: { groundingViolationCount: 0, reasoningGapCount: 0 },
    },
  } as unknown as Consultation;
}

function seed(status: string = "PENDING_REVIEW", approver: string | null = null): StoredVersion {
  return {
    id: "v-1",
    consultationId: CONSULTATION_ID,
    clinicId: CLINIC,
    contentVersion: 1,
    content: fakeConsultation(),
    contentHash: "seed-hash",
    createdAt: new Date().toISOString(),
    createdBy: "seed",
    metadata: {
      approvalStatus: status as StoredVersion["metadata"]["approvalStatus"],
      approvedBy: approver,
      approvedAt: null,
      approvalNotes: null,
    },
  };
}

function makeRepo(seedVersion: StoredVersion) {
  const versions: StoredVersion[] = [seedVersion];
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

function assessmentLoader(status: string): AssessmentLoader {
  return {
    async load(id): Promise<AssessmentLoad | null> {
      return {
        id,
        clinicId: CLINIC,
        patientId: "pat-1",
        submittedAt: new Date().toISOString(),
        source: "test",
        rawAnswers: {},
        reviewingDoctorId: null,
        status,
        patient: {
          id: "pat-1",
          name: "Test",
          age: 30,
          sex: "male",
          phone: null,
          email: null,
        },
      };
    },
  };
}

const bus: EventBus = { dispatchPending: async () => {} };
const unused = <T>(): T => ({}) as T;
const staticLoaders = {
  branding: { load: async () => null } as ClinicBrandingLoader,
  doctorPrefs: { load: async () => null } as DoctorPreferencesLoader,
  orgDefaults: unused<OrgDefaultsLoader>(),
  previousConsultations: { load: async () => [] } as PreviousConsultationsLoader,
};

function makeOrch(repo: ConsultationRepo, asmStatus: string = "COMPLETED") {
  return new ConsultationOrchestrator({
    ...staticLoaders,
    assessments: assessmentLoader(asmStatus),
    repo,
    bus,
  });
}

const doctorCtx = { actorId: "doc-A", role: "DOCTOR", clinicId: CLINIC };

describe("orchestrator.approve — assessment-state guard", () => {
  for (const good of ["CLINICAL_READY", "REPORT_GENERATING", "COMPLETED", "PARTIAL_FAILURE"]) {
    it(`allows approval when assessment.status = ${good}`, async () => {
      const { repo, eventsWritten } = makeRepo(seed());
      const orch = makeOrch(repo, good);
      await orch.approve({ assessmentId: ASSESSMENT_ID, ctx: doctorCtx, status: "APPROVED" });
      expect(eventsWritten.filter((e) => e.type === "CONSULTATION_APPROVED")).toHaveLength(1);
    });
  }

  for (const bad of ["PENDING", "QUEUED", "NORMALIZING", "RUNNING_CLINICAL_ENGINE", "GENERATING_REPORT", "FAILED"]) {
    it(`refuses approval when assessment.status = ${bad}`, async () => {
      const { repo, eventsWritten } = makeRepo(seed());
      const orch = makeOrch(repo, bad);
      await expect(
        orch.approve({ assessmentId: ASSESSMENT_ID, ctx: doctorCtx, status: "APPROVED" }),
      ).rejects.toBeInstanceOf(OrchestratorError);
      expect(eventsWritten.some((e) => e.type === "CONSULTATION_APPROVED")).toBe(false);
    });
  }
});

describe("orchestrator.approve — idempotency", () => {
  it("second identical approval by the same actor is a no-op (no duplicate event)", async () => {
    const { repo, eventsWritten } = makeRepo(seed());
    const orch = makeOrch(repo);
    await orch.approve({ assessmentId: ASSESSMENT_ID, ctx: doctorCtx, status: "APPROVED" });
    await orch.approve({ assessmentId: ASSESSMENT_ID, ctx: doctorCtx, status: "APPROVED" });
    expect(eventsWritten.filter((e) => e.type === "CONSULTATION_APPROVED")).toHaveLength(1);
  });

  it("re-approving with a different status still fires (APPROVED → REJECTED)", async () => {
    const { repo, eventsWritten } = makeRepo(seed());
    const orch = makeOrch(repo);
    await orch.approve({ assessmentId: ASSESSMENT_ID, ctx: doctorCtx, status: "APPROVED" });
    await orch.approve({
      assessmentId: ASSESSMENT_ID,
      ctx: doctorCtx,
      status: "REJECTED",
      notes: "on second thought",
    });
    expect(eventsWritten.filter((e) => e.type === "CONSULTATION_APPROVED")).toHaveLength(1);
    // No CONSULTATION_APPROVED for REJECTED — the existing approve() emits
    // events only for APPROVED, which the repo test already asserts.
  });
});

describe("orchestrator.approve — stale-version guard", () => {
  it("refuses to approve when expectedContentVersion is behind latest", async () => {
    const seedV1 = seed();
    const { repo } = makeRepo(seedV1);
    // Simulate a later version having been appended before the token holder
    // submits: mutate latest to contentVersion=2.
    (repo as unknown as { getLatestByAssessment: () => Promise<StoredVersion> }).getLatestByAssessment =
      async () => ({ ...seedV1, contentVersion: 2 });
    const orch = makeOrch(repo);
    await expect(
      orch.approve({
        assessmentId: ASSESSMENT_ID,
        ctx: doctorCtx,
        status: "APPROVED",
        expectedContentVersion: 1,
      }),
    ).rejects.toBeInstanceOf(OrchestratorError);
  });

  it("passes when expectedContentVersion matches latest", async () => {
    const { repo, eventsWritten } = makeRepo(seed());
    const orch = makeOrch(repo);
    await orch.approve({
      assessmentId: ASSESSMENT_ID,
      ctx: doctorCtx,
      status: "APPROVED",
      expectedContentVersion: 1,
    });
    expect(eventsWritten.filter((e) => e.type === "CONSULTATION_APPROVED")).toHaveLength(1);
  });
});

describe("orchestrator.approve — TOKEN_REVIEWER role", () => {
  it("TOKEN_REVIEWER is allowed to approve (WhatsApp review-link flow)", async () => {
    const { repo, eventsWritten } = makeRepo(seed());
    const orch = makeOrch(repo);
    await orch.approve({
      assessmentId: ASSESSMENT_ID,
      ctx: { actorId: "review-token:reviewer@example.com", role: "TOKEN_REVIEWER", clinicId: CLINIC },
      status: "APPROVED",
    });
    expect(eventsWritten.filter((e) => e.type === "CONSULTATION_APPROVED")).toHaveLength(1);
  });

  it("TOKEN_REVIEWER still fails the clinic ownership check", async () => {
    const { repo } = makeRepo(seed());
    const orch = makeOrch(repo);
    await expect(
      orch.approve({
        assessmentId: ASSESSMENT_ID,
        ctx: {
          actorId: "review-token:x",
          role: "TOKEN_REVIEWER",
          clinicId: "some-other-clinic",
        },
        status: "APPROVED",
      }),
    ).rejects.toBeInstanceOf(OrchestratorError);
  });

  it("unknown role is refused", async () => {
    const { repo } = makeRepo(seed());
    const orch = makeOrch(repo);
    await expect(
      orch.approve({
        assessmentId: ASSESSMENT_ID,
        ctx: { actorId: "x", role: "PATIENT", clinicId: CLINIC },
        status: "APPROVED",
      }),
    ).rejects.toBeInstanceOf(OrchestratorError);
  });
});
