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
  typescript: {
    ignoreBuildErrors: true,
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
