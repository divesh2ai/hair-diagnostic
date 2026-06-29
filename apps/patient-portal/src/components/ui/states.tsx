import type { ReactNode } from "react";
import { AlertCircle, Inbox, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Three vertically-stacked status panels — Empty / Error / Loading — share
// the same outer shell so consumers can switch between them without layout
// shift. Each one supports an optional CTA slot.

function Frame({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center py-12 px-6 gap-3 rounded-lg border border-dashed border-border bg-card/40",
        className,
      )}
    >
      <div className="text-muted-foreground">{icon}</div>
      <div className="text-base font-medium text-foreground">{title}</div>
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
      )}
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <Frame
      icon={<Inbox className="size-8" />}
      title={title}
      description={description}
      action={action}
      className={className}
    />
  );
}

export function ErrorState({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <Frame
      icon={<AlertCircle className="size-8 text-destructive" />}
      title={title}
      description={description}
      action={action}
      className={cn("border-destructive/30", className)}
    />
  );
}

export function LoadingState({
  title,
  description,
  className,
}: {
  title?: ReactNode;
  description?: ReactNode;
  className?: string;
}) {
  return (
    <Frame
      icon={<Loader2 className="size-7 animate-spin" />}
      title={title ?? "Loading…"}
      description={description}
      className={className}
    />
  );
}
