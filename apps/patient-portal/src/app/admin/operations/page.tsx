import OperationsWorkspace from "./OperationsWorkspace";
import { isTab, type TabId } from "./tabs";

export const dynamic = "force-dynamic";

// Operations — the single operational workspace.
//
// A server component whose only job is to resolve the active tab from the URL
// and hand it to the client workspace. Reading `searchParams` here rather than
// with `useSearchParams()` in the client keeps the route out of the Suspense
// dance that hook requires, which is what previously left this page stuck on
// its loading state.
export default async function OperationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  // An unrecognised ?tab= falls back to Overview rather than rendering nothing.
  const active: TabId = isTab(tab) ? tab : "overview";
  return <OperationsWorkspace tab={active} />;
}
