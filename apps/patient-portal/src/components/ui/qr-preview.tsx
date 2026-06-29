"use client";

import QRCode from "react-qr-code";
import { cn } from "@/lib/utils";

// SVG QR code preview. Caller controls value + size. Wraps the lib so we own
// the styling defaults and can swap engines later without touching call sites.

export function QrPreview({
  value,
  size = 160,
  label,
  className,
}: {
  value: string;
  size?: number;
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-3",
        className,
      )}
    >
      <div className="bg-white p-2 rounded-md">
        <QRCode value={value} size={size} level="M" />
      </div>
      {label && (
        <div className="text-xs text-muted-foreground max-w-[12rem] text-center break-all">
          {label}
        </div>
      )}
    </div>
  );
}
