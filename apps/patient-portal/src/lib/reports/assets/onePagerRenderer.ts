// Turning an approved one-pager into PNG bytes.
//
// This module knows about a browser and a page. It does not know what a
// ConsultationVersion is, where bytes get stored, or what happens when it
// fails — those are the render service's concerns. The boundary exists so the
// clinical pipeline can be reasoned about without Chromium in the picture, and
// so a second artefact type later is a second implementation of one interface
// rather than a second copy of everything.

import {
  ONE_PAGER_READY_ATTRIBUTE,
  ONE_PAGER_ROOT_SELECTOR,
  ONE_PAGER_VIEWPORT,
  RENDER_TIMEOUT_MS,
  RenderError,
} from "./contract";
import { createRendererBrowser, type BrowserEnvironment } from "./browser";
import { renderTargetHref } from "./renderToken";

export interface RenderInput {
  /**
   * The deployment's OWN origin, derived server-side. Never a value that
   * reached the process from a request body, a query string or a database
   * column: the browser this drives would fetch whatever it is given, and an
   * attacker-chosen origin turns a report renderer into a request forgery
   * primitive with a service-role key in the same process.
   */
  origin: string;
  /** The short-lived token naming the ONE artefact being rendered. */
  token: string;
  timeoutMs?: number;
}

export interface RenderResult {
  bytes: Uint8Array;
  mimeType: "image/png";
  environment: BrowserEnvironment;
  timings: {
    launchMs: number;
    navigateMs: number;
    readyMs: number;
    captureMs: number;
    totalMs: number;
  };
}

export interface OnePagerRenderer {
  render(input: RenderInput): Promise<RenderResult>;
}

/**
 * Origins this process will point a browser at.
 *
 * Only ever its own. Enforced here as well as at the call site because this is
 * the last point before a URL is handed to a browser, and a check that only
 * exists at the caller is a check a future caller can forget.
 */
function assertSelfOrigin(origin: string): URL {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    throw new RenderError("AUTH_FAILED", "Render origin is not a URL");
  }
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new RenderError("AUTH_FAILED", "Render origin must be https, or localhost in development");
  }
  if (url.pathname !== "/" || url.search || url.hash) {
    throw new RenderError("AUTH_FAILED", "Render origin must be a bare origin");
  }
  return url;
}

export function createOnePagerRenderer(): OnePagerRenderer {
  return {
    async render(input: RenderInput): Promise<RenderResult> {
      const startedAt = Date.now();
      const timeout = input.timeoutMs ?? RENDER_TIMEOUT_MS;
      const origin = assertSelfOrigin(input.origin);
      const target = new URL(renderTargetHref(input.token), origin).toString();

      const { browser, environment, launchMs } = await createRendererBrowser();

      // Everything below is inside try/finally: a browser process that
      // outlives its render is a leaked container, and on a serverless
      // instance that is a leaked container per invocation.
      try {
        const context = await browser.newContext({
          viewport: { ...ONE_PAGER_VIEWPORT },
          deviceScaleFactor: 2,
          // Vercel Deployment Protection sits in front of Preview deployments
          // and would answer the browser with a login page rather than the
          // report. The platform's own bypass header is the supported way
          // through it for automation, and it is read from the environment
          // here rather than accepted as an input — a renderer that let a
          // caller choose its headers is a renderer that can be pointed at
          // somebody else's protected deployment.
          ...(process.env.VERCEL_AUTOMATION_BYPASS_SECRET
            ? {
                extraHTTPHeaders: {
                  "x-vercel-protection-bypass": process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
                  "x-vercel-set-bypass-cookie": "false",
                },
              }
            : {}),
          // The report is a print artefact. Rendering it in screen media would
          // produce a picture of the web page rather than of the sheet.
          colorScheme: "light",
          reducedMotion: "reduce",
        });
        const page = await context.newPage();
        await page.emulateMedia({ media: "print" });

        // ── Navigate ──────────────────────────────────────────────────────
        //
        // `load`, not `networkidle`. Next's dev server holds an HMR WebSocket
        // open forever, so `networkidle` never fires locally — and a wait
        // condition that behaves differently in development than in production
        // is a wait condition that will be debugged in production.
        const navigateStart = Date.now();
        const response = await page.goto(target, { waitUntil: "load", timeout });
        const navigateMs = Date.now() - navigateStart;

        // A 401/403 here means the render token was refused. That is an
        // authorisation invariant, not a flake, so it must not be retried.
        const status = response?.status() ?? 0;
        if (status === 401 || status === 403) {
          throw new RenderError("AUTH_FAILED", `Render target refused the token (${status})`);
        }
        if (status === 404) {
          throw new RenderError("SNAPSHOT_INVALID", "Render target has nothing to render (404)");
        }
        if (status >= 500) {
          throw new RenderError("REPORT_NOT_READY", `Render target answered ${status}`);
        }

        // ── Readiness (PHASE 9) ───────────────────────────────────────────
        //
        // The page asserts when it is finished. Not a fixed sleep, which is a
        // guess that is either too short on a cold instance or wasted on a
        // warm one, and which fails silently in exactly the case that matters:
        // a slow render producing a half-drawn sheet that screenshots fine.
        const readyStart = Date.now();
        try {
          await page.waitForSelector(`[${ONE_PAGER_READY_ATTRIBUTE}="true"]`, { timeout });
        } catch (err) {
          throw new RenderError(
            "REPORT_NOT_READY",
            `Report never signalled ${ONE_PAGER_READY_ATTRIBUTE}`,
            err,
          );
        }

        // Fonts settle independently of the readiness marker: the marker says
        // the DOM is complete, `document.fonts.ready` says the text will be
        // drawn in the faces the sheet was designed for. Capturing between the
        // two produces a correct report in the wrong typeface.
        await page.evaluate(async () => {
          await document.fonts?.ready;
          await Promise.all(
            Array.from(document.images).map((img) => {
              if (img.complete && img.naturalWidth > 0) return Promise.resolve();
              return img.decode?.().catch(() => undefined) ?? Promise.resolve();
            }),
          );
        });
        // One animation frame, so a layout invalidated by the last font swap
        // has been flushed before the capture.
        await page.evaluate(
          () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
        );
        const readyMs = Date.now() - readyStart;

        // ── Capture ───────────────────────────────────────────────────────
        const captureStart = Date.now();
        const root = page.locator(ONE_PAGER_ROOT_SELECTOR);
        if ((await root.count()) === 0) {
          throw new RenderError("SNAPSHOT_INVALID", "Report root element was not rendered");
        }
        const buffer = await root.first().screenshot({ type: "png", timeout });
        const captureMs = Date.now() - captureStart;

        return {
          bytes: new Uint8Array(buffer),
          mimeType: "image/png",
          environment,
          timings: {
            launchMs,
            navigateMs,
            readyMs,
            captureMs,
            totalMs: Date.now() - startedAt,
          },
        };
      } finally {
        await browser.close().catch(() => undefined);
      }
    },
  };
}
