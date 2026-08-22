"use client";

import { useRouter } from "next/navigation";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { formatCurrency } from "@/lib/utils/format";
import { Skeleton } from "@/components/ui/skeleton";
import { getCategoryIcon } from "@/lib/utils/category-icons";
import { useApiQuery } from "@/lib/hooks/use-api-query";
import { ErrorState } from "@/components/ui/error-state";

interface CategorySpend {
  categoryId: string | null;
  categoryName: string;
  amount: number;
  percent: number;
  changePercent: number;
}

interface SpendingResponse {
  data: CategorySpend[];
}

const COLORS = [
  "#f97316",
  "#8b5cf6",
  "#0ea5e9",
  "#ef4444",
  "#ec4899",
  "#22c55e",
  "#6366f1",
  "#14b8a6",
  "#64748b",
];

export function SpendingBreakdown({
  currency = "INR",
  onSelectCategory,
}: {
  currency?: string;
  onSelectCategory?: (categoryId: string | null) => void;
}) {
  const router = useRouter();
  const { data: response, loading, error, refetch } = useApiQuery<SpendingResponse>("/api/analytics/spending");
  const data = response?.data ?? [];

  function handleSelect(categoryId: string | null) {
    if (onSelectCategory) {
      onSelectCategory(categoryId);
    } else {
      // Default behavior: jump to the Transactions tab pre-filtered by this category.
      router.push(categoryId ? `/transactions?categoryId=${categoryId}` : "/transactions");
    }
  }

  if (error) {
    return (
      <ErrorState
        title="Couldn't load your spending breakdown"
        description="Something went wrong fetching this month's category data."
        onRetry={refetch}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Skeleton className="mx-auto h-44 w-44 rounded-full sm:mx-0" />
        <div className="flex flex-1 flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
        No spending recorded yet this month.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <ResponsiveContainer width="100%" height={200} className="sm:w-40">
        <PieChart>
          <Pie
            data={data}
            dataKey="amount"
            nameKey="categoryName"
            innerRadius={55}
            outerRadius={80}
            paddingAngle={2}
            onClick={(entry) => handleSelect(entry.categoryId ?? null)}
            className="cursor-pointer"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} className="transition-opacity hover:opacity-80" />
            ))}
          </Pie>
          <Tooltip
            formatter={(v: number) => formatCurrency(v, currency)}
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 10,
              fontSize: 12,
              padding: "8px 12px",
              boxShadow: "0 4px 12px rgb(0 0 0 / 0.08)",
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <ul className="flex flex-1 flex-col gap-1">
        {data.map((c, i) => {
          const { icon: Icon, color } = getCategoryIcon(c.categoryName);
          return (
            <li key={c.categoryId ?? "uncategorized"}>
              <button
                onClick={() => handleSelect(c.categoryId)}
                className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted"
              >
                <span className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: COLORS[i % COLORS.length] }}
                  />
                  <Icon size={13} className={color} />
                  {c.categoryName}
                </span>
                <span className="flex items-center gap-2 text-muted-foreground">
                  {formatCurrency(c.amount, currency)}
                  <span className="w-10 text-right">{c.percent}%</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
