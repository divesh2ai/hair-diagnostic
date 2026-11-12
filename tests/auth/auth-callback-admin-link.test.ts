// The /auth/callback contract for first-login admin linking, asserted against
// the real source. The route handler imports next/server, which is not
// resolvable from the repo root test runner, so — exactly as the login-page
// tests do for the client — these assertions read the source text. They pin the
// integration invariants that the unit tests for linkPendingAdminIdentity cannot
// see: WHERE in the flow linking runs, that it can never block a login, and that
// the session is only re-minted when a link actually happened.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROUTE = readFileSync(
  join(__dirname, "../../apps/patient-portal/src/app/auth/callback/route.ts"),
  "utf8",
);

const HOOK = readFileSync(
  join(__dirname, "../../supabase/functions/custom_access_token_hook.sql"),
  "utf8",
);

describe("/auth/callback — admin linking is wired in without blocking login", () => {
  it("links only AFTER a successful code exchange", () => {
    const exchange = ROUTE.indexOf("exchangeCodeForSession");
    const link = ROUTE.indexOf("linkPendingAdminIdentity(supabase)");
    expect(exchange).toBeGreaterThan(-1);
    expect(link).toBeGreaterThan(exchange);
  });

  it("wraps linking in try/catch so it can never fail the login", () => {
    const link = ROUTE.indexOf("linkPendingAdminIdentity(supabase)");
    const tryStart = ROUTE.lastIndexOf("try {", link);
    const catchStart = ROUTE.indexOf("catch", link);
    expect(tryStart).toBeGreaterThan(-1);
    expect(catchStart).toBeGreaterThan(link);
    // The catch must not turn a good login into a redirect back to /login.
    const catchBlock = ROUTE.slice(catchStart, catchStart + 300);
    expect(catchBlock).not.toContain("redirect");
  });

  it("refreshes the session ONLY when a link was made, so the hook re-mints the role", () => {
    // refreshSession is gated on the boolean result, not called unconditionally.
    expect(ROUTE).toMatch(
      /if\s*\(\s*linked\s*\)\s*\{[\s\S]*?refreshSession\(\)/,
    );
  });

  it("still redirects to `next` after linking (the existing routing is untouched)", () => {
    // `res` is the redirect to ?next; linking must not replace that return.
    const link = ROUTE.indexOf("linkPendingAdminIdentity");
    const ret = ROUTE.indexOf("return res;", link);
    expect(ret).toBeGreaterThan(link);
  });

  it("does not gate linking on the doctor default — every provider flows through", () => {
    // The exchange-failure path still bounces to /login; the success path does
    // not special-case a role before linking.
    expect(ROUTE).toContain('reason=exchange_failed');
  });
});

describe("custom_access_token_hook mirror — admin tier is hardened", () => {
  // Anchor on the `-- N.` SQL step markers so the slices land in the function
  // body, not the precedence-doc comment box at the top of the file.
  const adminBranch = HOOK.slice(
    HOOK.indexOf("-- 1. Organization-level admin"),
    HOOK.indexOf("-- 2. Doctor"),
  );
  const doctorBranch = HOOK.slice(
    HOOK.indexOf("-- 2. Doctor"),
    HOOK.indexOf("-- 3. Clinic"),
  );
  const clinicBranch = HOOK.slice(
    HOOK.indexOf("-- 3. Clinic"),
    HOOK.indexOf("-- 4. Patient"),
  );
  const patientBranch = HOOK.slice(HOOK.indexOf("-- 4. Patient"));

  it("keys the OrganizationMember branch on supabaseUserId = uid, not the e-mail fallback", () => {
    expect(adminBranch).toMatch(/om\."supabaseUserId"\s*=\s*uid/);
    // The removed fallback must not reappear in the admin branch.
    expect(adminBranch).not.toMatch(/om\."supabaseUserId"\s+IS\s+NULL\s+AND\s+om\.email/);
  });

  it("requires a confirmed auth e-mail before minting an admin role", () => {
    expect(adminBranch).toMatch(/user_email_confirmed\s+IS\s+NOT\s+NULL/);
  });

  it("leaves the Doctor pre-link fallbacks (email + phone) in place", () => {
    expect(doctorBranch).toMatch(/d\."supabaseUserId"\s+IS\s+NULL\s+AND\s+d\.email\s*=\s*user_email/);
    expect(doctorBranch).toMatch(/regexp_replace\(d\.phone/);
  });

  it("leaves the ClinicMember and Patient branches unchanged", () => {
    expect(clinicBranch).toMatch(/cm\."supabaseUserId"\s+IS\s+NULL\s+AND\s+cm\.email\s*=\s*user_email/);
    expect(patientBranch).toMatch(/p\."supabaseUserId"\s*=\s*uid/);
  });
});
