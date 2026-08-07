import { NextResponse } from "next/server";
import { loadOnePageReportData, ReportAccessError } from "@/lib/reports/one-page/loadReport";

type RenderKind = "pdf" | "png";

// Landscape A4 @ 96dpi. Retiring portrait 2026-08-03 — the production
// one-pager is landscape-only. The multi-page dossier keeps its own
// renderer if/when needed.
const A4_VIEWPORT = { width: 1123, height: 794 };

type BrowserPage = {
  evaluate<T>(fn: () => T | Promise<T>): Promise<T>;
};

type ChromiumLauncher = {
  launch(options: { headless: boolean }): Promise<{
    newContext(options: {
      viewport: typeof A4_VIEWPORT;
      deviceScaleFactor: number;
      extraHTTPHeaders: Record<string, string>;
    }): Promise<{
      newPage(): Promise<BrowserRuntimePage>;
    }>;
    close(): Promise<void>;
  }>;
};

type BrowserRuntimePage = BrowserPage & {
  emulateMedia(options: { media: "print" }): Promise<void>;
  goto(url: string, options: { waitUntil: "load" | "networkidle"; timeout: number }): Promise<void>;
  waitForSelector(selector: string, options: { timeout: number }): Promise<void>;
  pdf(options: {
    format: "A4";
    landscape?: boolean;
    printBackground: boolean;
    margin: { top: string; right: string; bottom: string; left: string };
    preferCSSPageSize: boolean;
    pageRanges?: string;
  }): Promise<BodyInit>;
  locator(selector: string): { screenshot(options: { type: "png" }): Promise<BodyInit> };
};

function originFromRequest(req: Request): string {
  const url = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "") ?? "http";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? url.host;
  return `${proto}://${host}`;
}

async function assertRenderablePage(page: BrowserPage) {
  const result = await page.evaluate(() => {
    const pageEl = document.querySelector("[data-one-page-report]") as HTMLElement | null;
    if (!pageEl) return { ok: false, errors: ["Report root was not rendered."] };
    const errors: string[] = [];
    if (pageEl.scrollHeight > pageEl.clientHeight + 1) {
      errors.push(`A4 page vertical overflow: ${pageEl.scrollHeight}px > ${pageEl.clientHeight}px`);
    }
    if (pageEl.scrollWidth > pageEl.clientWidth + 1) {
      errors.push(`A4 page horizontal overflow: ${pageEl.scrollWidth}px > ${pageEl.clientWidth}px`);
    }
    const overflowing = Array.from(pageEl.querySelectorAll<HTMLElement>("*"))
      .filter((el) => {
        const style = window.getComputedStyle(el);
        const clipsY = style.overflowY !== "visible";
        const clipsX = style.overflowX !== "visible";
        const managedText = style.textOverflow === "ellipsis" || style.webkitLineClamp !== "none";
        const managedMedia = el.querySelector("img, svg") && style.overflow !== "visible";
        if (managedText || managedMedia) return false;
        return (clipsY && el.scrollHeight > el.clientHeight + 2) || (clipsX && el.scrollWidth > el.clientWidth + 2);
      })
      .slice(0, 8)
      .map((el) => el.className || el.tagName.toLowerCase());
    if (overflowing.length > 0) {
      errors.push(`Text or content overflow detected in: ${overflowing.join(", ")}`);
    }
    return { ok: errors.length === 0, errors };
  });

  if (!result.ok) {
    throw new Error(result.errors.join("; "));
  }
}

