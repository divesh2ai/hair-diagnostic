import { notFound } from "next/navigation";
import { HarnessClient } from "./HarnessClient";

// TEST-ONLY visual-acceptance harness for the doctor dashboard.
//
// This route renders the real dashboard components with fixture props so the
// UI can be screenshotted without a Supabase connection or an authenticated
// session. It is NOT a production route: it 404s unless VISUAL_HARNESS=1 is set
// in the environment (only the local screenshot run sets it). No auth is
// bypassed — the page reads no session and exposes no data.
export const dynamic = "force-dynamic";

export default async function VisualHarnessPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.VISUAL_HARNESS !== "1") notFound();

  const sp = await searchParams;
  const active = typeof sp.active === "string" ? sp.active : undefined;

  return <HarnessClient activePath={active} />;
}
