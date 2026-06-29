"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Side drawer — used for entity detail panels (Patient, Clinic) and the
// Notification Center. Slides in from the right; mobile becomes full-bleed.

export function Drawer({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      {children}
    </DialogPrimitive.Root>
  );
}

export function DrawerContent({
  title,
  children,
  className,
  width = "md",
}: {
  title?: ReactNode;
  children: ReactNode;
  className?: string;
  width?: "sm" | "md" | "lg";
}) {
  const widths = {
    sm: "sm:max-w-sm",
    md: "sm:max-w-md",
    lg: "sm:max-w-xl",
  } as const;
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
      <DialogPrimitive.Popup
        className={cn(
          "fixed right-0 top-0 z-50 h-full w-full bg-card text-card-foreground border-l border-border shadow-2xl flex flex-col outline-none transition-transform duration-200 data-[ending-style]:translate-x-full data-[starting-style]:translate-x-full",
          widths[width],
          className,
        )}
      >
        {title && (
          <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
            <DialogPrimitive.Title className="text-sm font-semibold">
              {title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close className="rounded-md p-1 text-muted-foreground hover:text-foreground">
              <X className="size-4" />
            </DialogPrimitive.Close>
          </div>
        )}
        <div className="flex-1 overflow-auto px-5 py-4">{children}</div>
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  );
}

export const DrawerTrigger = DialogPrimitive.Trigger;
