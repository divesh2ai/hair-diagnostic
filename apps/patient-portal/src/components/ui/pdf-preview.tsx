"use client";

import { ExternalLink, Loader2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

// PDF inline preview. Defers to the browser's native viewer via <object>;
// caller passes the URL (signed Supabase Storage URL, presigned S3, or a
// route handler that streams the bytes). Used by report detail and the
// Super Admin PDF audit screen.
//
// Future: replace <object> with pdfjs if we need text-layer search.

export function PdfPreview({
  url,
  height = 720,
  className,
}: {
  url: string;
  height?: number;
  className?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div
      className={cn(
        "relative rounded-lg border border-border bg-card overflow-hidden",
        className,
      )}
      style={{ height }}
    >
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      )}
      <object
        data={`${url}#toolbar=1&navpanes=0`}
        type="application/pdf"
        className="h-full w-full"
        onLoad={() => setLoaded(true)}
      >
        <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-primary underline"
          >
            <ExternalLink className="size-3.5" />
            Open PDF
          </a>
        </div>
      </object>
    </div>
  );
}
