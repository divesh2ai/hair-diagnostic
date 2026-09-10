/* eslint-disable @typescript-eslint/no-require-imports */
/** @type {import('next').NextConfig} */
const path = require("path");

const appDir = __dirname;
const repoRoot = path.join(appDir, "../..");
const hairosSrc = path.join(repoRoot, "src");
const sharedSrc = path.join(repoRoot, "packages/shared");

require("dotenv").config({ path: path.join(repoRoot, ".env") });

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: repoRoot,

  // ── Report rendering (see lib/reports/assets/browser.ts) ──────────────────
  //
  // Both packages must be left as real Node requires rather than bundled:
  // playwright-core resolves its driver by path at runtime, and
  // @sparticuz/chromium reads compressed binaries out of its own package
  // directory. Bundling either produces a function that builds cleanly and
  // cannot launch a browser.
  serverExternalPackages: ["playwright-core", "@sparticuz/chromium"],

  // Chromium itself. Tracing follows `require` graphs, and a 100 MB brotli
  // archive that the package opens by filename at runtime is not in one — so
  // the render function would ship without a browser and fail exactly where
  // the previous implementation did, only later. Named explicitly.
  outputFileTracingIncludes: {
    "/api/internal/report-assets/render": [
      "./node_modules/@sparticuz/chromium/bin/**",
    ],
    // The clinic's own download runs the same launcher.
    "/api/reports/[assessmentId]/one-page/png": [
      "./node_modules/@sparticuz/chromium/bin/**",
    ],
    "/api/reports/[assessmentId]/one-page/pdf": [
      "./node_modules/@sparticuz/chromium/bin/**",
    ],
  },

  experimental: {
    externalDir: true,
  },
  // Set root to monorepo root so `@hairos` alias can resolve
  // files in <root>/src/packages/... (outside the app dir).
  turbopack: {
    root: repoRoot,
    resolveAlias: {
      "@hairos": hairosSrc,
      "@shared": sharedSrc,
    },
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@hairos": hairosSrc,
      "@shared": sharedSrc,
    };
    return config;
  },
};

module.exports = nextConfig;
