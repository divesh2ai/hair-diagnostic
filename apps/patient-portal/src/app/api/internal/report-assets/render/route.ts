// The render worker.
//
// ── What this endpoint is ───────────────────────────────────────────────────
// The only place a browser is ever launched. It claims due ReportAsset rows,
// renders them, stores the bytes privately and settles the row. It is reached
// two ways and both are the same code path:
//
//   POST  the doorbell rung after an approval, for latency.
//   GET   the scheduled sweep, for durability — see vercel.json's cron entry.
//
// Losing every POST costs seconds. Losing the GET costs a clinic its
// one-pagers until somebody notices, which is why the sweep is the thing that
// is actually depended upon and the POST is explicitly not.
//
// ── Why it is not open ──────────────────────────────────────────────────────
// It renders and stores clinical artefacts, so an unauthenticated caller could
// at minimum burn a clinic's compute and at worst use the browser as a
// request-forgery engine. Two accepted credentials, both server-side secrets,
// neither derived from a user session: a worker secret for the doorbell, and
// the platform's cron secret for the sweep.

import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { renderDueBatch } from "@/lib/reports/assets/renderService";
import { backfillMissingAssets } from "@/lib/reports/assets/jobService";
import { ReportAssetsNotProvisionedError } from "@/lib/reports/assets/repository";

export const dynamic = "force-dynamic";
// Chromium is a Node process. There is no Edge configuration under which this
// route could work, and an Edge deployment of it would fail at launch rather
// than at build — so it is pinned here.
export const runtime = "nodejs";
// A cold Chromium launch plus a page load plus an upload is tens of seconds.
// The default budget would kill the invocation mid-render, which is survivable
// (the lease expires and the row is reclaimed) and wasteful.
export const maxDuration = 60;

/** How many artefacts one invocation will attempt. */
const DEFAULT_LIMIT = 3;
const MAX_LIMIT = 5;

function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Who is allowed to run the worker.
 *
 * Returns the caller's label for the log line, or null. Both secrets are
 * compared in constant time: a length-and-prefix comparison on a shared secret
 * is a timing oracle, and this endpoint is reachable from the internet.
 */
function authorise(req: Request): "worker" | "cron" | null {
  const workerSecret = process.env.REPORT_RENDER_WORKER_SECRET;
  const presented = req.headers.get("x-render-worker-secret");
  if (workerSecret && presented && constantTimeEquals(presented, workerSecret)) {
    return "worker";
  }

  const cronSecret = process.env.CRON_SECRET;
  const authorization = req.headers.get("authorization");
  if (cronSecret && authorization?.startsWith("Bearer ")) {
    if (constantTimeEquals(authorization.slice(7), cronSecret)) return "cron";
  }

  return null;
}

async function run(limit: number, caller: "worker" | "cron") {
  const startedAt = Date.now();
  try {
    // The scheduled pass reconciles first. A doorbell has just been rung by an
    // approval that already wrote its row, so it has nothing to reconcile; the
    // sweep is the one that has to notice an approval whose row was never
    // written because the process died between the two.
    const backfill =
      caller === "cron" ? await backfillMissingAssets() : { scanned: 0, created: 0 };

    const outcomes = await renderDueBatch(limit);
    const summary = {
      caller,
      backfilled: backfill.created,
      attempted: outcomes.filter((o) => o.kind !== "idle").length,
      rendered: outcomes.filter((o) => o.kind === "rendered").length,
      failed: outcomes.filter((o) => o.kind === "failed").length,
      lost: outcomes.filter((o) => o.kind === "lost").length,
      durationMs: Date.now() - startedAt,
    };
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ ns: "report-asset", event: "worker.pass", ...summary }));
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    if (err instanceof ReportAssetsNotProvisionedError) {
      // Not an incident. The migration has not been applied, so there is no
      // queue to drain; the rest of the platform is unaffected and says so.
      return NextResponse.json(
        { ok: false, error: err.reason, message: err.message },
        { status: 503 },
      );
    }
    throw err;
  }
}

export async function POST(req: Request) {
  const caller = authorise(req);
  if (!caller) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { limit?: number };
  const requested = typeof body.limit === "number" ? body.limit : DEFAULT_LIMIT;
  const limit = Math.max(1, Math.min(MAX_LIMIT, Math.floor(requested)));

  return run(limit, caller);
}

export async function GET(req: Request) {
  const caller = authorise(req);
  if (!caller) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return run(DEFAULT_LIMIT, caller);
}
