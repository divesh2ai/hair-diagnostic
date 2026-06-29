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
  roleLabel,
  onSignOut,
  unreadNotifications,
}: {
  onMenuClick: () => void;
  email: string | null;
  roleLabel: string;
  onSignOut: () => void | Promise<void>;
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
          <UserMenu email={email} roleLabel={roleLabel} onSignOut={onSignOut} />
        </div>
      </div>
      <div className="px-3 sm:px-5 pb-2">
        <Breadcrumbs />
      </div>
    </header>
  );
}
