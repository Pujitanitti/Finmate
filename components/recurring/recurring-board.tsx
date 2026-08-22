"use client";

import { useState } from "react";
import { Plus, Trash2, Repeat } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { useToast } from "@/components/layout/toast";
import { CategoryIcon } from "@/lib/utils/category-icons";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiQuery, invalidateApiQuery } from "@/lib/hooks/use-api-query";
import { ErrorState } from "@/components/ui/error-state";

interface Category {
  id: string;
  name: string;
}

interface Payment {
  id: string;
  name: string;
  amount: string | number;
  frequency: "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY";
  category: Category | null;
  nextDueDate: string;
  status: "ACTIVE" | "PAUSED" | "CANCELLED";
}

const FREQ_LABEL: Record<Payment["frequency"], string> = {
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  YEARLY: "Yearly",
};

export function RecurringBoard({ currency, categories }: { currency: string; categories: Category[] }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    amount: "",
    frequency: "MONTHLY",
    categoryId: categories[0]?.id ?? "",
    nextDueDate: new Date().toISOString().slice(0, 10),
  });
  const { showToast } = useToast();

  const { data, loading, error, refetch } = useApiQuery<{ payments: Payment[] }>("/api/recurring");
  const payments = data?.payments ?? [];

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.categoryId) {
      showToast("Add a category first", "error");
      return;
    }
    await fetch("/api/recurring", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, amount: Number(form.amount) }),
    });
    showToast("Recurring payment added", "success");
    // Recurring payment totals feed the Financial Health score's
    // Recurring Expense Ratio factor.
    invalidateApiQuery("/api/health-score");
    invalidateApiQuery("/api/recurring");
    setShowForm(false);
    setForm({ name: "", amount: "", frequency: "MONTHLY", categoryId: categories[0]?.id ?? "", nextDueDate: new Date().toISOString().slice(0, 10) });
    refetch();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this recurring payment?")) return;
    await fetch(`/api/recurring/${id}`, { method: "DELETE" });
    showToast("Recurring payment removed", "info");
    invalidateApiQuery("/api/health-score");
    invalidateApiQuery("/api/recurring");
    refetch();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={() => setShowForm((v) => !v)}>
          <Plus size={16} /> Add Recurring Payment
        </Button>
      </div>

      {showForm && (
        <Card className="p-4">
          <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Netflix" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Amount ({currency})</Label>
              <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Frequency</Label>
              <select
                className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
                value={form.frequency}
                onChange={(e) => setForm({ ...form, frequency: e.target.value })}
              >
                {Object.entries(FREQ_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Category</Label>
              <select
                className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                required
              >
                {categories.length === 0 && <option value="">No categories yet</option>}
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Next payment</Label>
              <Input type="date" value={form.nextDueDate} onChange={(e) => setForm({ ...form, nextDueDate: e.target.value })} required />
            </div>
            <Button type="submit">Save</Button>
          </form>
        </Card>
      )}

      {error ? (
        <ErrorState
          title="Couldn't load your recurring payments"
          description="Something went wrong fetching this data."
          onRetry={refetch}
        />
      ) : loading && !data ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : payments.length === 0 ? (
        <EmptyState
          icon={Repeat}
          title="No recurring payments tracked yet"
          description="Track subscriptions and bills so FinMate can remind you before they're due."
          actionLabel="Add Recurring Payment"
          onAction={() => setShowForm(true)}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Frequency</th>
                <th className="px-4 py-3">Next Payment</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-t border-border transition-colors hover:bg-muted/40">
                  <td className="px-4 py-3 font-medium">
                    <div className="flex items-center gap-3">
                      <CategoryIcon name={p.category?.name} />
                      {p.name}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{p.category?.name ?? "Uncategorized"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{FREQ_LABEL[p.frequency]}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(p.nextDueDate)}</td>
                  <td className="px-4 py-3">
                    <Badge variant={p.status === "ACTIVE" ? "success" : "muted"}>{p.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-destructive">
                    -{formatCurrency(Number(p.amount), currency)}
                  </td>
                  <td className="px-4 py-3">
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)}>
                      <Trash2 size={14} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
