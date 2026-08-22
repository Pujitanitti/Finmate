const currencySymbols: Record<string, string> = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
};

export function formatCurrency(
  amount: number,
  currency: string = "INR",
  options?: { compact?: boolean },
): string {
  const symbol = currencySymbols[currency] ?? currency + " ";
  if (options?.compact) {
    return `${symbol}${formatCompactNumber(amount)}`;
  }
  const formatted = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
  return `${symbol}${formatted}`;
}

function formatCompactNumber(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 10000000) return (amount / 10000000).toFixed(1) + "Cr";
  if (abs >= 100000) return (amount / 100000).toFixed(1) + "L";
  if (abs >= 1000) return (amount / 1000).toFixed(1) + "K";
  return amount.toFixed(0);
}

export function formatPercent(value: number, decimals = 1): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)}%`;
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}
