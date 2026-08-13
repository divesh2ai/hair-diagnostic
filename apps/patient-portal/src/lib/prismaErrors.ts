import { Prisma } from '@prisma/client';

// Prisma error classification, kept separate from lib/prisma.ts on purpose.
//
// lib/prisma.ts constructs a client and runs the production-database guard at
// import time. Anything that only needs to *classify* an error — a route's
// catch block, a unit test — must not pay for that, and a unit test certainly
// must not depend on which database the developer's .env happens to name.

/**
 * The deployed code expects a column or table this database does not have.
 *
 * This is never a patient's problem and never transient — it means code shipped
 * ahead of its migration, so every retry fails identically until someone runs
 * `prisma migrate deploy`. It is worth detecting separately because the two
 * generic responses it otherwise produces are both actively misleading: a 500
 * tells an operator "unknown fault" when the cause is precisely known, and
 * "check your connection" tells a patient their phone is at fault when the
 * server is.
 *
 *   P2021 — table does not exist
 *   P2022 — column does not exist
 */
export function isSchemaDriftError(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    (err.code === 'P2021' || err.code === 'P2022')
  );
}

/**
 * Operator-facing description of what is missing, for the server log. Safe to
 * print: it names schema objects, never row data.
 */
export function describeSchemaDrift(err: unknown): string {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError)) return 'unknown';
  const meta = (err.meta ?? {}) as { table?: string; column?: string; modelName?: string };
  return meta.column ?? meta.table ?? meta.modelName ?? err.code;
}
