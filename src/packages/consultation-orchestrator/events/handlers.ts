// Initial event handlers are log-only. As downstream subsystems
// (PDF, video, RAG, notifications) migrate to event-driven dispatch,
// replace the log handler with the real side-effect handler — the orchestrator
// itself never changes.

import type { ConsultationEvent, ConsultationEventType } from "./types";

export type EventHandler<E extends ConsultationEvent = ConsultationEvent> = (
  event: E,
) => Promise<void> | void;

export type HandlerMap = Partial<{
  [K in ConsultationEventType]: EventHandler<Extract<ConsultationEvent, { type: K }>>[];
}>;

function defaultLogHandler<E extends ConsultationEvent>(event: E): void {
  // Single-line JSON makes this easy to grep in Vercel logs.
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({
      ns: "consultation.event",
      type: event.type,
      consultationId: event.consultationId,
      versionId: event.consultationVersionId,
      actorId: event.actorId,
      at: event.occurredAt,
      payload: event.payload,
    }),
  );
}

export function buildDefaultHandlers(): HandlerMap {
  const all: ConsultationEventType[] = [
    "CONSULTATION_CREATED",
    "CONSULTATION_UPDATED",
    "CONSULTATION_APPROVED",
    "DOCTOR_REVIEW_COMPLETED",
    "REPORT_GENERATED",
    "PDF_GENERATED",
    "VIDEO_GENERATION_REQUESTED",
    "VIDEO_GENERATED",
    "RAG_INDEX_REQUESTED",
    "PATIENT_NOTIFICATION_REQUESTED",
    "PATIENT_NOTIFIED",
    "FOLLOWUP_CREATED",
  ];
  const map: HandlerMap = {};
  for (const t of all) {
    (map as Record<string, EventHandler[]>)[t] = [defaultLogHandler];
  }
  return map;
}
