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
  variant = "default",
  activePath,
}: {
  sections: NavSection[];
  open: boolean;
  onClose: () => void;
  badges?: Partial<Record<string, number>>;
  // Product/brand chip. Omitted -> uses the i18n appName (legacy default).
  productLabel?: string;
  // "doctor" opts into the wider ivory lockup with botanical artwork.
  variant?: "default" | "doctor";
  // Override the path used to resolve the active item. Production omits it and
  // the live route (usePathname) decides; a visual-test harness can pass a
  // fixed path to render a given route as active without navigating. Pure
  // presentation — no behaviour change when omitted.
  activePath?: string;
}) {
  const pathname = usePathname();
  const currentPath = activePath ?? pathname;

  // Most-specific match wins: a nav item is active only when its href is the
  // LONGEST one that prefixes the current path. Without this, an index route
  // ("/doctor") stays active on every one of its sub-routes ("/doctor/queue",
  // …) and two items highlight at once. Computed once per render over all
  // items so the rule is global, not per-section.
  const activeHref =
    sections
      .flatMap((s) => s.items.map((i) => i.href))
      .filter((h) => currentPath === h || currentPath.startsWith(h + "/"))
      .sort((a, b) => b.length - a.length)[0] ?? null;
  const t = useT();
  const b = useBranding();
  const isDoctor = variant === "doctor";

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
          "fixed inset-y-0 left-0 z-40 flex flex-col text-sidebar-foreground border-r transition-transform duration-200 ease-out md:translate-x-0 md:static md:z-auto",
          isDoctor
            ? "w-[320px] border-[#e7ddc9] bg-[#f2f5ef]"
            : "w-64 border-sidebar-border bg-sidebar",
          open ? "translate-x-0" : "-translate-x-full",
          // `relative` (for the botanical art's positioning context) must apply
          // only from md up. On mobile the rail is an off-canvas overlay
          // (`fixed` + `-translate-x-full`, opened by the Header's hamburger);
          // making it `relative` there put it back in flow and squeezed `main`
          // to a sliver. Scope it to md+ so mobile keeps the intended overlay.
          isDoctor && "md:relative md:overflow-hidden",
        )}
        aria-label="Primary"
      >
        {isDoctor && (
          // Fixed to the viewport bottom-left (like the mascot) so the botanical
          // always frames it at the visible fold, even when the page scrolls.
          <div
            aria-hidden
            className="pointer-events-none fixed bottom-0 left-0 z-0 hidden h-[472px] w-[320px] md:block"
            style={{
              backgroundImage: "url(/doctor-art/doctor-sidebar-botanical.png)",
              backgroundSize: "cover",
              backgroundPosition: "bottom center",
              backgroundRepeat: "no-repeat",
            }}
          />
        )}

        <div
          className={cn(
            "relative z-10 border-b px-4 py-4",
            isDoctor ? "border-[#e7ddc9]" : "border-sidebar-border",
          )}
        >
          {b.clinicId !== "__platform__" ? (
            <ClinicHeader />
          ) : (
            <div className="flex items-center gap-2">
              <Avatar name="HairOS" size="sm" />
              <span className="text-sm font-semibold">{t("common.appName")}</span>
            </div>
          )}
        </div>

        <nav className="relative z-10 flex-1 overflow-y-auto px-2 py-3 space-y-4">
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
                  const active = item.href === activeHref;
                  const badge = item.badgeChannel
                    ? badges?.[item.badgeChannel]
                    : undefined;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onClose}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "group relative flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                          active
                            ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                            : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                        )}
                      >
                        {/* Angled teal active marker — a slim wedge tapered top
                            and bottom, sitting inside the row's left edge rather
                            than floating beside it. Route-agnostic: shown for
                            whichever item is active. */}
                        {active && (
                          <span
                            aria-hidden
                            className="pointer-events-none absolute inset-y-1.5 left-0 w-1.5 rounded-r-sm bg-[#164c46]"
                            style={{ clipPath: "polygon(0 0, 100% 20%, 100% 80%, 0 100%)" }}
                          />
                        )}
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

        <div
          className={cn(
            "relative z-10 border-t px-4 py-3 text-[11px] text-sidebar-foreground/60",
            isDoctor ? "border-[#e7ddc9]" : "border-sidebar-border",
          )}
        >
          {productLabel ?? t("common.appName")} · v1
        </div>
      </aside>
    </>
  );
}
