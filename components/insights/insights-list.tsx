"use client";

import { Sparkles, TrendingUp, AlertTriangle, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils/format";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useApiQuery } from "@/lib/hooks/use-api-query";
import { ErrorState } from "@/components/ui/error-state";

interface Insight {
  id: string;
  severity: "POSITIVE" | "INFORMATIONAL" | "WARNING";
  message: string;
  createdAt: string;
}

const ICON: Record<Insight["severity"], any> = {
  POSITIVE: TrendingUp,
  INFORMATIONAL: Info,
  WARNING: AlertTriangle,
};

const VARIANT: Record<Insight["severity"], "success" | "muted" | "warning"> = {
  POSITIVE: "success",
  INFORMATIONAL: "muted",
  WARNING: "warning",
};

const TINT: Record<Insight["severity"], "success" | "primary" | "warning"> = {
  POSITIVE: "success",
  INFORMATIONAL: "primary",
  WARNING: "warning",
};

const ICON_STYLE: Record<Insight["severity"], { bg: string; text: string }> = {
  POSITIVE: { bg: "bg-success/10", text: "text-success" },
  INFORMATIONAL: { bg: "bg-primary/10", text: "text-primary" },
  WARNING: { bg: "bg-warning/10", text: "text-warning" },
};

export function InsightsList() {
  // Same cache the dashboard's InsightsPreview shares (same URL, same
  // cache key) — visiting the full Insights page after seeing the
  // dashboard preview reuses that data instantly instead of re-fetching.
  const { data, loading, error, refetch } = useApiQuery<{ insights: Insight[] }>("/api/insights");
  const insights = data?.insights ?? [];

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles size={16} className="text-primary" />
          The FinMate Insights Engine is fully rule-based — it analyzes your real
          transaction, budget, and goal data with deterministic logic. No paid AI
          API is used.
        </p>
      </Card>

      {error ? (
        <ErrorState
          title="Couldn't load your insights"
          description="Something went wrong fetching your insights."
          onRetry={refetch}
        />
      ) : loading && !data ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : insights.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No insights yet"
          description="Add a few transactions, set a budget, or create a goal — FinMate will start surfacing patterns automatically."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {insights.map((i) => {
            const Icon = ICON[i.severity];
            const { bg, text } = ICON_STYLE[i.severity];
            return (
              <Card key={i.id} interactive tint={TINT[i.severity]}>
                <CardContent className="flex items-start gap-3 pt-5">
                  <div className={`rounded-lg ${bg} p-2 ${text}`}>
                    <Icon size={16} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm">{i.message}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatDate(i.createdAt)}</p>
                  </div>
                  <Badge variant={VARIANT[i.severity]}>{i.severity}</Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
