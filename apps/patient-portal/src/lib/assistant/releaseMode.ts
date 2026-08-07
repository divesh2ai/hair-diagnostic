import type { SystemRole } from "../auth";

export const ASSISTANT_RELEASE_MODES = [
  "DISABLED",
  "INTERNAL_PREVIEW",
  "DOCTOR_ONLY",
  "PATIENT_PILOT",
  "PRODUCTION",
] as const;

export type AssistantReleaseMode = (typeof ASSISTANT_RELEASE_MODES)[number];

export type AssistantReleaseAccess = {
  mode: AssistantReleaseMode;
  allowed: boolean;
  internalProvisionalMode: boolean;
  showInternalTrace: boolean;
  reason?: string;
};

const INTERNAL_ROLES = new Set<SystemRole>(["SUPER_ADMIN", "ORG_ADMIN", "CLINIC_ADMIN", "DOCTOR", "STAFF"]);
const DOCTOR_ROLES = new Set<SystemRole>(["SUPER_ADMIN", "ORG_ADMIN", "CLINIC_ADMIN", "DOCTOR"]);
const list = (value: string | undefined) => new Set((value ?? "").split(",").map((item) => item.trim()).filter(Boolean));

export function readAssistantReleaseMode(env: NodeJS.ProcessEnv = process.env): AssistantReleaseMode {
  const configured = env.ASSISTANT_RELEASE_MODE?.trim().toUpperCase();
  if (ASSISTANT_RELEASE_MODES.includes(configured as AssistantReleaseMode)) return configured as AssistantReleaseMode;
  // Backward-compatible staging bridge. The legacy switch never enables patients.
  if (env.ASSISTANT_STAGE1_ENABLED === "1") return "INTERNAL_PREVIEW";
  return "DISABLED";
}

export function resolveAssistantReleaseAccess(
  identity: { role: SystemRole; clinicId: string | null; userId: string },
  env: NodeJS.ProcessEnv = process.env,
): AssistantReleaseAccess {
  const mode = readAssistantReleaseMode(env);
  const internal = INTERNAL_ROLES.has(identity.role);
  const doctor = DOCTOR_ROLES.has(identity.role);
  const trace = doctor || identity.role === "STAFF";
  if (mode === "DISABLED") return { mode, allowed: false, internalProvisionalMode: false, showInternalTrace: false, reason: "assistant_disabled" };
  if (!identity.clinicId && identity.role !== "SUPER_ADMIN" && identity.role !== "ORG_ADMIN") return { mode, allowed: false, internalProvisionalMode: false, showInternalTrace: false, reason: "clinic_required" };
  if (mode === "INTERNAL_PREVIEW") return { mode, allowed: internal, internalProvisionalMode: internal, showInternalTrace: trace, reason: internal ? undefined : "internal_only" };
  if (mode === "DOCTOR_ONLY") return { mode, allowed: doctor, internalProvisionalMode: doctor, showInternalTrace: doctor, reason: doctor ? undefined : "doctor_only" };
  if (mode === "PATIENT_PILOT" && identity.role === "PATIENT") {
    const clinics = list(env.ASSISTANT_PATIENT_PILOT_CLINIC_IDS); const users = list(env.ASSISTANT_PATIENT_PILOT_USER_IDS);
    const allowed = (!!identity.clinicId && clinics.has(identity.clinicId)) || users.has(identity.userId);
    return { mode, allowed, internalProvisionalMode: false, showInternalTrace: false, reason: allowed ? undefined : "not_in_patient_pilot" };
  }
  if (mode === "PATIENT_PILOT") return { mode, allowed: internal, internalProvisionalMode: internal, showInternalTrace: trace, reason: internal ? undefined : "not_in_patient_pilot" };
  return { mode, allowed: internal || identity.role === "PATIENT", internalProvisionalMode: false, showInternalTrace: trace, reason: internal || identity.role === "PATIENT" ? undefined : "role_not_allowed" };
}
