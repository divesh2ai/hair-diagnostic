"use client";

import { Dialog, DialogContent } from "./dialog";
import { Button } from "./button";
import type { ReactNode } from "react";

// Confirmation dialog. Tone "danger" colours the confirm button red.
// Caller drives state — keep the dialog purely controlled.

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  onConfirm,
  loading,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="sm"
        title={title}
        description={description}
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              {cancelLabel}
            </Button>
            <Button
              variant={tone === "danger" ? "destructive" : "default"}
              onClick={() => void onConfirm()}
              disabled={loading}
            >
              {loading ? "…" : confirmLabel}
            </Button>
          </>
        }
      >
        {/* Body intentionally empty — title + description carry the message. */}
        <span className="sr-only">{title}</span>
      </DialogContent>
    </Dialog>
  );
}
