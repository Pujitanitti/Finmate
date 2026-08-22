"use client";

import { TrendingUp, Info, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiQuery } from "@/lib/hooks/use-api-query";

interface Insight {
  id: string;
  severity: "POSITIVE" | "INFORMATIONAL" | "WARNING";
  message: string;
}

interface InsightsResponse {
  insights: Insight[];
}

const ICON: Record<Insight["severity"], { icon: typeof TrendingUp; bg: string; text: string }> = {
  POSITIVE: { icon: TrendingUp, bg: "bg-success/10", text: "text-success" },
  INFORMATIONAL: { icon: Info, bg: "bg-primary/10", text: "text-primary" },
  WARNING: { icon: AlertTriangle, bg: "bg-warning/10", text: "text-warning" },
};

export function InsightsPreview() {
  const { data, loading } = useApiQuery<InsightsResponse>("/api/insights");
  const insights = (data?.insights ?? []).slice(0, 4);

  return (
    <Card>
      <CardHeader>
        <CardTitle>FinMate Insights</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {loading && !data &&
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-start gap-2">
              <Skeleton className="h-6 w-6 shrink-0 rounded-full" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        {!loading && insights.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Add a few transactions and we&apos;ll surface personalized insights here.
          </p>
        )}
        {insights.map((i) => {
          const { icon: Icon, bg, text } = ICON[i.severity];
          return (
            <div key={i.id} className="flex items-start gap-2.5">
              <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${bg}`}>
                <Icon size={12} className={text} />
              </span>
              <p className="text-sm">{i.message}</p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
