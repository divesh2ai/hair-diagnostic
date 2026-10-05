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
}: {
  sections: NavSection[];
  open: boolean;
  onClose: () => void;
  badges?: Partial<Record<string, number>>;
  // Product/brand chip. Omitted -> uses the i18n appName (legacy default).
  productLabel?: string;
  // "doctor" opts into the wider ivory lockup with botanical artwork.
  variant?: "default" | "doctor";
}) {
  const pathname = usePathname();
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
            ? "w-[320px] border-[#e7ddc9] bg-[#f5f2ea]"
            : "w-64 border-sidebar-border bg-sidebar",
          open ? "translate-x-0" : "-translate-x-full",
          isDoctor && "relative overflow-hidden",
        )}
        aria-label="Primary"
      >
        {isDoctor && <DoctorSidebarArtwork />}

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

// Botanical artwork for the doctor sidebar: a sage/champagne ribbon wash and a
// cluster of leaves across the lower rail, behind the mascot that rests at
// bottom-left. Controlled SVG paths, low opacity, purely decorative.
function DoctorSidebarArtwork() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[320px] w-full"
      viewBox="0 0 320 320"
      preserveAspectRatio="xMidYMax slice"
      fill="none"
    >
      <path
        d="M0 230 C 80 190, 190 260, 320 210 L 320 320 L 0 320 Z"
        fill="#e8f0ea"
        opacity="0.7"
      />
      <path
        d="M0 262 C 90 226, 205 286, 320 246 L 320 320 L 0 320 Z"
        fill="#f3ece0"
        opacity="0.8"
      />
      <path
        d="M0 226 C 80 188, 190 258, 320 206"
        stroke="#c6a86a"
        strokeWidth="1"
        opacity="0.45"
      />
      <path
        d="M0 252 C 95 216, 205 278, 320 238"
        stroke="#c6a86a"
        strokeWidth="0.8"
        opacity="0.3"
      />
      <g fill="#6f9e86" opacity="0.5">
        <path d="M44 320 C 22 266, 44 222, 76 206 C 64 252, 70 294, 64 320 Z" />
        <path d="M76 320 C 76 260, 104 226, 138 216 C 116 258, 98 296, 92 320 Z" />
        <path d="M26 320 C 8 282, 10 248, 28 224 C 30 262, 36 298, 44 320 Z" />
      </g>
      <g stroke="#8fbfa8" strokeWidth="1" opacity="0.5">
        <path d="M62 318 C 60 278, 64 240, 74 214" />
        <path d="M90 318 C 96 278, 112 244, 134 220" />
      </g>
    </svg>
  );
}
