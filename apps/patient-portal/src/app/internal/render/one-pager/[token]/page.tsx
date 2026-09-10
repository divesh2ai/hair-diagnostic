// The page the render worker screenshots.
//
// ── Why a page and not an HTML string ───────────────────────────────────────
// The artefact a patient receives must be the sheet the clinic prints, not a
// second rendering of it. This route reuses `OnePageHairReport` and therefore
// the same CSS pipeline, the same fonts and the same layout rules as
// /reports/[assessmentId]/one-page. Assembling HTML by hand would fork the
// document, and the two would drift the first time somebody edited one.
//
// ── Why it is not a second way into a patient's record ──────────────────────
// Three properties, together:
//
//   1. The address IS the credential. The path carries a signed render token
//      and nothing else — no assessment id, no version, no clinic. There is
//      nowhere in the request to name a record, so no caller can ask for one.
//   2. The token names ONE ReportAsset for a few minutes. Everything else is
//      derived from that row.
//   3. `loadRenderSource` re-establishes, from the database, that the version
//      is APPROVED and that the row's tenant identifiers still agree with its
//      consultation. A token is not treated as standing permission.
//
// Every refusal is a 404. A 403 would confirm that the artefact exists, and
// the only caller that should ever reach this route already knows it does.

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { OnePageHairReport } from "@/components/reports/one-page/OnePageHairReport";
import { OnePagerReadyMarker } from "@/components/reports/one-page/OnePagerReadyMarker";
import { ONE_PAGER_READY_ATTRIBUTE } from "@/lib/reports/assets/contract";
import { verifyRenderToken } from "@/lib/reports/assets/renderToken";
import { loadRenderSource } from "@/lib/reports/assets/source";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Belt and braces. The route is unlisted and token-gated, but a clinical sheet
// should never be a candidate for indexing even in principle.
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export default async function InternalOnePagerRenderRoute({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const verified = verifyRenderToken(decodeURIComponent(token));
  if (!verified.ok) {
    // Logged as a code, never with the token. A render token is a credential,
    // and a credential in a log line is a credential in a log aggregator.
    console.warn(`[render-target] token refused: ${verified.error}`);
    notFound();
  }

  let source;
  try {
    source = await loadRenderSource(verified.assetId);
  } catch (err) {
    console.warn(
      `[render-target] source unavailable for asset ${verified.assetId}:`,
      err instanceof Error ? err.name : "unknown",
    );
    notFound();
  }

  // The token names an artefact; the row says which version it is a render of.
  // These are two independent statements and they must agree — a mismatch
  // means a token minted for one artefact is being presented against another.
  if (
    source.asset.consultationVersionId !== verified.consultationVersionId ||
    source.asset.type !== verified.type
  ) {
    console.warn("[render-target] token/asset mismatch — refusing");
    notFound();
  }

  return (
    <>
      <OnePageHairReport data={source.snapshot.report} />
      <OnePagerReadyMarker attribute={ONE_PAGER_READY_ATTRIBUTE} />
    </>
  );
}
