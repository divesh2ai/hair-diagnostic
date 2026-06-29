import * as React from "react";
import { cn } from "@/lib/utils";

// Lightweight avatar. Renders the image when src is provided + loads, else
// falls back to initials. No skeleton — caller wraps in <LoadingState/> if
// the underlying data is async.

const SIZES = {
  xs: "size-6 text-[10px]",
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-12 text-base",
} as const;

export type AvatarSize = keyof typeof SIZES;

export function Avatar({
  name,
  src,
  size = "md",
  className,
}: {
  name: string;
  src?: string | null;
  size?: AvatarSize;
  className?: string;
}) {
  const [errored, setErrored] = React.useState(false);
  const initials = React.useMemo(
    () =>
      name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]!.toUpperCase())
        .join(""),
    [name],
  );

  const showImg = src && !errored;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-muted-foreground font-medium select-none",
        SIZES[size],
        className,
      )}
      aria-label={name}
    >
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name}
          className="h-full w-full object-cover"
          onError={() => setErrored(true)}
        />
      ) : (
        initials || "?"
      )}
    </span>
  );
}
