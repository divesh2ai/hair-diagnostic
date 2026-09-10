"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Secondary tabs inside the Kit Orders area. The doctor sidebar is flat (one
// link per top-level route), so the split between the operational order list
// and the clinic-level reporting view lives here as an in-page tab strip rather
// than a second sidebar item.

const TABS = [
  { href: "/doctor/orders", label: "Orders" },
  { href: "/doctor/orders/summary", label: "Patient order summary" },
] as const;

export function OrderTabs() {
  const pathname = usePathname();
  return (
    <div
      role="tablist"
      aria-label="Kit orders views"
      className="flex items-center gap-1 border-b border-[color:var(--hd-border)]"
    >
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            role="tab"
            aria-selected={active}
            className={
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors " +
              (active
                ? "border-[color:var(--hd-primary)] text-[color:var(--hd-text)]"
                : "border-transparent text-[color:var(--hd-text-muted)] hover:text-[color:var(--hd-text)]")
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
