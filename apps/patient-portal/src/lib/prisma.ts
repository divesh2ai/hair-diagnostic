import { PrismaClient, Prisma } from '@prisma/client';

// Prevent multiple Prisma Client instances during Next.js hot-reload in dev.
// In production a single instance is created for the process lifetime.
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

// Recognise transient connection failures — pgbouncer closes idle sockets on
// Supabase (connection_limit=1 in DATABASE_URL) and the next query fails with
// "connection reset" or one of the initialisation-error codes below. These
// are ephemeral: one reconnect + retry is enough.
function isRetryableConnectionError(err: unknown): boolean {
  if (!err) return false;
  const msg =
    err instanceof Error ? `${err.name} ${err.message}` : String(err);

  // Common Node/OpenSSL kernel-level socket resets from Supabase pooler.
  if (/ECONNRESET|forcibly closed|connection reset|Kind: Io|EPIPE/i.test(msg)) {
    return true;
  }
  // Prisma's own transient DB error codes.
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // P1001 can't reach server, P1002 timed out, P1008 timed out, P1017 server closed.
    // P2024 is a transient timeout acquiring Prisma's local pool slot.
    return ["P1001", "P1002", "P1008", "P1017", "P2024"].includes(err.code);
  }
  if (err instanceof Prisma.PrismaClientInitializationError) return true;
  if (err instanceof Prisma.PrismaClientRustPanicError) return true;
  return false;
}

function isPoolAcquisitionTimeout(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2024"
  );
}

function makeClient(): PrismaClient {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

  // One-shot retry on transient connection failures. Uses $extends so the
  // wrapper stays type-safe; falls back to the plain client for non-model
  // calls ($transaction, $queryRaw, etc.).
  return client.$extends({
    query: {
      $allOperations: async ({ args, query }) => {
        try {
          return await query(args);
        } catch (err) {
          if (!isRetryableConnectionError(err)) throw err;
          // A P2024 means another request currently owns the local pool slot.
          // Never disconnect that request; briefly yield and queue one retry.
          await new Promise((r) =>
            setTimeout(r, isPoolAcquisitionTimeout(err) ? 300 : 120),
          );
          if (!isPoolAcquisitionTimeout(err)) {
            try {
              await client.$disconnect();
            } catch {
              /* swallow; reconnect happens on the next query */
            }
          }
          return await query(args);
        }
      },
    },
  }) as unknown as PrismaClient;
}

export const prisma = globalForPrisma.prisma ?? makeClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
