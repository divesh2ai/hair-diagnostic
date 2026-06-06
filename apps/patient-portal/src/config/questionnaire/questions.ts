/**
 * @deprecated
 * This file is no longer the questionnaire source of truth.
 *
 * The frontend now renders directly from the DrFACT clinical protocol:
 *   src/packages/ai-engine/questionnaire-engine/schema/questionnaire.schema.json
 *
 * Typed and exported via:
 *   src/packages/ai-engine/questionnaire-engine/protocol/masterProtocol.ts
 *
 * Adapted to the runtime Question[] format by:
 *   apps/patient-portal/src/runtime/protocolAdapter.ts
 *
 * Loaded into the runtime by:
 *   apps/patient-portal/src/runtime/protocolLoader.ts
 *
 * DO NOT add questions here. DO NOT import this file in new code.
 */

export const questionnaireConfig: never[] = [];
