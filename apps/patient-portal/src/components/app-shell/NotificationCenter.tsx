"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/states";
import { useT } from "@/lib/i18n";

// Placeholder Notification Center. Drawer-style so Sprint 2 can drop in the
// real feed without changing layout. Bell shows an unread dot when count>0.
//
// Wiring contract for Sprint 2: pass `notifications` + `unreadCount` props;
// internal renderer becomes a real list. Caller already has the channel
// from the existing `NotificationChannel` enum.

export function NotificationCenter({ unread = 0 }: { unread?: number }) {
  const [open, setOpen] = useState(false);
  const t = useT();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
        aria-label={t("common.notifications")}
      >
        <Bell className="size-4" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-4 h-4 px-1 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] tabular-nums">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent title={t("common.notifications")}>
          {unread === 0 ? (
            <EmptyState title={t("shell.notificationsEmpty")} />
          ) : (
            <div className="text-sm text-muted-foreground">
              {/* Sprint 2: notification list. */}
            </div>
          )}
        </DrawerContent>
      </Drawer>
    </>
  );
}
