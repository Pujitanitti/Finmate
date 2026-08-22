"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Search, Plus, Pencil, Trash2, ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { TransactionFormModal } from "@/components/transactions/transaction-form-modal";
import { useToast } from "@/components/layout/toast";
import { invalidateApiQuery } from "@/lib/hooks/use-api-query";
import { CategoryIcon } from "@/lib/utils/category-icons";
import { Skeleton } from "@/components/ui/skeleton";

interface Txn {
  id: string;
  merchant: string;
  amount: string | number;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  date: string;
  notes: string | null;
  account: { id: string; name: string };
  category: { id: string; name: string } | null;
}

const TYPE_VARIANT: Record<Txn["type"], "success" | "destructive" | "muted"> = {
  INCOME: "success",
  EXPENSE: "destructive",
  TRANSFER: "muted",
};

export function TransactionsTable({
  accounts,
  categories,
  currency,
  initialCategoryId,
}: {
  accounts: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  currency: string;
  initialCategoryId?: string | null;
}) {
  const [items, setItems] = useState<Txn[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState(initialCategoryId ?? "");
  const [type, setType] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Txn | null>(null);
  const { showToast } = useToast();

  const pageSize = 10;

  // Guards against the exact race condition described in the request: if
  // the user changes filters/search/page quickly, an older, slower request
  // could resolve AFTER a newer one and overwrite the UI with stale
  // results. Each fetch is tagged with an incrementing request ID; only the
  // response matching the CURRENT (latest) request ID is ever applied.
  const latestRequestId = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++latestRequestId.current;
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      ...(search ? { search } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(type ? { type } : {}),
    });
    const res = await fetch(`/api/transactions?${params}`);
    const data = await res.json();

    // A newer request has been fired since this one started — discard this
    // stale response instead of letting it overwrite current, correct state.
    if (requestId !== latestRequestId.current) return;

    setItems(data.items ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }, [page, search, categoryId, type]);

  useEffect(() => {
    load();
  }, [load]);

  // Debounces search input specifically — typing "groceries" shouldn't fire
  // 10 separate requests, one per keystroke. Filter/page changes (which are
  // discrete clicks, not continuous typing) still fetch immediately via the
  // effect above; this only smooths the free-text search field.
  const [searchInput, setSearchInput] = useState("");
  useEffect(() => {
    const handle = setTimeout(() => {
      setPage(1);
      setSearch(searchInput);
    }, 300);
    return () => clearTimeout(handle);
  }, [searchInput]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this transaction? This will also update the account balance.")) return;
    await fetch(`/api/transactions/${id}`, { method: "DELETE" });
    showToast("Transaction deleted", "info");
    invalidateApiQuery("/api/analytics");
    invalidateApiQuery("/api/health-score");
    invalidateApiQuery("/api/insights");
    invalidateApiQuery("/api/notifications");
    load();
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search merchant…"
            className="pl-9"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <select
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
          value={categoryId}
          onChange={(e) => {
            setPage(1);
            setCategoryId(e.target.value);
          }}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
          value={type}
          onChange={(e) => {
            setPage(1);
            setType(e.target.value);
          }}
        >
          <option value="">All types</option>
          <option value="INCOME">Income</option>
          <option value="EXPENSE">Expense</option>
          <option value="TRANSFER">Transfer</option>
        </select>
        <Button onClick={() => { setEditing(null); setModalOpen(true); }}>
          <Plus size={16} /> Add
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Merchant</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Account</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <>
                {Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-t border-border">
                    <td colSpan={6} className="px-4 py-3">
                      <Skeleton className="h-6 w-full" />
                    </td>
                  </tr>
                ))}
              </>
            )}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                      <ArrowLeftRight size={20} className="text-primary" />
                    </span>
                    <p className="font-medium">
                      {search || categoryId || type ? "No matching transactions" : "No transactions yet"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {search || categoryId || type
                        ? "Try adjusting your filters."
                        : "Start tracking your finances by adding your first transaction."}
                    </p>
                    {!(search || categoryId || type) && (
                      <Button size="sm" className="mt-1" onClick={() => { setEditing(null); setModalOpen(true); }}>
                        <Plus size={14} /> Add Transaction
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            )}
            {items.map((t) => (
              <tr key={t.id} className="border-t border-border transition-colors hover:bg-muted/40">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <CategoryIcon name={t.category?.name} />
                    <div className="flex flex-col">
                      <span className="font-medium">{t.merchant}</span>
                      <Badge variant={TYPE_VARIANT[t.type]} className="mt-0.5 w-fit">
                        {t.type}
                      </Badge>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{t.category?.name ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{t.account.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{formatDate(t.date)}</td>
                <td
                  className={
                    "px-4 py-3 text-right font-semibold " +
                    (t.type === "INCOME"
                      ? "text-success"
                      : t.type === "EXPENSE"
                        ? "text-destructive"
                        : "text-foreground")
                  }
                >
                  {t.type === "EXPENSE" ? "-" : t.type === "INCOME" ? "+" : ""}
                  {formatCurrency(Number(t.amount), currency)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => { setEditing(t); setModalOpen(true); }}>
                      <Pencil size={14} />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(t.id)}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Page {page} of {totalPages} · {total} total
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}

      {modalOpen && (
        <TransactionFormModal
          accounts={accounts}
          categories={categories}
          onClose={() => setModalOpen(false)}
          onSaved={load}
          initial={
            editing
              ? {
                  id: editing.id,
                  merchant: editing.merchant,
                  amount: Number(editing.amount),
                  type: editing.type,
                  accountId: editing.account.id,
                  categoryId: editing.category?.id ?? null,
                  date: editing.date,
                  notes: editing.notes,
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
