"use client";

import { Toaster as SonnerToaster, toast as sonnerToast } from "sonner";

// Thin wrapper around sonner. Importing from here (not sonner directly) means
// any future change of toast lib is a single-file swap.

export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      theme="system"
      closeButton
      richColors
      toastOptions={{
        classNames: {
          toast: "rounded-lg border-border bg-card text-card-foreground shadow-lg",
        },
      }}
    />
  );
}

export const toast = sonnerToast;
