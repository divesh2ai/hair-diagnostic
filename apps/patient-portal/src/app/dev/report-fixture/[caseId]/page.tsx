import { notFound } from "next/navigation";
import { OnePageHairReport } from "@/components/reports/one-page/OnePageHairReport";
import { ruchiFixture } from "@/lib/reports/one-page/fixtures/ruchi";
import { ruchiRuntimeFixture } from "@/lib/reports/one-page/fixtures/ruchi-runtime";
import { raviFixture } from "@/lib/reports/one-page/fixtures/ravi";
import { harshFixture } from "@/lib/reports/one-page/fixtures/harsh";
import { bhavnaFixture } from "@/lib/reports/one-page/fixtures/bhavna";
import { rahulFixture } from "@/lib/reports/one-page/fixtures/rahul";
import { janviFixture } from "@/lib/reports/one-page/fixtures/janvi";
import type { OnePageReportViewModel } from "@/lib/reports/one-page/viewModel";

/**
 * Dev-only preview route for the one-page report. Renders a typed fixture
 * so the CEO-approved Ruchi visual baseline can be verified end-to-end
 * (Playwright screenshot + PDF) without a live database or auth.
 *
 * Gated by NODE_ENV — the route 404s in production. A future prod-safe
 * variant would additionally require a signed ENABLE_REPORT_FIXTURES env
 * flag; for now the NODE_ENV gate is sufficient.
 */

export const dynamic = "force-dynamic";

const FIXTURES: Record<string, OnePageReportViewModel> = {
  // `ruchi` and `ravi` route through the runtime viewModel pipeline so the
  // design preview reflects every clinical-meaning / snapshot / narrative
  // rule the code layer enforces. `ruchi-legacy` keeps the original
  // hand-baked view model for pixel-baseline comparisons.
  ruchi: ruchiRuntimeFixture,
  "ruchi-legacy": ruchiFixture,
  ravi: raviFixture,
  bhavna: bhavnaFixture,
  harsh: harshFixture,
  rahul: rahulFixture,
  janvi: janviFixture,
};

export default async function ReportFixturePage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const { caseId } = await params;
  const data = FIXTURES[caseId];
  if (!data) notFound();
  return <OnePageHairReport data={data} />;
}
