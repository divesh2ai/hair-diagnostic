// Pins the doctor email login to a NUMERIC OTP, with no magic-link dependency.
//
// The distinction is invisible in the app code — `signInWithOtp({ email })`
// sends whichever the Supabase Auth email template renders. It sends a code
// when the template uses `{{ .Token }}` and a link when it uses
// `{{ .ConfirmationURL }}`. What the CLIENT controls is:
//
//   * verifying with `verifyOtp({ email, token, type: "email" })` — the
//     code-entry path, not `exchangeCodeForSession`; and
//   * NOT passing `emailRedirectTo`, which is what makes Supabase treat the
//     send as a redirect-based magic link.
//
// Both are easy to undo by accident (adding `emailRedirectTo` to "fix" a
// redirect bug quietly reintroduces the link dependency), so they are asserted
// here against the source rather than left to review.
//
// This is a source-shape assertion on purpose: the behaviour lives in a client
// component whose value is exactly which Supabase call it makes.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const LOGIN_PAGE = join(
  __dirname,
  "../../apps/patient-portal/src/app/login/page.tsx",
);

const source = readFileSync(LOGIN_PAGE, "utf8");

/** The email half of the login page, excluding the separate phone/SMS flow. */
function emailFlowSource(): string {
  const start = source.indexOf("const sendCode");
  const end = source.indexOf("const reset =");
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe("doctor email login", () => {
  it("verifies a typed numeric code via verifyOtp type 'email'", () => {
    const flow = emailFlowSource();
    expect(flow).toContain("verifyOtp");
    expect(flow).toMatch(/type:\s*"email"/);
    // The token comes from the code the doctor typed, not from a URL param.
    expect(flow).toMatch(/token:\s*code\.trim\(\)/);
  });

  it("sends the code with signInWithOtp and no magic-link redirect", () => {
    const flow = emailFlowSource();
    expect(flow).toContain("signInWithOtp");
    // `emailRedirectTo` is what turns the send into a redirect-based magic
    // link. Its absence is the property under test.
    expect(flow).not.toContain("emailRedirectTo");
  });

  it("does not exchange a code for a session on the email path", () => {
    // exchangeCodeForSession belongs to the magic-link callback route, which
    // stays as an independent fallback — the login page must not depend on it.
    expect(emailFlowSource()).not.toContain("exchangeCodeForSession");
  });

  it("preserves the existing shouldCreateUser behaviour", () => {
    // Deliberately pinned rather than changed: an unregistered email that
    // creates a Supabase user still cannot reach the dashboard, because
    // requireDoctorContext returns 403 no_doctor_membership without a linked
    // Doctor row. Flipping this would break first-time invited doctors.
    expect(emailFlowSource()).toMatch(/shouldCreateUser:\s*true/);
  });
});
