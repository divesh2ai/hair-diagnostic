import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Vitest harness for the patient-portal. Deliberately narrow: it runs the
// branch-attribution unit tests, which are pure logic with Prisma faked, so it
// needs no database and no Next runtime. `server-only` is aliased to a stub so
// server-scoped libs import cleanly under plain Node.
export default defineConfig({
  resolve: {
    alias: {
      'server-only': fileURLToPath(new URL('./test/stubs/server-only.ts', import.meta.url)),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
