"use client";

import { Menu } from "lucide-react";
import { SearchBox } from "@/components/ui/search-box";
import { LanguageSelector } from "@/components/ui/language-selector";
import { NotificationCenter } from "./NotificationCenter";
import { UserMenu } from "./UserMenu";
import { Breadcrumbs } from "./Breadcrumbs";
import { useT } from "@/lib/i18n";
import { useState } from "react";

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
  const t = useT();
  const [q, setQ] = useState("");

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

        {greetingName && (
          <div className="hidden sm:flex flex-col leading-tight pr-3 border-r border-border mr-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground truncate max-w-[16rem]">
              {roleLabel}
            </span>
            <span className="text-sm font-semibold text-foreground truncate max-w-[14rem]">
              {`${t("shell.greetingHi")}, ${greetingName}`}
            </span>
          </div>
        )}

        <div className="flex-1 max-w-md">
          <SearchBox
            value={q}
            onChange={setQ}
            placeholder={t("shell.searchPlaceholder")}
          />
        </div>

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
