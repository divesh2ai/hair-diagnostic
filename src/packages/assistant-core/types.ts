export const ASSISTANT_INTENTS = [
  "PRODUCT_INFORMATION",
  "PRICE_INFORMATION",
  "KIT_COMPOSITION",
  "KIT_SCHEDULE",
  "INGREDIENT_INFORMATION",
  "KIT_COMPARISON",
  "PLAN_EXPLANATION",
  "SEQUENCE_EXPLANATION",
  "SUPPRESSED_KIT_EXPLANATION",
  "SAFETY_OR_ADVERSE_EVENT",
  "GENERAL_HAIR_EDUCATION",
  "SYSTEM_TRANSPARENCY",
] as const;

export type AssistantIntent = (typeof ASSISTANT_INTENTS)[number];

export const ASSISTANT_ACTIONS = [
  "ANSWER",
  "CLARIFY",
  "ABSTAIN",
  "ESCALATE",
  "URGENT_ESCALATION",
] as const;

export type AssistantAction = (typeof ASSISTANT_ACTIONS)[number];

export type AssistantRole =
  | "PATIENT"
  | "DOCTOR"
  | "CLINIC_STAFF"
  | "ADMIN";

export type AssistantAuthority =
  | "DOCTOR_APPROVED_PLAN"
  | "CLINICAL_RULE_ENGINE"
  | "PRODUCT_DATABASE"
  | "KNOWLEDGE_RAG"
  | "CONVERSATION_CONTEXT";

export type SafetyFlag =
  | "EMERGENCY"
  | "ADVERSE_EVENT"
  | "PREGNANCY"
  | "LACTATION"
  | "PEDIATRIC"
  | "DRUG_INTERACTION"
  | "DOSAGE_CHANGE"
  | "MEDICATION_STOP"
  | "TREATMENT_CHANGE";

export type SourceRef = {
  sourceType: "STRUCTURED_FIELD" | "KNOWLEDGE_CHUNK" | "CLINICAL_RECORD";
  sourceId: string;
  label: string;
  field?: string;
  version?: number;
  effectiveFrom?: string | null;
  approvalStatus?: string;
  url?: string;
  knowledgeSystem?: string;
  authorityScore?: number;
  claimType?: string;
  evidenceStatus?: string;
};

export type SupportedClaim = {
  claim: string;
  sources: SourceRef[];
};

export type AssistantToolResult<T = unknown> = {
  tool: string;
  status: "ok" | "not_found" | "insufficient_approved_data" | "forbidden";
  data?: T;
  sources: SourceRef[];
};

export type AssistantState = {
  requestId: string;
  role: AssistantRole;
  clinicId: string;
  userId: string;
  patientId?: string;
  assessmentId?: string;
  language: string;
  query: string;
  internalProvisionalMode: boolean;
  intent?: AssistantIntent;
  safetyFlags: SafetyFlag[];
  selectedAuthorities: AssistantAuthority[];
  toolResults: AssistantToolResult[];
  retrievedChunks: Array<{
    id: string;
    content: string;
    score: number;
    label: string;
    approvalStatus: string;
  }>;
  contradictions: string[];
  answerDraft?: string;
  supportedClaims: SupportedClaim[];
  action: AssistantAction;
};

export type AssistantResponse = {
  requestId: string;
  threadId?: string;
  messageId?: string;
  intent: AssistantIntent;
  action: AssistantAction;
  answer: string;
  cards: Array<
    | { type: "price"; title: string; amount: number; currency: string; status: string }
    | { type: "composition"; title: string; items: string[] }
    | { type: "schedule"; title: string; items: Array<{ product: string; schedule: string }> }
    | { type: "plan"; title: string; items: string[] }
  >;
  sources: SourceRef[];
  safetyFlags: SafetyFlag[];
  toolCalls: Array<{ name: string; status: AssistantToolResult["status"]; sourceIds: string[] }>;
};
