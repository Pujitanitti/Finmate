"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiQuery } from "@/lib/hooks/use-api-query";
import { ErrorState } from "@/components/ui/error-state";

type Range = "7d" | "30d" | "3m" | "6m" | "1y";

const RANGE_LABELS: Record<Range, string> = {
  "7d": "7 days",
  "30d": "30 days",
  "3m": "3 months",
  "6m": "6 months",
  "1y": "1 year",
};

interface Point {
  date: string;
  income: number;
  expenses: number;
  net: number;
}

interface CashFlowResponse {
  data: Point[];
}

export function CashFlowChart({ currency = "INR" }: { currency?: string }) {
  const [range, setRange] = useState<Range>("30d");
  // Each range gets its own cache entry (the URL, and therefore the cache
  // key, includes the range) — switching between 7d/30d/3m/etc. and back
  // within the cache TTL is instant instead of re-fetching every time.
  const { data: response, loading, error, refetch } = useApiQuery<CashFlowResponse>(
    `/api/analytics/cash-flow?range=${range}`,
  );
  const data = response?.data ?? [];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-4">
          <h3 className="font-medium">Cash Flow</h3>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-success" /> Income
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-destructive" /> Expenses
            </span>
          </div>
        </div>
        <div className="flex gap-0.5 rounded-lg bg-muted p-1">
          {(Object.keys(RANGE_LABELS) as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={
                "relative rounded-md px-2.5 py-1 text-xs font-medium transition-colors " +
                (range === r ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground")
              }
            >
              {range === r && (
                <motion.span
                  layoutId="cash-flow-range-pill"
                  className="absolute inset-0 rounded-md bg-primary"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
              <span className="relative z-10">{RANGE_LABELS[r]}</span>
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <ErrorState
          title="Couldn't load your cash flow"
          description="Something went wrong fetching this chart's data."
          onRetry={refetch}
        />
      ) : loading ? (
        <div className="flex h-64 flex-col justify-end gap-2 px-2 pb-2">
          <div className="flex h-full items-end gap-2">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton
                key={i}
                className="flex-1 rounded-t-md"
                style={{ height: `${30 + ((i * 37) % 60)}%` }}
              />
            ))}
          </div>
        </div>
      ) : data.length === 0 ? (
        <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
          No transactions in this period yet.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="date"
              tickFormatter={(d) => formatDate(d)}
              fontSize={11}
              stroke="hsl(var(--muted-foreground))"
            />
            <YAxis
              tickFormatter={(v) => formatCurrency(v, currency, { compact: true })}
              fontSize={11}
              stroke="hsl(var(--muted-foreground))"
            />
            <Tooltip
              cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }}
              formatter={(v: number) => formatCurrency(v, currency)}
              labelFormatter={(d) => formatDate(d)}
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 10,
                fontSize: 12,
                padding: "8px 12px",
                boxShadow: "0 4px 12px rgb(0 0 0 / 0.08)",
              }}
            />
            <Area type="monotone" dataKey="income" stroke="hsl(var(--success))" fill="url(#incomeGradient)" strokeWidth={2} />
            <Area type="monotone" dataKey="expenses" stroke="hsl(var(--destructive))" fill="url(#expenseGradient)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
