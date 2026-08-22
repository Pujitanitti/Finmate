"use client";

import { useState } from "react";
import { Plus, Target } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { useToast } from "@/components/layout/toast";
import { useApiQuery, invalidateApiQuery } from "@/lib/hooks/use-api-query";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";

interface Goal {
  id: string;
  name: string;
  targetAmount: string | number;
  currentAmount: string | number;
  targetDate: string | null;
  progress: number;
  onTrack: boolean | null;
}

export function GoalsBoard({ currency }: { currency: string }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", targetAmount: "", targetDate: "" });
  const [contributing, setContributing] = useState<string | null>(null);
  const [contribAmount, setContribAmount] = useState("");
  const { showToast } = useToast();

  // Cached — returning to the Goals tab within the cache window shows the
  // previous result instantly instead of a fresh skeleton every time.
  const { data, loading, error, refetch } = useApiQuery<{ goals: Goal[] }>("/api/goals");
  const goals = data?.goals ?? [];

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        targetAmount: Number(form.targetAmount),
        targetDate: form.targetDate || null,
      }),
    });
    showToast("Goal created", "success");
    invalidateApiQuery("/api/goals");
    setShowForm(false);
    setForm({ name: "", targetAmount: "", targetDate: "" });
    refetch();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this goal?")) return;
    await fetch(`/api/goals/${id}`, { method: "DELETE" });
    showToast("Goal deleted", "info");
    invalidateApiQuery("/api/goals");
    refetch();
  }

  async function handleContribute(id: string) {
    if (!contribAmount) return;
    await fetch(`/api/goals/${id}/contributions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: Number(contribAmount) }),
    });
    showToast("Contribution added", "success");
    // Goal progress directly feeds the Financial Health score's Goal
    // Progress factor, and can trigger an on-track/goal-reached insight.
    invalidateApiQuery("/api/health-score");
    invalidateApiQuery("/api/insights");
    invalidateApiQuery("/api/goals");
    setContributing(null);
    setContribAmount("");
    refetch();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={() => setShowForm((v) => !v)}>
          <Plus size={16} /> New Goal
        </Button>
      </div>

      {showForm && (
        <Card className="p-4">
          <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Goal name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Target amount ({currency})</Label>
              <Input
                type="number"
                min={0}
                value={form.targetAmount}
                onChange={(e) => setForm({ ...form, targetAmount: e.target.value })}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Target date (optional)</Label>
              <Input
                type="date"
                value={form.targetDate}
                onChange={(e) => setForm({ ...form, targetDate: e.target.value })}
              />
            </div>
            <Button type="submit">Create</Button>
          </form>
        </Card>
      )}

      {error ? (
        <ErrorState
          title="Couldn't load your goals"
          description="Something went wrong fetching your savings goals."
          onRetry={refetch}
        />
      ) : loading && !data ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : goals.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No savings goals yet"
          description="Set a target to start tracking your progress toward it."
          actionLabel="Create Goal"
          onAction={() => setShowForm(true)}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {goals.map((g) => (
            <Card key={g.id} interactive tint={g.onTrack === false ? "warning" : "success"}>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
                    <Target size={14} className="text-primary" />
                  </span>
                  {g.name}
                </CardTitle>
                {g.onTrack !== null && (
                  <Badge variant={g.onTrack ? "success" : "warning"}>
                    {g.onTrack ? "On track" : "Behind"}
                  </Badge>
                )}
              </CardHeader>
              <CardContent>
                <div className="mb-2 flex justify-between text-sm">
                  <span>{formatCurrency(Number(g.currentAmount), currency)}</span>
                  <span className="text-muted-foreground">
                    of {formatCurrency(Number(g.targetAmount), currency)}
                  </span>
                </div>
                <Progress value={Number(g.currentAmount)} max={Number(g.targetAmount) || 1} />
                <p className="mt-2 text-xs text-muted-foreground">
                  {g.progress}% funded{g.targetDate ? ` · target ${formatDate(g.targetDate)}` : ""}
                </p>

                {contributing === g.id ? (
                  <div className="mt-3 flex gap-2">
                    <Input
                      type="number"
                      placeholder="Amount"
                      value={contribAmount}
                      onChange={(e) => setContribAmount(e.target.value)}
                      className="h-9"
                    />
                    <Button size="sm" onClick={() => handleContribute(g.id)}>
                      Add
                    </Button>
                  </div>
                ) : (
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setContributing(g.id)}>
                      Add contribution
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(g.id)}>
                      Delete
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
