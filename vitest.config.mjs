import path from 'node:path'
import { defineConfig } from 'vitest/config'

// NOTE: vitest.config.js (the compiled sibling) is the one vitest actually
// loads today. Aliases are kept identical in both so whichever wins resolves
// the same modules.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), 'apps/patient-portal/src'),
      '@hairos': path.resolve(process.cwd(), 'src'),
      '@shared': path.resolve(process.cwd(), 'packages/shared'),
    },
  },
  test: {
    globals: true,
    environment: 'node',

    include: [
      'tests/**/*.test.ts'
    ],

    exclude: [
      'tests/e2e/**',
      'node_modules/**',
      'dist/**',
      '.vscode/**'
    ]
  }
})