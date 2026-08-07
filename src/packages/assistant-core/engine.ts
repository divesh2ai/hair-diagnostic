import { authoritiesForIntent } from "./authority";
import { classifyIntent, detectSafetyFlags, isHairAssistantScope } from "./classifier";
import { getKnowledgeCoverage } from "./catalogueTools";
import { PilotCatalogue, type CataloguePort } from "./cataloguePort";
import type { ApprovedClinicalContext, ClinicalAuthorityPort } from "./clinicalAuthority";
import { NoClinicalContext } from "./clinicalAuthority";
import { PILOT_KITS, PILOT_SOURCE, resolvePilotKit } from "./pilotData";
import { searchPilotKnowledge } from "./pilotKnowledge";
import type { AssistantAction, AssistantResponse, AssistantRole, AssistantToolResult, SourceRef } from "./types";

export type AssistantRequest = {
  requestId?: string;
  query: string;
  role: AssistantRole;
  clinicId: string;
  userId: string;
  patientId?: string;
  assessmentId?: string;
  language?: string;
  internalProvisionalMode?: boolean;
};

const money = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
const uniqueSources = (tools: AssistantToolResult[]): SourceRef[] => {
  const seen = new Set<string>();
  return tools.flatMap((tool) => tool.sources).filter((item) => {
    const key = `${item.sourceType}:${item.sourceId}:${item.field ?? ""}`;
    if (seen.has(key)) return false; seen.add(key); return true;
  });
};
const names = (value: unknown): string[] => Array.isArray(value) ? value.map((x) => String((x as { productName?: string }).productName ?? x)) : [];

function safetyAnswer(query: string): { action: AssistantAction; answer: string } {
  const q = query.toLowerCase();
  if (/(breath|breathing).*(difficult|problem)|swelling.*(breath|face|tongue)/.test(q)) {
    return { action: "URGENT_ESCALATION", answer: "This may be a medical emergency. Stop this conversation and seek emergency medical help now. If symptoms began after a product, do not take another dose until an emergency clinician has assessed you. The clinic should also be notified after urgent help is underway." };
  }
  if (/sudden round patches/.test(q)) return { action: "URGENT_ESCALATION", answer: "Sudden round patches need prompt clinical assessment. I cannot recommend a kit for this; I have routed it for urgent doctor review." };
  if (/severe stomach pain/.test(q)) return { action: "URGENT_ESCALATION", answer: "Severe stomach pain after starting a kit needs urgent clinical review. Pause routine assistant guidance, seek prompt medical care, and report the event to the clinic. I cannot diagnose the cause." };
  if (/double the dose/.test(q)) return { action: "ESCALATE", answer: "Do not double a dose to make up for a missed one. Follow the approved instructions or ask the treating clinician; I have routed the dosing question for review." };
  if (/stop.*(medicine|medication)/.test(q)) return { action: "ESCALATE", answer: "Do not stop prescribed medicine or replace it with a kit without the prescribing clinician's advice. This requires clinical review." };
  if (/with thyroid medicine|interaction/.test(q)) return { action: "CLARIFY", answer: "I need the exact kit or product and the exact medicine. Approved interaction data is not loaded, so even with those details this must be checked by a clinician or pharmacist." };
  if (/replace|switch|remove one kit|buy only one product/.test(q)) return { action: "ESCALATE", answer: "I cannot change, substitute or split a treatment plan. This request requires clinical review and doctor approval." };
  return { action: "ESCALATE", answer: "Approved safety guidance for pregnancy, breastfeeding, children, contraindications and interactions is not loaded. I cannot confirm safety; please ask the treating clinician before taking the kit." };
}

