// Optimistic-conflict guard for orchestrator.revise:
//   • when expectedContentVersion matches latest, revise proceeds and emits
//     the same CONSULTATION_UPDATED{kind:DOCTOR_EDIT} event as always;
//   • when expectedContentVersion is behind latest (concurrent edit landed),
//     revise throws OrchestratorError("invalid") and does NOT append a
//     version or emit an event — the doctor UI reloads and shows the fresh
//     state instead of silently overwriting a colleague's edit.
// W4 (no APPROVED event on edit) is re-asserted here to lock down against
// regressions.

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
  } as unknown as Consultation;
}

function makeRepo(startingVersion = 1) {
  const versions: StoredVersion[] = [
    {
      id: "v-1",
      consultationId: CONSULTATION_ID,
      clinicId: CLINIC,
      contentVersion: startingVersion,
      content: fakeConsultation(),
      contentHash: "seed",
      createdAt: new Date().toISOString(),
      createdBy: "seed",
      metadata: {
        approvalStatus: "PENDING_REVIEW",
        approvedBy: null,
        approvedAt: null,
        approvalNotes: null,
      },
    },
  ];
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
    async setApproval() {
      throw new Error("not used");
    },
  };
  return { repo, versions, eventsWritten };
}

const unused = <T>(): T => ({}) as T;
const staticLoaders = {
  assessments: { load: async () => null } as AssessmentLoader,
  branding: { load: async () => null } as ClinicBrandingLoader,
  doctorPrefs: { load: async () => null } as DoctorPreferencesLoader,
  orgDefaults: unused<OrgDefaultsLoader>(),
  previousConsultations: { load: async () => [] } as PreviousConsultationsLoader,
};
const bus: EventBus = { dispatchPending: async () => {} };

function makeOrch(repo: ConsultationRepo) {
  return new ConsultationOrchestrator({ ...staticLoaders, repo, bus });
}

const doctorCtx = { actorId: "doc-A", role: "DOCTOR", clinicId: CLINIC };

describe("orchestrator.revise — stale-version guard", () => {
  it("proceeds when expectedContentVersion matches the persisted latest", async () => {
    const { repo, versions, eventsWritten } = makeRepo(1);
    const orch = makeOrch(repo);
    await orch.revise({
      assessmentId: ASSESSMENT_ID,
      ctx: doctorCtx,
      doctorNotes: [{ authorId: "doc-A" } as never],
      expectedContentVersion: 1,
    });
    expect(versions.length).toBe(2);
    expect(eventsWritten.filter((e) => e.type === "CONSULTATION_UPDATED")).toHaveLength(1);
    expect(eventsWritten.some((e) => e.type === "CONSULTATION_APPROVED")).toBe(false);
  });

  it("refuses when expectedContentVersion is behind latest and does not append", async () => {
    // Simulate a colleague already advanced the version to 2.
    const { repo, versions, eventsWritten } = makeRepo(2);
    const orch = makeOrch(repo);
    await expect(
      orch.revise({
        assessmentId: ASSESSMENT_ID,
        ctx: doctorCtx,
        doctorNotes: [{ authorId: "doc-A" } as never],
        expectedContentVersion: 1,
      }),
    ).rejects.toBeInstanceOf(OrchestratorError);
    expect(versions.length).toBe(1);
    expect(eventsWritten).toHaveLength(0);
  });

  it("omitting expectedContentVersion keeps the historical no-op-recompose behavior", async () => {
    const { repo, eventsWritten } = makeRepo(1);
    const orch = makeOrch(repo);
    await orch.revise({
      assessmentId: ASSESSMENT_ID,
      ctx: doctorCtx,
      doctorNotes: [{ authorId: "doc-A" } as never],
    });
    expect(eventsWritten.filter((e) => e.type === "CONSULTATION_UPDATED")).toHaveLength(1);
  });
});
