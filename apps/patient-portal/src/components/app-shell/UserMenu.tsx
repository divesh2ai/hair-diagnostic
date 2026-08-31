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
        {/* `collisionPadding` keeps the menu clear of the window edge. Without
            it the popup sits flush against the right-hand side on a maximised
            window, which is where the clipping starts. */}
        {/* ── The z-index belongs HERE, not on the Popup ─────────────────
            `z-index` only applies to POSITIONED elements. Base UI gives the
            Positioner `position: absolute` and leaves the Popup `static`, so a
            `z-50` written on the Popup was silently inert — the whole menu
            participated at `z-auto` and the sticky header (`z-30`) painted
            over its first row, which is why the doctor's name was sliced in
            half. Putting it on the positioned ancestor is what actually lifts
            the menu above the header. */}
        <MenuPrimitive.Positioner
          sideOffset={6}
          align="end"
          collisionPadding={12}
          className="z-50"
        >
          {/* ── Why this width is BOUNDED ──────────────────────────────────
              It was `min-w-[14rem]` with no maximum, so the box grew to fit
              its widest child — and the widest child is
              "<email> · <role> · <clinic name>", which for a real clinic is
              easily 400px. The popup then ran off the right of the viewport
              and the identity line was cut in half.

              `truncate` was already on those lines and did nothing, because
              an element with no upper width bound never overflows: it just
              gets wider. Capping the width is what makes the ellipsis work.

              The `max-w` keeps it inside a narrow window too, so the menu
              degrades on a phone instead of extending past the screen. */}
          <MenuPrimitive.Popup className="w-[17rem] max-w-[calc(100vw-1.5rem)] rounded-lg border border-border bg-popover text-popover-foreground shadow-lg p-1 outline-none">
            <div className="px-3 py-2 border-b border-border mb-1">
              <div className="text-sm font-medium truncate">{name}</div>
              {/* Role and clinic move to their own line rather than being
                  joined onto the email with "·". One long run of text can only
                  ever truncate to the email; two lines let both facts survive,
                  and the clinic is the one a doctor with several logins
                  actually needs to read. */}
              <div className="text-xs text-muted-foreground truncate">
                {email ?? roleLabel}
              </div>
              {email && (
                <div className="text-xs text-muted-foreground truncate">
                  {roleLabel}
                </div>
              )}
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
                    className={`min-w-0 flex-1 inline-flex items-center justify-center gap-1 rounded-md px-1 py-1.5 text-xs hover:bg-muted ${mode === m ? "bg-muted text-foreground" : "text-muted-foreground"}`}
                  >
                    {/* shrink-0 on the icon and truncate on the label: with
                        three equal columns inside a fixed-width popup, it is
                        the label that must give way, never the icon. */}
                    <Icon className="size-3.5 shrink-0" />
                    <span className="truncate">{m}</span>
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
