import { cn } from "@/lib/utils/cn";

/**
 * FinMate icon mark: a geometric "F" built from three ascending bars —
 * reads as both a letterform and a growth/bar-chart motif. Monoline,
 * works at small sizes (favicon, sidebar, mobile app icon).
 * Uses currentColor for the bars so it inherits text-* color classes,
 * and a `bg` prop to control the badge background.
 */
export function LogoMark({
  size = 32,
  className,
  rounded = true,
}: {
  size?: number;
  className?: string;
  rounded?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={cn(className)}
      aria-hidden="true"
    >
      <rect
        width="32"
        height="32"
        rx={rounded ? 9 : 0}
        className="fill-primary"
      />
      {/* Three ascending bars forming an "F" silhouette + growth motif */}
      <rect x="9" y="8" width="14" height="3.2" rx="1.4" className="fill-primary-foreground" />
      <rect x="9" y="14.4" width="10" height="3.2" rx="1.4" className="fill-primary-foreground" />
      <rect x="9" y="8" width="3.2" height="16" rx="1.4" className="fill-primary-foreground" />
      {/* Growth accent: small ascending dot trail, top-right */}
      <circle cx="24.5" cy="9.5" r="1.6" className="fill-success" />
    </svg>
  );
}