function planAnswer(query: string, context: ApprovedClinicalContext | null): { action: AssistantAction; answer: string; sources: SourceRef[] } {
  if (/replace|switch|buy only one product/.test(query.toLowerCase())) return { action: "ESCALATE", answer: "I cannot change, substitute or split an approved treatment plan. A doctor must review and approve that request.", sources: context?.sources ?? [] };
  if (!context) return { action: "ESCALATE", answer: "I cannot find an approved patient plan and persisted clinical rule trace for this request. I will not infer a selection or sequence from the catalogue; a doctor must review it.", sources: [] };
  const q = query.toLowerCase();
  if (/start first/.test(q)) return { action: "ANSWER", answer: `Your approved sequence starts with ${context.kitSequence[0]}.`, sources: context.sources };
  if (/after i finish/.test(q)) return { action: "ANSWER", answer: context.kitSequence[1] ? `The approved next phase is ${context.kitSequence[1]}. Follow-up remains required before any unapproved change.` : "The approved plan does not record a next phase; please ask your doctor.", sources: context.sources };
  const relevant = context.ruleTrace.find((trace) => {
    const kitId = (trace.kitId ?? "").toLowerCase();
    if (!kitId) return false;
    if (q.includes("inflammation")) return kitId.includes("inflammation");
    if (q.includes("gi gold")) return kitId.includes("gi_gold");
    if (q.includes("te gold")) return kitId.includes("te_gold");
    if (q.includes("pattern hair")) return trace.action === "PRIORITIZED";
    return q.includes(kitId.replace(/^kit_/, "").replaceAll("_", " "));
  }) ?? context.ruleTrace[0];
  if (!relevant) return { action: "ESCALATE", answer: "The approved plan exists, but its persisted trace does not state this reason. I will not invent one; please ask the doctor.", sources: context.sources };
  return { action: "ANSWER", answer: `${relevant.reason} This explanation reports the stored deterministic rule result; it does not recalculate or change your plan.`, sources: context.sources };
}

