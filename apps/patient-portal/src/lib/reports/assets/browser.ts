// The one place that knows how to obtain a Chromium.
//
// ── Why it is one place ─────────────────────────────────────────────────────
// The previous renderer decided this inline, with a dynamic import built out
// of `new Function("specifier", "return import(specifier)")`. That construct
// is opaque to Next's bundle tracing, so Vercel shipped a function that had
// never been told it needed a browser — and the failure surfaced, at runtime,
// as a 501 on a doctor's Share click. Scattering `if (process.env.VERCEL)`
// through the render path would be the same mistake with more branches.
//
// So: exactly one module imports playwright-core, exactly one module imports
// @sparticuz/chromium, and both imports are static and therefore traceable.
//
// ── Why playwright-core and not playwright ──────────────────────────────────
// `playwright` downloads browser binaries at install time. Vercel's install
// step does not run that download and could not ship the result inside a
// function bundle if it did. `playwright-core` is the driver alone; the
// binary comes from @sparticuz/chromium, which is packaged for exactly this.

import chromiumBinary from "@sparticuz/chromium";
import { chromium, type Browser } from "playwright-core";
import { RenderError } from "./contract";

export type BrowserEnvironment = "serverless" | "local";

/**
 * Which Chromium this process should launch.
 *
 * `VERCEL` is set on every Vercel runtime; `AWS_LAMBDA_FUNCTION_NAME` catches
 * the same container shape elsewhere. `RENDER_BROWSER_ENV` is an explicit
 * override, which exists so a local integration test can exercise the
 * serverless path deliberately rather than by accident.
 */
export function browserEnvironment(): BrowserEnvironment {
  const forced = process.env.RENDER_BROWSER_ENV;
  if (forced === "serverless" || forced === "local") return forced;
  if (process.env.VERCEL === "1" || process.env.AWS_LAMBDA_FUNCTION_NAME) return "serverless";
  return "local";
}

export interface LaunchedBrowser {
  browser: Browser;
  environment: BrowserEnvironment;
  /** Milliseconds spent launching. Reported as a metric, not logged per-render. */
  launchMs: number;
}

/**
 * Launch a browser suitable for rendering a clinical artefact.
 *
 * Throws a classified BROWSER_LAUNCH_FAILED rather than a raw Playwright
 * error, because the retry policy reads the classification and an operator
 * reads the code. The caller MUST close the browser in a `finally`.
 */
export async function createRendererBrowser(): Promise<LaunchedBrowser> {
  const environment = browserEnvironment();
  const startedAt = Date.now();

  try {
    const browser =
      environment === "serverless" ? await launchServerless() : await launchLocal();
    return { browser, environment, launchMs: Date.now() - startedAt };
  } catch (err) {
    throw new RenderError(
      "BROWSER_LAUNCH_FAILED",
      `Could not launch Chromium (${environment}): ${
        err instanceof Error ? err.message : String(err)
      }`,
      err,
    );
  }
}

/**
 * Serverless: the binary @sparticuz/chromium unpacks into /tmp, with the
 * argument set it publishes for that environment.
 *
 * The args are taken from the package rather than hand-written. They encode
 * the constraints of a read-only, single-CPU, small-/dev/shm container, and a
 * hand-maintained copy of that list is a list that goes stale silently.
 */
async function launchServerless(): Promise<Browser> {
  // Fonts the container does not otherwise have. Without this a report renders
  // in a fallback face and the sheet is subtly wrong everywhere — which is a
  // rendering defect that passes every HTTP-200 check.
  chromiumBinary.setGraphicsMode = false;
  const executablePath = await chromiumBinary.executablePath();
  return chromium.launch({
    args: chromiumBinary.args,
    executablePath,
    headless: true,
  });
}

/**
 * Local: an installed browser, never a downloaded one.
 *
 * `RENDER_BROWSER_EXECUTABLE` wins when set. Otherwise playwright-core's
 * channel lookup finds a Chrome or Edge the developer already has, which is
 * true on every machine this repo is developed on and avoids making a browser
 * download a prerequisite of running the app.
 */
async function launchLocal(): Promise<Browser> {
  const executablePath = process.env.RENDER_BROWSER_EXECUTABLE;
  if (executablePath) {
    return chromium.launch({ executablePath, headless: true });
  }

  const channels = [process.env.RENDER_BROWSER_CHANNEL, "chrome", "msedge"].filter(
    (c): c is string => typeof c === "string" && c.length > 0,
  );

  let lastError: unknown;
  for (const channel of channels) {
    try {
      return await chromium.launch({ channel, headless: true });
    } catch (err) {
      lastError = err;
    }
  }
  // Last resort: a browser downloaded by a full `playwright` install, if the
  // developer happens to have one.
  try {
    return await chromium.launch({ headless: true });
  } catch {
    throw lastError ?? new Error("no local Chromium channel available");
  }
}
