"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { useT } from "@/lib/i18n";

// Auto-breadcrumbs derived from the URL. Segments are humanized (kebab →
// Title Case); ids are shortened. Override hooks (e.g. show patient name
// instead of id) can be added per-route via a context provider later.

function humanize(seg: string): string {
  if (/^[a-f0-9-]{12,}$/i.test(seg)) return seg.slice(0, 6) + "…";
  if (seg.startsWith("c") && /^[a-z0-9]{20,}$/i.test(seg)) return seg.slice(0, 6) + "…";
  return seg
    .split("-")
    .map((p) => p[0]?.toUpperCase() + p.slice(1))
    .join(" ");
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const t = useT();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-1 text-xs text-muted-foreground"
    >
      <Link href="/" className="hover:text-foreground">
        {t("shell.breadcrumbHome")}
      </Link>
      {segments.map((seg, i) => {
        const href = "/" + segments.slice(0, i + 1).join("/");
        const last = i === segments.length - 1;
        return (
          <span key={href} className="flex items-center gap-1">
            <ChevronRight className="size-3" />
            {last ? (
              <span className="text-foreground font-medium">{humanize(seg)}</span>
            ) : (
              <Link href={href} className="hover:text-foreground">
                {humanize(seg)}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
