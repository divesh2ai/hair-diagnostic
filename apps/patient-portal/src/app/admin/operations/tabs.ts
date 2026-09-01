// Shared tab contract for Operations.
//
// Deliberately its own module with NO "use client": the server component
// resolves the active tab from `searchParams` and the client workspace renders
// it, so the type and the guard must be importable from both sides. Exporting
// them from the client component made the server unable to call them at all.

export const OPERATIONS_TABS = [
  "overview",
  "assessments",
  "orders",
  "fulfilment",
] as const;

export type TabId = (typeof OPERATIONS_TABS)[number];

export function isTab(value: string | null | undefined): value is TabId {
  return !!value && (OPERATIONS_TABS as readonly string[]).includes(value);
}

/** Tab state lives in the URL so a view is shareable and Back behaves. */
export function hrefFor(tab: TabId): string {
  return tab === "overview"
    ? "/admin/operations"
    : `/admin/operations?tab=${tab}`;
}
