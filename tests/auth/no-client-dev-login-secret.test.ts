import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

// Guard against re-introducing the client-bundled dev-login secret.
//
// The Preview "skip OTP" button used to read NEXT_PUBLIC_DEV_LOGIN_SECRET and
// post it to /api/dev/login. Anything in a NEXT_PUBLIC_* variable is inlined
// into the client JavaScript bundle, so that "secret" shipped to every browser
// and let anyone with the preview URL mint a Super Admin session. The secret
// must live only server-side. These tests fail if the public secret or the
// browser → dev-login call ever comes back.

const CLIENT_SRC = path.resolve(process.cwd(), "apps/patient-portal/src");
// Build the forbidden token at runtime so this very test file does not count as
// a source-level occurrence of it.
const PUBLIC_SECRET_VAR = ["NEXT_PUBLIC", "DEV_LOGIN", "SECRET"].join("_");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry)) out.push(full);
  }
  return out;
}

describe("no client-bundled dev-login secret", () => {
  const files = walk(CLIENT_SRC);

  it("scans a non-trivial number of client source files", () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it("no client source references the NEXT_PUBLIC dev-login secret", () => {
    const offenders = files.filter((f) => readFileSync(f, "utf8").includes(PUBLIC_SECRET_VAR));
    expect(offenders).toEqual([]);
  });

  it("the login page no longer calls the dev-login endpoint from the browser", () => {
    const login = readFileSync(
      path.join(CLIENT_SRC, "app/login/page.tsx"),
      "utf8",
    );
    expect(login).not.toContain("/api/dev/login");
    expect(login).not.toContain("x-dev-login-secret");
  });
});
