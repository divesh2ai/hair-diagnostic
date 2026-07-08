"use client";

import { Check, Globe } from "lucide-react";
import { useI18n, LOCALE_LABELS, LOCALES, type Locale } from "@/lib/i18n";
import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { cn } from "@/lib/utils";

// Locale picker. Shows the active locale in the native script; the popover
// lists every supported locale with both its native and English name so
// users can find their language even from an unfamiliar UI.

export function LanguageSelector({ className }: { className?: string }) {
  const { locale, setLocale } = useI18n();
  // Guarantee English is always the first option and always present, even if
  // LOCALES ever ships in a different order or a stale build filters the
  // active locale. Users must always have a one-click path back to English.
  const orderedLocales = ["en" as Locale, ...LOCALES.filter((l) => l !== "en")];
  return (
    <MenuPrimitive.Root>
      <MenuPrimitive.Trigger
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 h-8 text-xs font-medium hover:bg-muted",
          className,
        )}
        aria-label="Language"
      >
        <Globe className="size-3.5" />
        <span>{LOCALE_LABELS[locale].native}</span>
      </MenuPrimitive.Trigger>
      <MenuPrimitive.Portal>
        <MenuPrimitive.Positioner sideOffset={6}>
          <MenuPrimitive.Popup className="z-50 min-w-[10rem] rounded-lg border border-border bg-popover text-popover-foreground shadow-lg p-1 outline-none">
            {orderedLocales.map((l) => (
              <MenuPrimitive.Item
                key={l}
                onClick={() => setLocale(l as Locale)}
                className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm cursor-pointer hover:bg-muted outline-none data-[highlighted]:bg-muted"
              >
                <span className="flex flex-col">
                  <span>{LOCALE_LABELS[l].native}</span>
                  {LOCALE_LABELS[l].native !== LOCALE_LABELS[l].english && (
                    <span className="text-xs text-muted-foreground">
                      {LOCALE_LABELS[l].english}
                    </span>
                  )}
                </span>
                {locale === l && <Check className="size-3.5" />}
              </MenuPrimitive.Item>
            ))}
          </MenuPrimitive.Popup>
        </MenuPrimitive.Positioner>
      </MenuPrimitive.Portal>
    </MenuPrimitive.Root>
  );
}
