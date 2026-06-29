// Outbox-driven event bus. Events are persisted to ConsultationEvent in the
// same transaction as the version that produced them; this dispatcher reads
// PENDING rows and invokes registered handlers. Failures mark the row FAILED
// (with attempt count + last error) so they're easy to inspect and replay.

import type { PrismaClient } from "@prisma/client";
import type { EventBus } from "../ports";
import type { ConsultationEvent } from "../events/types";
import { type HandlerMap, buildDefaultHandlers } from "../events/handlers";

export interface OutboxBusOptions {
  handlers?: HandlerMap;
  /** Max attempts before a row is left as FAILED. Defaults to 3. */
  maxAttempts?: number;
}

export function prismaOutboxBus(
  prisma: PrismaClient,
  opts: OutboxBusOptions = {},
): EventBus {
  const handlers = opts.handlers ?? buildDefaultHandlers();
  const maxAttempts = opts.maxAttempts ?? 3;

  return {
    async dispatchPending(consultationId) {
      const pending = await prisma.consultationEvent.findMany({
        where: { consultationId, status: "PENDING" },
        orderBy: { createdAt: "asc" },
      });

      for (const row of pending) {
        const event = {
          type: row.type,
          consultationId: row.consultationId,
          consultationVersionId: row.consultationVersionId ?? undefined,
          occurredAt: row.createdAt.toISOString(),
          // The persisted payload doesn't carry actor; we keep it on the
          // typed event for in-memory handlers but it's recoverable from
          // the related version row if a handler ever needs it.
          actorId: "system",
          payload: row.payload as unknown,
        } as unknown as ConsultationEvent;

        const fns = (handlers as Record<string, ((e: ConsultationEvent) => Promise<void> | void)[]>)[
          row.type
        ] ?? [];

        try {
          for (const fn of fns) await fn(event);
          await prisma.consultationEvent.update({
            where: { id: row.id },
            data: {
              status: "PROCESSED",
              processedAt: new Date(),
              attempts: row.attempts + 1,
            },
          });
        } catch (err) {
          const nextAttempts = row.attempts + 1;
          await prisma.consultationEvent.update({
            where: { id: row.id },
            data: {
              status: nextAttempts >= maxAttempts ? "FAILED" : "PENDING",
              attempts: nextAttempts,
              lastError: err instanceof Error ? err.message : String(err),
            },
          });
        }
      }
    },
  };
}