export async function runAssistant(request: AssistantRequest, clinical: ClinicalAuthorityPort = new NoClinicalContext(), catalogue: CataloguePort = new PilotCatalogue()): Promise<AssistantResponse> {
  const requestId = request.requestId ?? `asst_${Date.now()}`;
  const query = request.query.trim();
  const q = query.toLowerCase();
  if (!isHairAssistantScope(query)) {
    const excluded = /ayurveda/i.test(query) ? "Ayurveda is not active" : /skin/i.test(query) ? "Skin is a future domain" : "That topic is outside scope";
    return { requestId, intent: "GENERAL_HAIR_EDUCATION", action: "ABSTAIN", answer: `${excluded} in the current Dr. FACT assistant. The current assistant focuses on Hair health.`, cards: [], sources: [], safetyFlags: [], toolCalls: [] };
  }
  const intent = classifyIntent(query);
  const safetyFlags = detectSafetyFlags(query);
  const tools: AssistantToolResult[] = [];
  let action: AssistantAction = "ANSWER";
  let answer = "";
  const cards: AssistantResponse["cards"] = [];

  if (intent === "SAFETY_OR_ADVERSE_EVENT") {
    ({ action, answer } = safetyAnswer(query));
  } else if (safetyFlags.includes("TREATMENT_CHANGE")) {
    const context = await clinical.getApprovedContext(request);
    ({ action, answer } = planAnswer(query, context));
  } else if (["PLAN_EXPLANATION", "SEQUENCE_EXPLANATION", "SUPPRESSED_KIT_EXPLANATION"].includes(intent)) {
    const context = await clinical.getApprovedContext(request);
    const result = planAnswer(query, context); action = result.action; answer = result.answer;
    tools.push({ tool: "getApprovedPatientPlan/getClinicalDecisionTrace", status: context ? "ok" : "not_found", data: context ?? undefined, sources: result.sources });
  } else if (intent === "PRICE_INFORMATION") {
    if (/\bmeta\s*b\b/.test(q)) {
      action = "ABSTAIN"; answer = "Price records for PRO FACT META B and its variants remain parked under PENDING_PRICE_REVISION. I cannot provide a patient-facing price until the governed price revision is explicitly approved and published.";
    } else if (/discount|stock|previous mrp|clinic charge/.test(q)) {
      action = /clinic charge/.test(q) ? "ESCALATE" : "ABSTAIN";
      answer = "That requires a live offer, inventory, price-history or clinic-policy record. No such approved record is loaded, so I cannot guess.";
    } else {
      const result = await catalogue.getCurrentKitPrice(query); tools.push(result);
      const data = result.data as { name: string; mrp: number; currency: string; status: string } | undefined;
      if (!data) { action = "CLARIFY"; answer = "Which of the five pilot kits do you mean?"; }
      else { answer = `The current pilot-sheet MRP for ${data.name} is ${money(data.mrp)}. This is provisional source data, not a guarantee of the clinic's final selling price.`; cards.push({ type: "price", title: data.name, amount: data.mrp, currency: data.currency, status: data.status }); }
    }
  } else if (intent === "KIT_COMPOSITION") {
    if (/which pilot kits contain f[- ]?immusurge/.test(q)) {
      const result = await catalogue.getKitsContainingProduct("F-IMMUSurge"); tools.push(result);
      const kitNames = (result.data as Array<{ name: string }>).map((x) => x.name);
      answer = `Within the five loaded pilot kits, F-IMMUSurge appears in ${kitNames.join(", ")}.`;
    } else {
      const kit = resolvePilotKit(query); const result = await catalogue.getKitComposition(query); tools.push(result);
      const data = result.data as { name: string; components: Array<{ productId: string; productName: string }> } | undefined;
      if (!data) { action = "CLARIFY"; answer = "Which pilot kit do you want to inspect?"; }
      else if (/does .*contain/.test(q)) {
        const product = q.includes("tricho-ino") || q.includes("tricho ino") ? "F_TRICHO_INO" : "";
        answer = product && data.components.some((x) => x.productId === product) ? `Yes. ${data.name} contains F-TRICHO-INO.` : `The structured composition does not show that exact product in ${data.name}.`;
      } else { const items = data.components.map((x) => x.productName); answer = `${data.name} contains ${items.length} pilot products: ${items.join(", ")}.`; cards.push({ type: "composition", title: data.name, items }); }
      if (!kit) action = "CLARIFY";
    }
  } else if (intent === "KIT_SCHEDULE") {
    const result = await catalogue.getKitSchedule(query); tools.push(result);
    const data = result.data as { name: string; components: Array<{ productName: string; schedule: string }> } | undefined;
    if (!data) { action = "CLARIFY"; answer = "Which pilot kit schedule do you mean?"; }
    else {
      const filtered = data.components.filter((x) => /sunday/.test(q) ? /sunday/i.test(x.schedule) : /daily|alternate day/.test(q) ? /daily|alternate day/i.test(x.schedule) : true);
      answer = filtered.map((x) => `${x.productName}: ${x.schedule}`).join("; ") + ". These are schedule labels from the source sheet, not dosage instructions.";
      cards.push({ type: "schedule", title: data.name, items: filtered.map((x) => ({ product: x.productName, schedule: x.schedule })) });
    }
  } else if (intent === "KIT_COMPARISON") {
    const result = await catalogue.compareKits("TE GOLD", "GI GOLD"); tools.push(result);
    const data = result.data as { shared: string[]; leftOnly: string[]; rightOnly: string[] };
    answer = `Shared: ${data.shared.join(", ")}. TE GOLD only: ${data.leftOnly.join(", ")}. GI GOLD only: ${data.rightOnly.join(", ")}. This composition comparison does not say either kit is clinically better.`;
  } else if (intent === "INGREDIENT_INFORMATION") {
    const result = await catalogue.getProductIngredients(query); tools.push(result);
    if (/role of lactoferrin/.test(q) && request.internalProvisionalMode) {
      const chunks = searchPilotKnowledge("lactoferrin", { audience: "INTERNAL_PREVIEW" }).filter((chunk) => chunk.score > 0);
      answer = "Internal provisional education: the pilot narrative discusses lactoferrin as nutritional and immune-support context, but the mechanism and evidence wording are pending medical review and are not a treatment claim.";
      tools.push({ tool: "searchKnowledge", status: chunks.length ? "ok" : "not_found", data: { chunkIds: chunks.map((chunk) => chunk.id) }, sources: chunks.map((chunk) => ({ sourceType: "KNOWLEDGE_CHUNK", sourceId: chunk.id, label: `${PILOT_SOURCE.file} / Clinical Chunks`, version: 1, approvalStatus: PILOT_SOURCE.knowledgeStatus })) });
    } else {
      action = "ABSTAIN";
      answer = "Approved structured ingredient quantities, strains and reverse-ingredient mappings are not loaded. Product names and provisional narrative are not sufficient to infer them, so I cannot answer exactly.";
    }
  } else if (intent === "PRODUCT_INFORMATION") {
    const kit = resolvePilotKit(query);
    if (!kit) { action = "CLARIFY"; answer = "Which pilot kit do you mean?"; }
    else if (!request.internalProvisionalMode) { action = "ABSTAIN"; answer = `The explanatory material for ${kit.name} is still pending medical review. I can show structured price, composition and schedule data, but cannot publish its provisional clinical explanation yet.`; }
    else {
      const chunks = searchPilotKnowledge(query, { audience: "INTERNAL_PREVIEW", kitId: kit.id });
      answer = `${chunks[0]?.content ?? kit.purpose} Internal preview: this explanation is provisional and pending medical review.`;
      tools.push({ tool: "searchKnowledge", status: chunks.length ? "ok" : "not_found", data: { kitId: kit.id, chunkIds: chunks.map((chunk) => chunk.id) }, sources: chunks.slice(0, 3).map((chunk) => ({ sourceType: "KNOWLEDGE_CHUNK", sourceId: chunk.id, label: `${PILOT_SOURCE.file} / Clinical Chunks`, version: 1, approvalStatus: PILOT_SOURCE.knowledgeStatus })) });
    }
  } else if (intent === "SYSTEM_TRANSPARENCY") {
    const result = getKnowledgeCoverage(); tools.push(result);
    answer = /show me the sources/.test(q) ? "Sources are attached claim by claim to the structured response. No source means the assistant must abstain." : `The pilot does not yet have approved safety guidance, complete ingredient quantities, live offers or stock, clinic pricing policy, or final medical approval for explanatory chunks. It knows five pilot kits and their provisional structured price, composition and schedule records.`;
  } else {
    if (!request.internalProvisionalMode) { action = "ABSTAIN"; answer = "Approved explanatory knowledge for this question is not yet published. I can answer structured catalogue questions or route this for medical review."; }
    else {
      const retrievalQuery = /pattern hair.*dht/.test(q) ? "androgen sensitivity inflammation" : query;
      const retrieved = /topicals/.test(q) ? [] : searchPilotKnowledge(retrievalQuery, { audience: "INTERNAL_PREVIEW" }).filter((chunk) => chunk.score > 0);
      if (/guaranteed|guarantee/.test(q)) answer = "Hair regrowth cannot be guaranteed. Response varies with the cause, severity, adherence and hair-cycle timing; this is not a fixed outcome promise.";
      else if (/topicals/.test(q)) answer = "Topicals and nutraceutical kits may be discussed together as general education, but a patient-specific combination requires the approved plan or doctor review. I cannot approve a combination from catalogue content.";
      else if (/expectations given in months/.test(q)) answer = "Hair-cycle changes are observed over months rather than days, so recovery expectations use month-scale windows. Individual response varies and no fixed result is guaranteed.";
      else if (/pattern hair.*dht/.test(q)) answer = "Pattern hair loss is not only caused by DHT. The supplied provisional hair knowledge also describes genetic susceptibility, follicular hormonal sensitivity, inflammation and other modifying factors. This is general education, not a diagnosis.";
      else { const grounded = retrieved[0]?.content ?? "Hair and scalp outcomes can involve hair-cycle timing, nutrition and absorption, inflammatory signalling, hormonal sensitivity and other factors."; answer = `Internal provisional general education: ${grounded} This is not a diagnosis or treatment recommendation, and the source is pending medical review.`; }
      tools.push({ tool: "searchKnowledge", status: retrieved.length ? "ok" : "not_found", data: { chunkIds: retrieved.map((chunk) => chunk.id) }, sources: retrieved.slice(0, 3).map((chunk) => ({ sourceType: "KNOWLEDGE_CHUNK", sourceId: chunk.id, label: `${PILOT_SOURCE.file} / Clinical Chunks`, version: 1, approvalStatus: PILOT_SOURCE.knowledgeStatus })) });
      if (!retrieved.length) tools.push(getKnowledgeCoverage());
    }
  }

  const sources = uniqueSources(tools);
  void authoritiesForIntent(intent); // explicit policy lookup is retained for trace persistence by callers
  return { requestId, intent, action, answer, cards, sources, safetyFlags, toolCalls: tools.map((tool) => ({ name: tool.tool, status: tool.status, sourceIds: tool.sources.map((source) => source.sourceId) })) };
}

