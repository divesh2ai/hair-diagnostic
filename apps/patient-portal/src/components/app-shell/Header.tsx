"use client";

import { Menu } from "lucide-react";
import { LanguageSelector } from "@/components/ui/language-selector";
import { NotificationCenter } from "./NotificationCenter";
import { UserMenu } from "./UserMenu";
import { Breadcrumbs } from "./Breadcrumbs";

export function Header({
  onMenuClick,
  email,
  displayName,
  greetingName,
  roleLabel,
  unreadNotifications,
}: {
  onMenuClick: () => void;
  email: string | null;
  displayName?: string | null;
  greetingName?: string | null;
  roleLabel: string;
  unreadNotifications?: number;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="flex items-center gap-3 px-3 sm:px-5 h-14">
        <button
          type="button"
          onClick={onMenuClick}
          className="md:hidden inline-flex size-8 items-center justify-center rounded-md hover:bg-muted text-muted-foreground"
          aria-label="Open menu"
        >
          <Menu className="size-4" />
        </button>

        {/* Clinic / role context only — the warm, dated greeting lives once,
            on the dashboard hero, so the top bar does not greet a second time. */}
        {greetingName && (
          <div className="hidden sm:block pr-3 border-r border-border mr-1">
            <span className="block max-w-[20rem] truncate text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {roleLabel}
            </span>
          </div>
        )}

        <div className="flex-1" />

        <div className="ml-auto flex items-center gap-1.5">
          <LanguageSelector />
          <NotificationCenter unread={unreadNotifications} />
          <UserMenu
            email={email}
            displayName={displayName ?? null}
            roleLabel={roleLabel}
          />
        </div>
      </div>
      <div className="px-3 sm:px-5 pb-2">
        <Breadcrumbs />
      </div>
    </header>
  );
}
