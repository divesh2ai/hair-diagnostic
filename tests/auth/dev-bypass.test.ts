import { describe, expect, it } from "vitest";
import {
  isDevBypassRuntimeAllowed,
  isPreviewRuntime,
  isProductionRuntime,
} from "@shared/env/databaseTarget";
import {
  DEV_LOGIN_DEFAULT_EMAIL,
  devLoginSecretMatches,
  isDevLoginEnabled,
  isDevLoginForbidden,
  resolveDevLoginEmail,
  safeEqual,
} from "@/lib/auth/devBypass";

// Security contract for the developer sign-in / report-export bypass.
//
// The one guarantee that must never regress: on a production deployment the
// bypass is refused even when BOTH the opt-in flag and the correct secret are
// present (the "accidental env leak on prod" case). Everything else — preview
// allowed, arbitrary-email escalation blocked, constant-time secret compare —
// is defence layered on top of that.

type Env = NodeJS.ProcessEnv;
const env = (o: Record<string, string | undefined>): Env => o as Env;

describe("isDevBypassRuntimeAllowed (strict preview allowlist)", () => {
  it("refuses Vercel production", () => {
    expect(isDevBypassRuntimeAllowed(env({ VERCEL_ENV: "production" }))).toBe(false);
  });
  it("allows Vercel preview", () => {
    expect(isDevBypassRuntimeAllowed(env({ VERCEL_ENV: "preview" }))).toBe(true);
  });
  it("refuses any other Vercel env (not merely !== production)", () => {
    expect(isDevBypassRuntimeAllowed(env({ VERCEL_ENV: "development" }))).toBe(false);
  });
  it("allows local/CI off Vercel (no VERCEL_ENV, non-prod NODE_ENV)", () => {
    expect(isDevBypassRuntimeAllowed(env({ NODE_ENV: "development" }))).toBe(true);
    expect(isDevBypassRuntimeAllowed(env({}))).toBe(true);
  });
  it("refuses a local production build (NODE_ENV=production, no VERCEL_ENV)", () => {
    expect(isDevBypassRuntimeAllowed(env({ NODE_ENV: "production" }))).toBe(false);
  });
});

describe("runtime predicates", () => {
  it("isProductionRuntime keys strictly on VERCEL_ENV", () => {
    expect(isProductionRuntime(env({ VERCEL_ENV: "production" }))).toBe(true);
    expect(isProductionRuntime(env({ NODE_ENV: "production" }))).toBe(false);
  });
  it("isPreviewRuntime keys strictly on VERCEL_ENV", () => {
    expect(isPreviewRuntime(env({ VERCEL_ENV: "preview" }))).toBe(true);
    expect(isPreviewRuntime(env({ VERCEL_ENV: "production" }))).toBe(false);
  });
});

describe("isDevLoginForbidden (hard production block)", () => {
  it("is true on production regardless of flags", () => {
    expect(
      isDevLoginForbidden(env({ VERCEL_ENV: "production", ALLOW_DEV_LOGIN: "1" })),
    ).toBe(true);
  });
  it("is false on preview and local", () => {
    expect(isDevLoginForbidden(env({ VERCEL_ENV: "preview" }))).toBe(false);
    expect(isDevLoginForbidden(env({}))).toBe(false);
  });
});

describe("isDevLoginEnabled (runtime gate + opt-in)", () => {
  it("requires both the runtime AND ALLOW_DEV_LOGIN=1", () => {
    expect(isDevLoginEnabled(env({ VERCEL_ENV: "preview", ALLOW_DEV_LOGIN: "1" }))).toBe(true);
    expect(isDevLoginEnabled(env({ VERCEL_ENV: "preview" }))).toBe(false);
    expect(isDevLoginEnabled(env({ VERCEL_ENV: "preview", ALLOW_DEV_LOGIN: "true" }))).toBe(false);
  });
  it("stays disabled on production even with the opt-in flag set", () => {
    expect(
      isDevLoginEnabled(env({ VERCEL_ENV: "production", ALLOW_DEV_LOGIN: "1" })),
    ).toBe(false);
  });
});

describe("devLoginSecretMatches (constant-time)", () => {
  const e = env({ DEV_LOGIN_SECRET: "s3cr3t" });
  it("matches the configured secret", () => {
    expect(devLoginSecretMatches("s3cr3t", e)).toBe(true);
  });
  it("rejects a wrong secret", () => {
    expect(devLoginSecretMatches("nope", e)).toBe(false);
  });
  it("rejects when no secret is configured", () => {
    expect(devLoginSecretMatches("anything", env({}))).toBe(false);
  });
  it("rejects a null/empty presented secret", () => {
    expect(devLoginSecretMatches(null, e)).toBe(false);
    expect(devLoginSecretMatches("", e)).toBe(false);
  });
  it("safeEqual is length-safe and correct", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});

describe("resolveDevLoginEmail (no arbitrary email escalation)", () => {
  it("defaults to the Super Admin identity when none requested", () => {
    expect(resolveDevLoginEmail(undefined, env({}))).toBe(DEV_LOGIN_DEFAULT_EMAIL);
    expect(resolveDevLoginEmail("", env({}))).toBe(DEV_LOGIN_DEFAULT_EMAIL);
  });
  it("allows the seeded staging identities (case-insensitive, casing preserved)", () => {
    expect(resolveDevLoginEmail("dr.test.a@drfact.staging", env({}))).toBe(
      "dr.test.a@drfact.staging",
    );
    expect(resolveDevLoginEmail("ADMIN.QA@DRFACT.STAGING", env({}))).toBe(
      "ADMIN.QA@DRFACT.STAGING",
    );
  });
  it("refuses an arbitrary (non-allowlisted) email", () => {
    expect(resolveDevLoginEmail("attacker@evil.com", env({}))).toBeNull();
    expect(resolveDevLoginEmail("someone-else@gmail.com", env({}))).toBeNull();
  });
  it("honours a DEV_LOGIN_ALLOWED_EMAILS override and nothing outside it", () => {
    const e = env({ DEV_LOGIN_ALLOWED_EMAILS: "only@allow.com, second@allow.com" });
    expect(resolveDevLoginEmail("only@allow.com", e)).toBe("only@allow.com");
    expect(resolveDevLoginEmail("second@allow.com", e)).toBe("second@allow.com");
    // Default identity is NOT implicitly allowed once an override is set.
    expect(resolveDevLoginEmail(undefined, e)).toBeNull();
    expect(resolveDevLoginEmail(DEV_LOGIN_DEFAULT_EMAIL, e)).toBeNull();
  });
  it("rejects non-string input", () => {
    expect(resolveDevLoginEmail(42, env({}))).toBeNull();
    expect(resolveDevLoginEmail({ email: "x" }, env({}))).toBeNull();
  });
});

describe("headline guarantee: production is never a usable bypass", () => {
  it("refuses end-to-end even with the flag set and the correct secret", () => {
    const prod = env({
      VERCEL_ENV: "production",
      ALLOW_DEV_LOGIN: "1",
      DEV_LOGIN_SECRET: "s3cr3t",
    });
    expect(isDevLoginForbidden(prod)).toBe(true);
    expect(isDevLoginEnabled(prod)).toBe(false);
    // Even if a route forgot the forbidden-check, the enabled-gate alone blocks it.
  });
});
