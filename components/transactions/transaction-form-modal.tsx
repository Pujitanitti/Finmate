"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/layout/toast";
import { invalidateApiQuery } from "@/lib/hooks/use-api-query";

interface Account { id: string; name: string }
interface Category { id: string; name: string }

export function TransactionFormModal({
  accounts,
  categories,
  onClose,
  onSaved,
  initial,
}: {
  accounts: Account[];
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
  initial?: {
    id: string;
    merchant: string;
    amount: number;
    type: string;
    accountId: string;
    categoryId: string | null;
    date: string;
    notes: string | null;
  };
}) {
  const [form, setForm] = useState({
    merchant: initial?.merchant ?? "",
    amount: initial?.amount?.toString() ?? "",
    type: initial?.type ?? "EXPENSE",
    accountId: initial?.accountId ?? accounts[0]?.id ?? "",
    categoryId: initial?.categoryId ?? "",
    date: initial?.date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    notes: initial?.notes ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload = {
        ...form,
        amount: Number(form.amount),
        categoryId: form.categoryId || null,
      };
      const res = await fetch(
        initial ? `/api/transactions/${initial.id}` : "/api/transactions",
        {
          method: initial ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save transaction.");
        showToast(data.error ?? "Failed to save transaction.", "error");
        return;
      }
      showToast(
        initial ? "Transaction updated successfully" : "Transaction added successfully",
        "success",
      );
      // A transaction affects nearly every cached dashboard metric — cash
      // flow, category spending, the financial health score, and insights
      // are all derived from real transaction data, so all of their cached
      // reads must be invalidated here or the dashboard would keep showing
      // stale numbers after this mutation. Notifications can also change
      // (a budget-warning notification may now apply).
      invalidateApiQuery("/api/analytics");
      invalidateApiQuery("/api/health-score");
      invalidateApiQuery("/api/insights");
      invalidateApiQuery("/api/notifications");
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-md p-6">
        <h2 className="mb-4 text-lg font-semibold">
          {initial ? "Edit Transaction" : "Add Transaction"}
        </h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Type</Label>
              <select
                className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                <option value="EXPENSE">Expense</option>
                <option value="INCOME">Income</option>
                <option value="TRANSFER">Transfer</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Amount</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                required
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Merchant</Label>
            <Input
              required
              value={form.merchant}
              onChange={(e) => setForm({ ...form, merchant: e.target.value })}
              placeholder="e.g. Swiggy, Salary, Netflix"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Account</Label>
              <select
                className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
                value={form.accountId}
                onChange={(e) => setForm({ ...form, accountId: e.target.value })}
                required
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Category</Label>
              <select
                className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              >
                <option value="">Uncategorized</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Date</Label>
            <Input
              type="date"
              required
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Notes (optional)</Label>
            <Input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
