"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n";
import { useBranding } from "@/lib/branding";
import { NAV_ICONS, type NavSection } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { ClinicHeader } from "@/components/ui/clinic-header";
import { Avatar } from "@/components/ui/avatar";

// Sidebar — desktop persistent rail, mobile collapsed off-canvas. The
// AppShell controls the open/close state; this is pure presentation.

export function Sidebar({
  sections,
  open,
  onClose,
  badges,
  productLabel,
}: {
  sections: NavSection[];
  open: boolean;
  onClose: () => void;
  badges?: Partial<Record<string, number>>;
  // Product/brand chip. Omitted -> uses the i18n appName (legacy default).
  productLabel?: string;
}) {
  const pathname = usePathname();
  const t = useT();
  const b = useBranding();

  return (
    <>
      {open && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={onClose}
          aria-label="Close sidebar"
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-transform duration-200 ease-out md:translate-x-0 md:static md:z-auto",
          open ? "translate-x-0" : "-translate-x-full",
        )}
        aria-label="Primary"
      >
        <div className="px-4 py-4 border-b border-sidebar-border">
          {b.clinicId !== "__platform__" ? (
            <ClinicHeader />
          ) : (
            <div className="flex items-center gap-2">
              <Avatar name="HairOS" size="sm" />
              <span className="text-sm font-semibold">{t("common.appName")}</span>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
          {sections.map((section, i) => (
            <div key={i}>
              {section.labelKey && (
                <div className="px-3 pb-1.5 text-[11px] uppercase tracking-wide text-sidebar-foreground/60">
                  {t(section.labelKey)}
                </div>
              )}
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = NAV_ICONS[item.icon];
                  const active =
                    pathname === item.href ||
                    pathname.startsWith(item.href + "/");
                  const badge = item.badgeChannel
                    ? badges?.[item.badgeChannel]
                    : undefined;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onClose}
                        className={cn(
                          "group flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                          active
                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                            : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                        )}
                      >
                        <Icon className="size-4 shrink-0" />
                        <span className="flex-1 truncate">{t(item.labelKey)}</span>
                        {badge != null && badge > 0 && (
                          <span className="rounded-full bg-sidebar-primary text-sidebar-primary-foreground text-[10px] px-1.5 py-0.5 tabular-nums">
                            {badge}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="px-4 py-3 border-t border-sidebar-border text-[11px] text-sidebar-foreground/60">
          {productLabel ?? t("common.appName")} · v1
        </div>
      </aside>
    </>
  );
}
