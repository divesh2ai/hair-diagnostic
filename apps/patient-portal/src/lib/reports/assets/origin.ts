// The deployment's own origin, as the render worker must compute it.
//
// ── Why this is not taken from the request ──────────────────────────────────
// The old renderer read `x-forwarded-host` off the doctor's request, which is
// correct for building a link a HUMAN will click and wrong for choosing a
// destination a BROWSER will fetch. A background worker has no request to read
// anyway: it may be woken by a cron with no user in sight, so the origin has
// to be a property of the deployment rather than of whoever last pressed a
// button.
//
// Order of preference is deliberate. An explicitly configured origin beats a
// platform-provided one, because on Vercel the platform value is the immutable
// per-deployment hostname — correct, but not the domain the clinic uses.

export type OriginSource = "configured" | "vercel_production" | "vercel_deployment" | "local";

export interface ResolvedOrigin {
  origin: string;
  source: OriginSource;
}

export function resolveDeploymentOrigin(): ResolvedOrigin | null {
  const configured = process.env.RENDER_ORIGIN ?? process.env.NEXT_PUBLIC_APP_URL;
  if (configured) {
    const normalised = normalise(configured);
    if (normalised) return { origin: normalised, source: "configured" };
  }

  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (production) {
    const normalised = normalise(`https://${production}`);
    if (normalised) return { origin: normalised, source: "vercel_production" };
  }

  const deployment = process.env.VERCEL_URL;
  if (deployment) {
    const normalised = normalise(`https://${deployment}`);
    if (normalised) return { origin: normalised, source: "vercel_deployment" };
  }

  if (process.env.NODE_ENV !== "production") {
    const port = process.env.PORT ?? "4000";
    return { origin: `http://localhost:${port}`, source: "local" };
  }

  return null;
}

/** Strip everything but scheme + host, so nothing downstream inherits a path. */
function normalise(raw: string): string | null {
  try {
    const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}
