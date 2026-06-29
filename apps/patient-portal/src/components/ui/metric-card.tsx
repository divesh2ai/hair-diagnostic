import type { ReactNode } from "react";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "./card";

// Headline metric card. Big number, optional label, optional delta strip.
// Single-line label by design — long labels truncate.

export function MetricCard({
  label,
  value,
  hint,
  delta,
  icon,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  delta?: { value: number; period?: string };
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("p-5 flex flex-col gap-2.5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs uppercase tracking-wide text-muted-foreground truncate">
          {label}
        </div>
        {icon && (
          <div className="text-muted-foreground/80 shrink-0">{icon}</div>
        )}
      </div>
      <div className="text-3xl font-semibold tracking-tight tabular-nums">
        {value}
      </div>
      {(delta || hint) && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {delta && <DeltaPill value={delta.value} period={delta.period} />}
          {hint}
        </div>
      )}
    </Card>
  );
}

function DeltaPill({ value, period }: { value: number; period?: string }) {
  const dir = value > 0 ? "up" : value < 0 ? "down" : "flat";
  const Icon = dir === "up" ? TrendingUp : dir === "down" ? TrendingDown : Minus;
  const tone =
    dir === "up"
      ? "text-emerald-600 dark:text-emerald-400"
      : dir === "down"
        ? "text-red-600 dark:text-red-400"
        : "text-muted-foreground";
  return (
    <span className={cn("inline-flex items-center gap-1", tone)}>
      <Icon className="size-3" />
      {value > 0 ? "+" : ""}
      {value}%{period ? ` ${period}` : ""}
    </span>
  );
}
