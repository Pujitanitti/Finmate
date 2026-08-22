import { LogoMark } from "@/components/brand/logo-mark";
import { cn } from "@/lib/utils/cn";

/**
 * Full FinMate lockup: icon mark + wordmark. Use `iconOnly` for tight
 * spaces (collapsed sidebar, favicon-adjacent contexts).
 */
export function Logo({
  size = 32,
  iconOnly = false,
  className,
  wordmarkClassName,
}: {
  size?: number;
  iconOnly?: boolean;
  className?: string;
  wordmarkClassName?: string;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark size={size} />
      {!iconOnly && (
        <span
          className={cn(
            "text-lg font-semibold tracking-tight text-foreground",
            wordmarkClassName,
          )}
        >
          Fin<span className="text-primary">Mate</span>
        </span>
      )}
    </span>
  );
}
