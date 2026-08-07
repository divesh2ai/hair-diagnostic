export const ASSISTANT_MODES = ["GENERAL_KNOWLEDGE", "PERSONAL_PLAN"] as const;
export type AssistantMode = (typeof ASSISTANT_MODES)[number];

export function isPersonalPlanRequest(value: unknown): value is "PERSONAL_PLAN" {
  return value === "PERSONAL_PLAN";
}
