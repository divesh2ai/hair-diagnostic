"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("node:path");
const config_1 = require("vitest/config");
exports.default = (0, config_1.defineConfig)({
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "apps/patient-portal/src"),
            "@hairos": path.resolve(__dirname, "src"),
            // Mirrors the `@shared/*` path in both tsconfigs and the mapper in
            // jest.config.cjs. Without it, anything importing shared code —
            // lib/prisma.ts now imports the database guard — fails to resolve
            // under vitest only.
            "@shared": path.resolve(__dirname, "packages/shared"),
        },
    },
    test: {
        globals: true,
        environment: 'node',
        include: [
            'tests/**/*.test.ts',
            'src/packages/**/*.test.ts'
        ],
        exclude: [
            'tests/e2e/**',
            'node_modules/**',
            'dist/**',
            '.vscode/**'
        ]
    }
});
