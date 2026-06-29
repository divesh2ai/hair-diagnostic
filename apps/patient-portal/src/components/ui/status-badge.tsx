import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Status pill. Semantic tones (success / warning / danger / neutral / info)
// map to consistent backgrounds across light + dark via existing tokens.

const statusBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
  {
    variants: {
      tone: {
        success:
          "bg-emerald-500/10 text-emerald-700 ring-emerald-600/20 dark:text-emerald-400",
        warning:
          "bg-amber-500/10 text-amber-700 ring-amber-600/20 dark:text-amber-400",
        danger:
          "bg-red-500/10 text-red-700 ring-red-600/20 dark:text-red-400",
        neutral:
          "bg-muted text-muted-foreground ring-border",
        info:
          "bg-blue-500/10 text-blue-700 ring-blue-600/20 dark:text-blue-400",
        brand:
          "bg-[color:var(--brand-primary,theme(colors.primary.DEFAULT))]/10 text-foreground ring-border",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export type StatusTone = NonNullable<
  VariantProps<typeof statusBadgeVariants>["tone"]
>;

export function StatusBadge({
  tone,
  className,
  children,
}: {
  tone?: StatusTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span className={cn(statusBadgeVariants({ tone }), className)}>
      {children}
    </span>
  );
}

// Map common assessment statuses to a tone. Keep this centralised so every
// surface ends up using the same colours for the same value.
export function toneForAssessmentStatus(status: string): StatusTone {
  switch (status) {
    case "COMPLETED":
      return "success";
    case "FAILED":
      return "danger";
    case "PARTIAL_FAILURE":
      return "warning";
    case "PENDING":
    case "QUEUED":
      return "neutral";
    default:
      return "info";
  }
}
