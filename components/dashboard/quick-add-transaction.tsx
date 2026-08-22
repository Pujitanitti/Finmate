"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TransactionFormModal } from "@/components/transactions/transaction-form-modal";
import { useToast } from "@/components/layout/toast";

interface Account { id: string; name: string }
interface Category { id: string; name: string }

/**
 * Header-level quick-add button. Lazily loads accounts/categories only when
 * clicked (not on every page load) so it adds no extra requests to normal
 * navigation, but still lets the user log a transaction from anywhere in
 * the app without navigating to the Transactions tab first.
 */
export function QuickAddTransaction() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const { showToast } = useToast();

  async function handleOpen() {
    setLoading(true);
    try {
      const [accRes, catRes] = await Promise.all([
        fetch("/api/accounts"),
        fetch("/api/categories"),
      ]);
      const accData = await accRes.json();
      const catData = await catRes.json();
      const loadedAccounts = accData.accounts ?? [];
      if (loadedAccounts.length === 0) {
        showToast("Add an account first before logging a transaction", "info");
        return;
      }
      setAccounts(loadedAccounts);
      setCategories(catData.categories ?? []);
      setOpen(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button size="sm" onClick={handleOpen} disabled={loading} className="hidden sm:inline-flex">
        <Plus size={16} /> Add Transaction
      </Button>
      {open && (
        <TransactionFormModal
          accounts={accounts}
          categories={categories}
          onClose={() => setOpen(false)}
          onSaved={() => {}}
        />
      )}
    </>
  );
}
