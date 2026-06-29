// Default Prisma-backed orchestrator factory. Production callers (API routes,
// the assessment pipeline) use this. Tests + the sandbox wire their own
// adapters into `new ConsultationOrchestrator({...})` directly.

import type { PrismaClient } from "@prisma/client";
import { ConsultationOrchestrator } from "./orchestrator";
import {
  prismaAssessmentLoader,
  prismaClinicBrandingLoader,
  prismaDoctorPreferencesLoader,
  prismaOrgDefaultsLoader,
  prismaPreviousConsultationsLoader,
} from "./infra/loaders";
import { prismaConsultationRepo } from "./infra/prismaRepo";
import { prismaOutboxBus, type OutboxBusOptions } from "./infra/outboxBus";

export interface MakeOrchestratorOptions {
  busOptions?: OutboxBusOptions;
}

export function makeOrchestrator(
  prisma: PrismaClient,
  opts: MakeOrchestratorOptions = {},
): ConsultationOrchestrator {
  return new ConsultationOrchestrator({
    assessments: prismaAssessmentLoader(prisma),
    branding: prismaClinicBrandingLoader(prisma),
    doctorPrefs: prismaDoctorPreferencesLoader(prisma),
    orgDefaults: prismaOrgDefaultsLoader(prisma),
    previousConsultations: prismaPreviousConsultationsLoader(prisma),
    repo: prismaConsultationRepo(prisma),
    bus: prismaOutboxBus(prisma, opts.busOptions),
  });
}
