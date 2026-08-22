"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useApiQuery } from "@/lib/hooks/use-api-query";

interface Breakdown {
  label: string;
  scoreContribution: number;
  maxContribution: number;
}

interface HealthScoreResponse {
  score: number;
  breakdown: Breakdown[];
}

function scoreColor(score: number) {
  if (score >= 75) return { ring: "stroke-success", text: "text-success" };
  if (score >= 50) return { ring: "stroke-warning", text: "text-warning" };
  return { ring: "stroke-destructive", text: "text-destructive" };
}

export function HealthScoreCard() {
  // useApiQuery caches this for 30s and dedupes concurrent requests, so
  // navigating away from the dashboard and back within that window shows
  // the cached score instantly instead of re-fetching — closes the gap
  // documented in docs/PERFORMANCE.md's "What is NOT yet optimized" section.
  const { data } = useApiQuery<HealthScoreResponse>("/api/health-score");
  const score = data?.score ?? null;
  const breakdown = data?.breakdown ?? [];

  const colors = scoreColor(score ?? 0);
  const circumference = 2 * Math.PI * 36;
  const offset = score !== null ? circumference - (score / 100) * circumference : circumference;

  return (
    <Card tint="primary">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-1.5 text-foreground">
          <Sparkles size={14} className="text-primary" /> Financial Health
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <svg width="88" height="88" viewBox="0 0 88 88" className="shrink-0 -rotate-90">
            <circle cx="44" cy="44" r="36" fill="none" strokeWidth="8" className="stroke-muted" />
            {score !== null && (
              <circle
                cx="44"
                cy="44"
                r="36"
                fill="none"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                className={`${colors.ring} transition-all duration-700 ease-out`}
              />
            )}
          </svg>
          <div>
            <p className={`text-3xl font-semibold ${colors.text}`}>
              {score ?? "—"}
              <span className="text-base font-normal text-muted-foreground"> /100</span>
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          {breakdown.map((b) => (
            <div key={b.label}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{b.label}</span>
                <span className="font-medium">
                  {b.scoreContribution}/{b.maxContribution}
                </span>
              </div>
              <Progress value={b.scoreContribution} max={b.maxContribution} className="h-1.5" />
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Calculated transparently from your savings rate, budget adherence,
          spending consistency, goal progress, and recurring expense ratio.
          Not professional financial advice.
        </p>
      </CardContent>
    </Card>
  );
}
