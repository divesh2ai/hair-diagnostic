"use client";

import { Menu } from "lucide-react";
import { LanguageSelector } from "@/components/ui/language-selector";
import { NotificationCenter } from "./NotificationCenter";
import { UserMenu } from "./UserMenu";
import { Breadcrumbs } from "./Breadcrumbs";

// A persistent, server-derived marker of which environment (and therefore
// which database) this console is pointed at. It is NOT a toggle: the value is
// resolved on the server from DATABASE_URL and handed down, so the browser can
// never flip it and it can never disagree with the data behind the page.
export type EnvironmentIndicator = {
  label: "PRODUCTION" | "STAGING" | "LOCAL" | "UNKNOWN";
  ref: string | null;
  split: boolean;
};

function EnvironmentBadge({ env }: { env: EnvironmentIndicator }) {
  // Production is the one that must shout; staging is the everyday state and is
  // calm but unmistakable; local/unknown stay muted. Colour is never the only
  // signal — the word is always present.
  const tone =
    env.label === "PRODUCTION"
      ? "border-rose-300 bg-rose-50 text-rose-700"
      : env.label === "STAGING"
        ? "border-amber-300 bg-amber-50 text-amber-800"
        : "border-border bg-muted/50 text-muted-foreground";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${tone}`}
      title={
        env.split
          ? `Misconfigured: env points at more than one Supabase project (${env.ref ?? "?"})`
          : `Data target: ${env.ref ?? "local database"}`
      }
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current opacity-80" />
      {env.label}
      {env.split && <span className="font-bold">⚠ SPLIT</span>}
    </span>
  );
}

export function Header({
  onMenuClick,
  email,
  displayName,
  greetingName,
  roleLabel,
  unreadNotifications,
  environment,
}: {
  onMenuClick: () => void;
  email: string | null;
  displayName?: string | null;
  greetingName?: string | null;
  roleLabel: string;
  unreadNotifications?: number;
  environment?: EnvironmentIndicator | null;
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

        {environment && <EnvironmentBadge env={environment} />}

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
