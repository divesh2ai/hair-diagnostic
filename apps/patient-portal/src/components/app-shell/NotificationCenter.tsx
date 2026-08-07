"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, Loader2 } from "lucide-react";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/states";
import { useT } from "@/lib/i18n";

// Notification bell backed by /api/notifications (recent AuditLog entries
// scoped to the caller's clinic; super-admin sees platform-wide).

type Item = {
  id: string;
  title: string;
  subtitle: string;
  href: string | null;
  actor: string;
  createdAt: string;
};

export function NotificationCenter({ unread }: { unread?: number }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [seenCount, setSeenCount] = useState(0);
  const t = useT();

  // Deferred fetch: only hit the API when the drawer actually opens.
  // Every-page-load fetch was adding ~200-600ms to page navigation.
  useEffect(() => {
    if (!open || items !== null) return;
    setLoading(true);
    fetch("/api/notifications")
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data) => setItems(data.items ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [open, items]);

  const badge = Math.max(0, (items?.length ?? unread ?? 0) - seenCount);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setSeenCount(items?.length ?? 0);
        }}
        className="relative inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
        aria-label={t("common.notifications")}
      >
        <Bell className="size-4" />
        {badge > 0 && (
          <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-4 h-4 px-1 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] tabular-nums">
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent title={t("common.notifications")}>
          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
            </div>
          ) : !items || items.length === 0 ? (
            <EmptyState title={t("shell.notificationsEmpty")} />
          ) : (
            <ul className="divide-y divide-border">
              {items.map((n) => {
                const body = (
                  <>
                    <p className="text-sm font-medium text-foreground">{n.title}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {n.subtitle} · {relTime(n.createdAt)}
                    </p>
                  </>
                );
                return (
                  <li key={n.id} className="py-2.5">
                    {n.href ? (
                      <Link
                        href={n.href}
                        className="block rounded-md px-2 hover:bg-muted"
                        onClick={() => setOpen(false)}
                      >
                        {body}
                      </Link>
                    ) : (
                      <div className="px-2">{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </DrawerContent>
      </Drawer>
    </>
  );
}

function relTime(iso: string): string {
  const d = new Date(iso).getTime();
  const diffMs = Date.now() - d;
  const m = Math.round(diffMs / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  return `${days}d ago`;
}
