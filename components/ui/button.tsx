import * as React from "react";
import { cn } from "@/lib/utils/cn";

type Variant = "default" | "secondary" | "outline" | "ghost" | "destructive";
type Size = "sm" | "md" | "lg" | "icon";

const variantClasses: Record<Variant, string> = {
  // Interactive lift + glow + brightness on hover — kept from the redesign,
  // but no longer a gradient between two blues (primary-dark is now
  // identical to primary, since both are the restored original navy, so a
  // two-color gradient would show no visible change). Brightness + lift +
  // glow gives the same "premium interactive" feel using the single
  // correct brand color.
  default:
    "bg-primary text-primary-foreground shadow-sm hover:brightness-110 hover:shadow-glow-primary hover:-translate-y-px",
  secondary: "bg-muted text-foreground hover:bg-muted/80",
  outline: "border border-border bg-transparent hover:bg-primary/5 hover:border-primary/40",
  ghost: "bg-transparent hover:bg-primary/5",
  destructive: "bg-destructive text-destructive-foreground shadow-sm hover:opacity-90",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
  icon: "h-10 w-10",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-lg font-medium",
          "transition-all duration-150 active:scale-[0.97]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "disabled:pointer-events-none disabled:opacity-50 disabled:active:scale-100",
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
