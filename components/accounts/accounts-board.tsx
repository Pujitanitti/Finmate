"use client";

import { useState } from "react";
import { Plus, Landmark, PiggyBank, Wallet, CreditCard, TrendingUp, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils/format";
import { useToast } from "@/components/layout/toast";
import { useApiQuery, invalidateApiQuery } from "@/lib/hooks/use-api-query";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";

interface Account {
  id: string;
  name: string;
  type: "BANK" | "SAVINGS" | "CASH" | "CREDIT_CARD" | "INVESTMENT";
  balance: string | number;
}

const ICONS: Record<Account["type"], any> = {
  BANK: Landmark,
  SAVINGS: PiggyBank,
  CASH: Wallet,
  CREDIT_CARD: CreditCard,
  INVESTMENT: TrendingUp,
};

const LABELS: Record<Account["type"], string> = {
  BANK: "Bank Account",
  SAVINGS: "Savings Account",
  CASH: "Cash",
  CREDIT_CARD: "Credit Card",
  INVESTMENT: "Investment Account",
};

const ICON_COLORS: Record<Account["type"], { bg: string; text: string }> = {
  BANK: { bg: "bg-sky-500/10", text: "text-sky-600 dark:text-sky-400" },
  SAVINGS: { bg: "bg-success/10", text: "text-success" },
  CASH: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400" },
  CREDIT_CARD: { bg: "bg-destructive/10", text: "text-destructive" },
  INVESTMENT: { bg: "bg-violet-500/10", text: "text-violet-600 dark:text-violet-400" },
};

export function AccountsBoard({ currency }: { currency: string }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", type: "BANK", balance: "" });
  const { showToast } = useToast();

  const { data, loading, error, refetch } = useApiQuery<{ accounts: Account[] }>("/api/accounts");
  const accounts = data?.accounts ?? [];

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, balance: Number(form.balance) || 0 }),
    });
    showToast("Account added", "success");
    // A new account changes the total-balance figure shown on the dashboard.
    invalidateApiQuery("/api/analytics");
    invalidateApiQuery("/api/accounts");
    setShowForm(false);
    setForm({ name: "", type: "BANK", balance: "" });
    refetch();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this account and all associated transactions?")) return;
    await fetch(`/api/accounts/${id}`, { method: "DELETE" });
    showToast("Account removed", "info");
    // Deleting an account also cascades its transactions (see schema
    // onDelete: Cascade) — every cached analytics/insights/health-score
    // figure derived from those transactions is now stale.
    invalidateApiQuery("/api/analytics");
    invalidateApiQuery("/api/health-score");
    invalidateApiQuery("/api/insights");
    invalidateApiQuery("/api/accounts");
    refetch();
  }

  const total = accounts.reduce((s, a) => s + Number(a.balance), 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Total across all accounts:{" "}
          <span className="font-medium text-foreground">{formatCurrency(total, currency)}</span>
        </p>
        <Button onClick={() => setShowForm((v) => !v)}>
          <Plus size={16} /> Add Account
        </Button>
      </div>

      {showForm && (
        <Card className="p-4">
          <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Account name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Type</Label>
              <select
                className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                {Object.entries(LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Starting balance</Label>
              <Input
                type="number"
                value={form.balance}
                onChange={(e) => setForm({ ...form, balance: e.target.value })}
              />
            </div>
            <Button type="submit">Save</Button>
          </form>
        </Card>
      )}

      {error ? (
        <ErrorState
          title="Couldn't load your accounts"
          description="Something went wrong fetching your accounts."
          onRetry={refetch}
        />
      ) : loading && !data ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No accounts yet"
          description="Add a bank, cash, card, or investment account to start tracking transactions against it."
          actionLabel="Add Account"
          onAction={() => setShowForm(true)}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((a) => {
            const Icon = ICONS[a.type];
            const { bg, text } = ICON_COLORS[a.type];
            const isNegative = Number(a.balance) < 0;
            return (
              <Card key={a.id} interactive>
                <CardContent className="flex items-center justify-between pt-5">
                  <div className="flex items-center gap-3">
                    <div className={`rounded-lg ${bg} p-2 ${text}`}>
                      <Icon size={18} />
                    </div>
                    <div>
                      <p className="font-medium">{a.name}</p>
                      <p className="text-xs text-muted-foreground">{LABELS[a.type]}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${isNegative ? "text-destructive" : "text-foreground"}`}>
                      {formatCurrency(Number(a.balance), currency)}
                    </p>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(a.id)} className="mt-1 h-auto p-0 text-xs text-muted-foreground">
                      <Trash2 size={12} className="mr-1" /> Remove
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
