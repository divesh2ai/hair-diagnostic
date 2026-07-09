"use client";

import { useRef } from "react";
import { LogOut, Sun, Moon, MonitorSmartphone } from "lucide-react";
import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { Avatar } from "@/components/ui/avatar";
import { useT } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { useBranding } from "@/lib/branding";

export function UserMenu({
  email,
  displayName,
  roleLabel,
}: {
  email: string | null;
  displayName?: string | null;
  roleLabel: string;
}) {
  // Self-contained sign-out: hidden form that submits to the existing
  // /auth/signout POST endpoint. Keeps the sign-out mechanism a pure
  // client-side detail so server layouts don't have to pass callbacks
  // across the RSC boundary (which is forbidden).
  const signOutFormRef = useRef<HTMLFormElement>(null);
  const submitSignOut = () => signOutFormRef.current?.submit();
  const t = useT();
  const b = useBranding();
  const { mode, setMode } = useTheme();

  const name = displayName ?? b.doctorName ?? email ?? roleLabel;

  return (
    <MenuPrimitive.Root>
      <form
        ref={signOutFormRef}
        action="/auth/signout"
        method="post"
        className="hidden"
      />
      <MenuPrimitive.Trigger className="inline-flex items-center gap-2 rounded-full pl-1 pr-2 h-9 hover:bg-muted text-sm">
        <Avatar name={name} src={b.doctorAvatarUrl} size="sm" />
        <span className="hidden sm:inline truncate max-w-[10rem]">{name}</span>
      </MenuPrimitive.Trigger>
      <MenuPrimitive.Portal>
        <MenuPrimitive.Positioner sideOffset={6} align="end">
          <MenuPrimitive.Popup className="z-50 min-w-[14rem] rounded-lg border border-border bg-popover text-popover-foreground shadow-lg p-1 outline-none">
            <div className="px-3 py-2 border-b border-border mb-1">
              <div className="text-sm font-medium truncate">{name}</div>
              <div className="text-xs text-muted-foreground truncate">
                {email ? `${email} · ${roleLabel}` : roleLabel}
              </div>
            </div>

            <div className="px-1.5 pb-1">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground px-1.5 py-1">
                Theme
              </div>
              <div className="flex items-center gap-1">
                {(
                  [
                    ["light", Sun],
                    ["dark", Moon],
                    ["system", MonitorSmartphone],
                  ] as const
                ).map(([m, Icon]) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`flex-1 inline-flex items-center justify-center gap-1 rounded-md py-1.5 text-xs hover:bg-muted ${mode === m ? "bg-muted text-foreground" : "text-muted-foreground"}`}
                  >
                    <Icon className="size-3.5" />
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <MenuPrimitive.Item
              onClick={submitSignOut}
              className="mt-1 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer hover:bg-muted outline-none data-[highlighted]:bg-muted"
            >
              <LogOut className="size-3.5" />
              {t("common.logout")}
            </MenuPrimitive.Item>
          </MenuPrimitive.Popup>
        </MenuPrimitive.Positioner>
      </MenuPrimitive.Portal>
    </MenuPrimitive.Root>
  );
}
