import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatPercent } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { Wallet, TrendingUp, TrendingDown, PiggyBank, type LucideIcon } from "lucide-react";

type StatKind = "balance" | "income" | "expenses" | "savings";

const KIND_CONFIG: Record<StatKind, { icon: LucideIcon; iconBg: string; iconColor: string; tint: "primary" | "success" | "destructive" | "none" }> = {
  balance: { icon: Wallet, iconBg: "bg-primary/10", iconColor: "text-primary", tint: "primary" },
  income: { icon: TrendingUp, iconBg: "bg-success/10", iconColor: "text-success", tint: "success" },
  expenses: { icon: TrendingDown, iconBg: "bg-destructive/10", iconColor: "text-destructive", tint: "destructive" },
  savings: { icon: PiggyBank, iconBg: "bg-success/10", iconColor: "text-success", tint: "success" },
};

export function StatCard({
  title,
  value,
  changePercent,
  currency = "INR",
  kind = "balance",
}: {
  title: string;
  value: number;
  changePercent?: number;
  currency?: string;
  kind?: StatKind;
}) {
  const positive = (changePercent ?? 0) >= 0;
  const { icon: Icon, iconBg, iconColor, tint } = KIND_CONFIG[kind];
  const isHero = kind === "balance";

  return (
    <Card
      interactive
      tint={tint}
      className={cn(isHero && "border-primary/20 bg-gradient-to-br from-primary/[0.08] via-primary/[0.03] to-transparent")}
    >
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-1">
        <CardTitle className={cn(isHero && "text-foreground/70")}>{title}</CardTitle>
        <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", iconBg)}>
          <Icon size={16} className={iconColor} />
        </span>
      </CardHeader>
      <CardContent>
        <p className={cn("font-semibold tracking-tight", isHero ? "text-3xl" : "text-2xl")}>
          {formatCurrency(value, currency)}
        </p>
        {changePercent !== undefined && (
          <p
            className={cn(
              "mt-1 flex items-center gap-1 text-xs font-medium",
              positive ? "text-success" : "text-destructive",
            )}
          >
            {positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {formatPercent(changePercent)} vs last month
          </p>
        )}
        {isHero && changePercent === undefined && (
          <p className="mt-1 text-xs text-muted-foreground">Across all your accounts</p>
        )}
      </CardContent>
    </Card>
  );
}