export async function renderOnePageReport(
  req: Request,
  assessmentId: string,
  kind: RenderKind,
): Promise<Response> {
  const reviewToken = new URL(req.url).searchParams.get("t");

  let data: Awaited<ReturnType<typeof loadOnePageReportData>>;
  try {
    data = await loadOnePageReportData(assessmentId, { reviewToken });
  } catch (err) {
    // A ReportAccessError carries the status the caller should actually see
    // (401 / 403 / 404 / 202). Letting it escape turned every one of those
    // into an opaque 500, which made an ordinary auth failure look like a
    // broken PDF renderer.
    if (err instanceof ReportAccessError) {
      return NextResponse.json(
        { error: err.status === 202 ? "report_not_ready" : "unauthorized", message: err.message },
        { status: err.status },
      );
    }
    throw err;
  }

  if (!data.validation.ok) {
    return NextResponse.json(
      { error: "one_page_validation_failed", details: data.validation.errors },
      { status: 422 },
    );
  }

  let chromium: ChromiumLauncher;
  try {
    const loadPlaywright = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<{ chromium: ChromiumLauncher }>;
    ({ chromium } = await loadPlaywright("playwright"));
  } catch {
    return NextResponse.json(
      { error: "playwright_missing", message: "Install playwright and browser binaries to enable PDF/PNG rendering." },
      { status: 501 },
    );
  }

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: A4_VIEWPORT,
      deviceScaleFactor: 1,
      extraHTTPHeaders: {
        cookie: req.headers.get("cookie") ?? "",
      },
    });
    const page = await context.newPage();
    await page.emulateMedia({ media: "print" });
    // `networkidle` hangs in Next.js dev because HMR keeps a WebSocket open,
    // so wait for `load` instead and then explicitly settle fonts + images
    // below. `load` is deterministic across dev and prod.
    // The headless page authenticates independently of this request, so the
    // conference token has to travel with it — the forwarded cookie alone is
    // empty for a token-authorised caller.
    const pageUrl = `${originFromRequest(req)}/reports/${assessmentId}/one-page${
      reviewToken ? `?t=${encodeURIComponent(reviewToken)}` : ""
    }`;
    await page.goto(pageUrl, {
      waitUntil: "load",
      timeout: 45_000,
    });
    await page.waitForSelector("[data-one-page-report]", { timeout: 20_000 });
    await page.evaluate(async () => {
      await document.fonts?.ready;
      await Promise.all(
        Array.from(document.images).map((img) => {
          if (img.complete && img.naturalWidth > 0) return Promise.resolve();
          return img.decode?.().catch(() => undefined) ?? Promise.resolve();
        }),
      );
    });
    // Layout preflight is a QA signal, not a hard blocker for the user's
    // download. Log server-side so we still learn about overflow, but keep
    // rendering the PDF — the doctor already reviewed the on-screen version.
    try {
      await assertRenderablePage(page);
    } catch (err) {
      console.warn(
        `[one-page-report] Layout preflight warning for ${assessmentId}:`,
        err instanceof Error ? err.message : err,
      );
    }

    const patientLabel = safePatientLabel(data.patient?.name) || assessmentId;
    const baseFilename = `${patientLabel} -1 pager`;

    if (kind === "pdf") {
      // The 289/270-page bug: even with `pageRanges: "1"` and the print
      // stylesheet clamp, Chromium's print engine still paginated a shell
      // taller than one A4. The only reliable fix is to hard-clip the DOM
      // to a single A4 page IN THE PAGE ITSELF right before we print —
      // Playwright's own options do not defend against oversized print
      // layouts strongly enough.
      await page.evaluate(() => {
        const html = document.documentElement;
        const body = document.body;
        for (const el of [html, body]) {
          el.style.width = "297mm";
          el.style.minHeight = "210mm";
          el.style.height = "210mm";
          el.style.maxHeight = "210mm";
          el.style.margin = "0";
          el.style.padding = "0";
          el.style.overflow = "hidden";
        }
        const shell = document.querySelector<HTMLElement>(".op-report-shell");
        if (shell) {
          shell.style.width = "297mm";
          shell.style.height = "210mm";
          shell.style.maxHeight = "210mm";
          shell.style.margin = "0";
          shell.style.padding = "0";
          shell.style.overflow = "hidden";
          shell.style.display = "block";
        }
        const pageEl = document.querySelector<HTMLElement>("[data-one-page-report]");
        if (pageEl) {
          pageEl.style.margin = "0";
          pageEl.style.width = "297mm";
          pageEl.style.height = "210mm";
          pageEl.style.maxHeight = "210mm";
          pageEl.style.overflow = "hidden";
        }
        // Remove anything that could inflate the print viewport.
        document
          .querySelectorAll(".op-actions-toolbar, .op-validation")
          .forEach((el) => el.remove());
      });
      // Downscale + JPEG-recompress every raster before printing. Chromium's
      // `page.pdf()` embeds images at source resolution as lossless PNG
      // (/FlateDecode) — kit packshots ship at 500×667 → 1000×771 but render
      // at 46–100 px on the sheet, which produced 5 MB+ PDFs dominated by
      // 22 oversized images. Rendering each image onto a canvas sized to
      // 2× its on-screen box and re-encoding as JPEG 0.85 typically cuts
      // the PDF from ~5 MB to under 1 MB while staying above the pixel
      // budget for A4 print at 200 dpi.
      await page.evaluate(async () => {
        const MAX_DPR = 2;
        const JPEG_QUALITY = 0.85;
        const imgs = Array.from(
          document.querySelectorAll<HTMLImageElement>("[data-one-page-report] img"),
        );
        const shrink = async (img: HTMLImageElement) => {
          try {
            if (!img.complete || img.naturalWidth === 0) {
              await img.decode?.().catch(() => undefined);
            }
            const nw = img.naturalWidth;
            const nh = img.naturalHeight;
            if (!nw || !nh) return;
            const box = img.getBoundingClientRect();
            const targetW = Math.max(1, Math.ceil(Math.min(nw, box.width * MAX_DPR)));
            const targetH = Math.max(1, Math.ceil(Math.min(nh, box.height * MAX_DPR)));
            if (targetW >= nw && targetH >= nh) return;
            const canvas = document.createElement("canvas");
            canvas.width = targetW;
            canvas.height = targetH;
            const ctx = canvas.getContext("2d");
            if (!ctx) return;
            ctx.imageSmoothingQuality = "high";
            // Fill white — JPEG has no alpha; transparent PNGs would otherwise
            // print as black.
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, targetW, targetH);
            ctx.drawImage(img, 0, 0, targetW, targetH);
            const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
            img.setAttribute("data-original-src", img.src);
            img.src = dataUrl;
            await img.decode?.().catch(() => undefined);
          } catch {
            // Fall through — keep the original image if anything fails so a
            // single problematic asset never breaks the whole download.
          }
        };
        await Promise.all(imgs.map(shrink));
      });
      const pdf = await page.pdf({
        format: "A4",
        landscape: true,
        printBackground: true,
        margin: { top: "0", right: "0", bottom: "0", left: "0" },
        preferCSSPageSize: true,
        pageRanges: "1",
      });
      return new Response(pdf, {
        headers: {
          "Content-Type": "application/pdf",
          "Cache-Control": "no-store",
          "Content-Disposition": contentDisposition(`${baseFilename}.pdf`),
        },
      });
    }

    const root = page.locator("[data-one-page-report]");
    const png = await root.screenshot({ type: "png" });
    return new Response(png, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
        "Content-Disposition": contentDisposition(`${baseFilename}.png`),
      },
    });
  } finally {
    await browser.close();
  }
}

// "Erica" — keeps spaces, drops path/quote chars that break header parsing
// or Windows/macOS filenames. If the patient has no usable name, callers
// fall back to the assessment id.
function safePatientLabel(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .replace(/[\\/:*?"<>|\r\n]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

// Provide a plain fallback for older clients and a UTF-8 filename* for
// modern browsers so accented names ("María -1 pager.pdf") round-trip.
function contentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "");
  const encoded = encodeURIComponent(filename);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}










