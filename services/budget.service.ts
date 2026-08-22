import { prisma } from "@/lib/db/prisma";
import type { BudgetInput } from "@/lib/validation/budget";
import { BudgetStatus } from "@prisma/client";

/** A budget is Healthy under 80% used, Warning 80-100%, Exceeded over 100%. */
export function computeBudgetStatus(spent: number, limit: number): BudgetStatus {
  if (limit <= 0) return "HEALTHY";
  const ratio = spent / limit;
  if (ratio >= 1) return "EXCEEDED";
  if (ratio >= 0.8) return "WARNING";
  return "HEALTHY";
}

export async function upsertBudget(userId: string, input: BudgetInput) {
  const budget = await prisma.budget.upsert({
    where: { userId_month_year: { userId, month: input.month, year: input.year } },
    update: {},
    create: { userId, month: input.month, year: input.year },
  });

  for (const item of input.items) {
    await prisma.budgetItem.upsert({
      where: { budgetId_categoryId: { budgetId: budget.id, categoryId: item.categoryId } },
      update: { limit: item.limit },
      create: { budgetId: budget.id, categoryId: item.categoryId, limit: item.limit },
    });
  }

  return getBudgetForMonth(userId, input.month, input.year);
}

export async function getBudgetForMonth(userId: string, month: number, year: number) {
  const budget = await prisma.budget.findUnique({
    where: { userId_month_year: { userId, month, year } },
    include: { items: { include: { category: true } } },
  });
  if (!budget) return null;

  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  const itemsWithSpend = await Promise.all(
    budget.items.map(async (item) => {
      const agg = await prisma.transaction.aggregate({
        where: {
          userId,
          categoryId: item.categoryId,
          type: "EXPENSE",
          date: { gte: start, lt: end },
        },
        _sum: { amount: true },
      });
      const spent = Number(agg._sum.amount ?? 0);
      const status = computeBudgetStatus(spent, Number(item.limit));

      if (status !== item.status) {
        await prisma.budgetItem.update({ where: { id: item.id }, data: { status } });
      }

      return {
        ...item,
        spent,
        remaining: Math.max(0, Number(item.limit) - spent),
        status,
      };
    }),
  );

  return { ...budget, items: itemsWithSpend };
}
