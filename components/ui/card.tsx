import * as React from "react";
import { cn } from "@/lib/utils/cn";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Adds a subtle lift + border glow on hover — use for clickable/interactive cards. */
  interactive?: boolean;
  /** Optional tint applied as a soft background wash, for visual variety across sections. */
  tint?: "primary" | "success" | "warning" | "destructive" | "none";
}

const TINTS: Record<NonNullable<CardProps["tint"]>, string> = {
  primary: "bg-gradient-to-br from-primary/[0.06] to-transparent border-primary/15",
  success: "bg-gradient-to-br from-success/[0.06] to-transparent border-success/15",
  warning: "bg-gradient-to-br from-warning/[0.06] to-transparent border-warning/15",
  destructive: "bg-gradient-to-br from-destructive/[0.06] to-transparent border-destructive/15",
  none: "",
};

export function Card({ className, interactive, tint = "none", ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card text-card-foreground shadow-card transition-all duration-200",
        // Real blue glow on hover, not just a generic shadow bump — matches
        // the fintech-premium direction (subtle border prominence + soft
        // blue glow) rather than a flat elevation change.
        interactive && "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-glow-primary",
        TINTS[tint],
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1 p-5 pb-2", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-sm font-medium text-muted-foreground", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5 pt-2", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center p-5 pt-2", className)} {...props} />;
}
