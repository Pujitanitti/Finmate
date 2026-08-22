"use client";

import { useState } from "react";
import { Plus, PiggyBank } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils/format";
import { useToast } from "@/components/layout/toast";
import { useApiQuery, invalidateApiQuery } from "@/lib/hooks/use-api-query";
import { CategoryIcon } from "@/lib/utils/category-icons";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";

interface Category { id: string; name: string }
interface BudgetItem {
  id: string;
  categoryId: string;
  category: Category;
  limit: string | number;
  spent: number;
  remaining: number;
  status: "HEALTHY" | "WARNING" | "EXCEEDED";
}

const STATUS_VARIANT: Record<BudgetItem["status"], "success" | "warning" | "destructive"> = {
  HEALTHY: "success",
  WARNING: "warning",
  EXCEEDED: "destructive",
};

export function BudgetBoard({ categories, currency }: { categories: Category[]; currency: string }) {
  const [showForm, setShowForm] = useState(false);
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [limit, setLimit] = useState("");
  const { showToast } = useToast();

  const now = new Date();
  const budgetUrl = `/api/budgets?month=${now.getMonth() + 1}&year=${now.getFullYear()}`;
  // Cached — returning to the Budgets tab within the cache window shows the
  // previous result instantly instead of a fresh skeleton every time.
  const { data, loading, error, refetch } = useApiQuery<{ budget: { items: BudgetItem[] } | null }>(budgetUrl);
  const items = data?.budget?.items ?? [];

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!categoryId || !limit) return;
    await fetch("/api/budgets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        month: now.getMonth() + 1,
        year: now.getFullYear(),
        items: [{ categoryId, limit: Number(limit) }],
      }),
    });
    showToast("Budget created", "success");
    // Budget adherence directly feeds the Financial Health score, and a new
    // budget can immediately trigger a warning/exceeded insight.
    invalidateApiQuery("/api/health-score");
    invalidateApiQuery("/api/insights");
    invalidateApiQuery(budgetUrl);
    setShowForm(false);
    setLimit("");
    refetch();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={() => setShowForm((v) => !v)}>
          <Plus size={16} /> Set Category Budget
        </Button>
      </div>

      {showForm && (
        <Card className="p-4">
          <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Category</Label>
              <select
                className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Monthly limit ({currency})</Label>
              <Input type="number" min={0} value={limit} onChange={(e) => setLimit(e.target.value)} required />
            </div>
            <Button type="submit">Save</Button>
          </form>
        </Card>
      )}

      {error ? (
        <ErrorState
          title="Couldn't load your budgets"
          description="Something went wrong fetching your budget data."
          onRetry={refetch}
        />
      ) : loading && !data ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={PiggyBank}
          title="No budgets set for this month"
          description="Set a spending limit for a category to start tracking against it."
          actionLabel="Set Category Budget"
          onAction={() => setShowForm(true)}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <Card
              key={item.id}
              interactive
              tint={item.status === "EXCEEDED" ? "destructive" : item.status === "WARNING" ? "warning" : "none"}
            >
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <CategoryIcon name={item.category.name} />
                  {item.category.name}
                </CardTitle>
                <Badge variant={STATUS_VARIANT[item.status]}>{item.status}</Badge>
              </CardHeader>
              <CardContent>
                <div className="mb-2 flex justify-between text-sm">
                  <span>{formatCurrency(item.spent, currency)} spent</span>
                  <span className="text-muted-foreground">
                    of {formatCurrency(Number(item.limit), currency)}
                  </span>
                </div>
                <Progress value={item.spent} max={Number(item.limit)} status={item.status.toLowerCase() as any} />
                <p className="mt-2 text-xs text-muted-foreground">
                  {formatCurrency(item.remaining, currency)} remaining
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
