// Unit tests for the ConsultationOrchestrator focused on two P0 outcomes:
//   W1: cross-clinic access is denied on both read and revise.
//   W4: doctor edits emit CONSULTATION_UPDATED{kind:DOCTOR_EDIT} — never
//       DOCTOR_REVIEW_COMPLETED{decision:APPROVED} or CONSULTATION_APPROVED.
//
// We seed the repo with a pre-composed StoredVersion so composeAndStore
// (which transitively pulls the sandbox fixture loader) never runs. Every
// test path here goes through getLatestByAssessment → assertCanRead / revise /
// approve, which is exactly what the fix hardened.

import { describe, it, expect } from "@jest/globals";
import { ConsultationOrchestrator, OrchestratorError } from "../../src/packages/consultation-orchestrator/orchestrator";
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
import type { Consultation } from "@shared/types/consultation";

const CLINIC_A = "clinic-A";
const CLINIC_B = "clinic-B";
const ASSESSMENT_ID = "asm-1";
const CONSULTATION_ID = "cons-1";

function fakeConsultation(): Consultation {
  // Only the fields the orchestrator touches during revise/approve. Everything
  // else is opaque JSON to the version store. Ships a clean readiness
  // snapshot so the Workstream-D approval gate doesn't refuse this fake;
  // readiness behavior itself is exercised in readiness-gate.test.ts.
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

function seedVersion(clinicId: string): StoredVersion {
  return {
    id: "v-1",
    consultationId: CONSULTATION_ID,
    clinicId,
    contentVersion: 1,
    content: fakeConsultation(),
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

function makeRepo(seed: StoredVersion): {
  repo: ConsultationRepo;
  versions: StoredVersion[];
  eventsWritten: ConsultationEvent[];
} {
  const versions: StoredVersion[] = [seed];
  const eventsWritten: ConsultationEvent[] = [];
  const repo: ConsultationRepo = {
    async getLatestByAssessment() {
      return versions[versions.length - 1] ?? null;
    },
    async getVersion(_c, v) {
      return versions.find((x) => x.contentVersion === v) ?? null;
    },
    async createWithInitialVersion() {
      throw new Error("not used in these tests");
    },
    async appendVersion(args) {
      const cur = versions[versions.length - 1]!;
      const next: StoredVersion = {
        ...cur,
        id: `v-${versions.length + 1}`,
        contentVersion: cur.contentVersion + 1,
        content: args.content,
        contentHash: args.contentHash,
      };
      versions.push(next);
      eventsWritten.push(...args.events);
      return next;
    },
    async setApproval(args) {
      const cur = versions[versions.length - 1]!;
      const next: StoredVersion = {
        ...cur,
        metadata: { ...cur.metadata, approvalStatus: args.status, approvedBy: args.approverId },
      };
      versions.push(next);
      eventsWritten.push(...args.events);
      return next;
    },
  };
  return { repo, versions, eventsWritten };
}

const unused = <T>(): T => ({}) as T;
const bus: EventBus = { dispatchPending: async () => {} };
const loaders = {
  assessments: { load: async () => null } as AssessmentLoader,
  branding: { load: async () => null } as ClinicBrandingLoader,
  doctorPrefs: { load: async () => null } as DoctorPreferencesLoader,
  orgDefaults: unused<OrgDefaultsLoader>(),
  previousConsultations: { load: async () => [] } as PreviousConsultationsLoader,
};

function makeOrch(repo: ConsultationRepo) {
  return new ConsultationOrchestrator({ ...loaders, repo, bus });
}

describe("ConsultationOrchestrator — cross-clinic access (W1)", () => {
  it("same-clinic doctor can GET", async () => {
    const { repo } = makeRepo(seedVersion(CLINIC_A));
    const orch = makeOrch(repo);
    const result = await orch.getOrCreate({
      assessmentId: ASSESSMENT_ID,
      ctx: { actorId: "doc-A", role: "DOCTOR", clinicId: CLINIC_A },
    });
    expect(result).toBeTruthy();
  });

  it("different-clinic doctor gets forbidden on GET", async () => {
    const { repo } = makeRepo(seedVersion(CLINIC_A));
    const orch = makeOrch(repo);
    await expect(
      orch.getOrCreate({
        assessmentId: ASSESSMENT_ID,
        ctx: { actorId: "doc-B", role: "DOCTOR", clinicId: CLINIC_B },
      }),
    ).rejects.toBeInstanceOf(OrchestratorError);
  });

  it("different-clinic doctor gets forbidden on PATCH; no version or event written", async () => {
    const { repo, versions, eventsWritten } = makeRepo(seedVersion(CLINIC_A));
    const orch = makeOrch(repo);
    const versionsBefore = versions.length;
    const eventsBefore = eventsWritten.length;

    await expect(
      orch.revise({
        assessmentId: ASSESSMENT_ID,
        ctx: { actorId: "doc-B", role: "DOCTOR", clinicId: CLINIC_B },
        doctorNotes: [],
      }),
    ).rejects.toBeInstanceOf(OrchestratorError);

    expect(versions.length).toBe(versionsBefore);
    expect(eventsWritten.length).toBe(eventsBefore);
  });

  it("super admin can access any clinic consultation", async () => {
    const { repo } = makeRepo(seedVersion(CLINIC_A));
    const orch = makeOrch(repo);
    const result = await orch.getOrCreate({
      assessmentId: ASSESSMENT_ID,
      ctx: { actorId: "sa-1", role: "SUPER_ADMIN", clinicId: null },
    });
    expect(result).toBeTruthy();
  });

  it("clinic-scoped caller without clinicId is forbidden", async () => {
    const { repo } = makeRepo(seedVersion(CLINIC_A));
    const orch = makeOrch(repo);
    await expect(
      orch.getOrCreate({
        assessmentId: ASSESSMENT_ID,
        ctx: { actorId: "doc-X", role: "DOCTOR", clinicId: null },
      }),
    ).rejects.toBeInstanceOf(OrchestratorError);
  });
});

describe("ConsultationOrchestrator — doctor edits do not signal approval (W4)", () => {
  it("PATCH emits CONSULTATION_UPDATED{kind:DOCTOR_EDIT} and no APPROVED events", async () => {
    const { repo, eventsWritten } = makeRepo(seedVersion(CLINIC_A));
    const orch = makeOrch(repo);

    await orch.revise({
      assessmentId: ASSESSMENT_ID,
      ctx: { actorId: "doc-A", role: "DOCTOR", clinicId: CLINIC_A },
      doctorNotes: [{ authorId: "doc-A" } as never],
    });

    const updated = eventsWritten.filter((e) => e.type === "CONSULTATION_UPDATED");
    expect(updated).toHaveLength(1);
    expect((updated[0].payload as { kind: string }).kind).toBe("DOCTOR_EDIT");
    expect(eventsWritten.some((e) => e.type === "DOCTOR_REVIEW_COMPLETED")).toBe(false);
    expect(eventsWritten.some((e) => e.type === "CONSULTATION_APPROVED")).toBe(false);
  });

  it("real approve() emits exactly one CONSULTATION_APPROVED", async () => {
    const { repo, eventsWritten } = makeRepo(seedVersion(CLINIC_A));
    const orch = makeOrch(repo);

    await orch.approve({
      assessmentId: ASSESSMENT_ID,
      ctx: { actorId: "doc-A", role: "DOCTOR", clinicId: CLINIC_A },
      status: "APPROVED",
    });

    const approved = eventsWritten.filter((e) => e.type === "CONSULTATION_APPROVED");
    expect(approved).toHaveLength(1);
  });

  it("PATCH then approve yields distinct edit and approval events", async () => {
    const { repo, eventsWritten } = makeRepo(seedVersion(CLINIC_A));
    const orch = makeOrch(repo);

    await orch.revise({
      assessmentId: ASSESSMENT_ID,
      ctx: { actorId: "doc-A", role: "DOCTOR", clinicId: CLINIC_A },
      doctorNotes: [{ authorId: "doc-A" } as never],
    });
    await orch.approve({
      assessmentId: ASSESSMENT_ID,
      ctx: { actorId: "doc-A", role: "DOCTOR", clinicId: CLINIC_A },
      status: "APPROVED",
    });

    expect(eventsWritten.filter((e) => e.type === "CONSULTATION_UPDATED")).toHaveLength(1);
    expect(eventsWritten.filter((e) => e.type === "CONSULTATION_APPROVED")).toHaveLength(1);
    expect(eventsWritten.some((e) => e.type === "DOCTOR_REVIEW_COMPLETED")).toBe(false);
  });
});
