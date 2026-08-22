"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils/cn";

export function Progress({
  value,
  max = 100,
  className,
  barClassName,
  status,
}: {
  value: number;
  max?: number;
  className?: string;
  barClassName?: string;
  status?: "healthy" | "warning" | "exceeded";
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const statusColor =
    status === "exceeded"
      ? "bg-destructive"
      : status === "warning"
        ? "bg-warning"
        : "bg-gradient-to-r from-primary/80 to-primary";

  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}>
      <motion.div
        className={cn("h-full rounded-full", statusColor, barClassName)}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      />
    </div>
  );
}
