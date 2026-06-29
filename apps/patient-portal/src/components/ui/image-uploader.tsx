"use client";

import { useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

// Single-image uploader. Stateless about *where* the bytes go — the caller
// supplies onUpload(file) which is expected to return the final URL after
// upload (Supabase Storage, S3 presigned, etc.) and persistence.
//
// The "Logo" variant in ./logo-uploader composes this with size hints.

export function ImageUploader({
  value,
  onUpload,
  onRemove,
  accept = "image/png,image/jpeg,image/svg+xml,image/webp",
  maxBytes = 4 * 1024 * 1024,
  hint,
  label = "Upload image",
  className,
  previewClassName,
}: {
  value: string | null;
  onUpload: (file: File) => Promise<string>;
  onRemove?: () => void | Promise<void>;
  accept?: string;
  maxBytes?: number;
  hint?: string;
  label?: string;
  className?: string;
  previewClassName?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    if (file.size > maxBytes) {
      setError(`File too large (max ${Math.round(maxBytes / 1024 / 1024)} MB)`);
      return;
    }
    setBusy(true);
    try {
      await onUpload(file);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn("flex items-start gap-4", className)}>
      <div
        className={cn(
          "size-20 rounded-lg border border-dashed border-border bg-muted/30 overflow-hidden flex items-center justify-center text-muted-foreground shrink-0",
          previewClassName,
        )}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-full w-full object-cover" />
        ) : (
          <Upload className="size-5" />
        )}
      </div>

      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="size-3.5" />
            {label}
          </Button>
          {value && onRemove && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => void onRemove()}
            >
              <X className="size-3.5" />
              Remove
            </Button>
          )}
        </div>
        {hint && (
          <p className="text-xs text-muted-foreground">{hint}</p>
        )}
        {error && (
          <p className="text-xs text-destructive">{error}</p>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
