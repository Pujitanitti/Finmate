import { cn } from "@/lib/utils/cn";

/** Simple shimmering placeholder block for loading states — used instead of bare "Loading…" text. */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}
