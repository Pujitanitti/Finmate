import { prisma } from "@/lib/db/prisma";
import { startOfMonth, subMonths, subDays, endOfMonth } from "date-fns";

export type CashFlowRange = "7d" | "30d" | "3m" | "6m" | "1y";

function rangeToStart(range: CashFlowRange): Date {
  const now = new Date();
  switch (range) {
    case "7d":
      return subDays(now, 7);
    case "30d":
      return subDays(now, 30);
    case "3m":
      return subMonths(now, 3);
    case "6m":
      return subMonths(now, 6);
    case "1y":
      return subMonths(now, 12);
  }
}

export async function getCashFlow(userId: string, range: CashFlowRange) {
  const start = rangeToStart(range);
  const transactions = await prisma.transaction.findMany({
    where: { userId, date: { gte: start }, type: { in: ["INCOME", "EXPENSE"] } },
    select: { amount: true, type: true, date: true },
    orderBy: { date: "asc" },
  });

  const byDay = new Map<string, { income: number; expenses: number }>();
  for (const t of transactions) {
    const key = t.date.toISOString().slice(0, 10);
    const bucket = byDay.get(key) ?? { income: 0, expenses: 0 };
    if (t.type === "INCOME") bucket.income += Number(t.amount);
    else bucket.expenses += Number(t.amount);
    byDay.set(key, bucket);
  }

  return Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v, net: v.income - v.expenses }));
}

export async function getSpendingByCategory(userId: string, month: Date = new Date()) {
  const start = startOfMonth(month);
  const end = endOfMonth(month);
  const prevStart = startOfMonth(subMonths(month, 1));
  const prevEnd = endOfMonth(subMonths(month, 1));

  const [current, previous] = await Promise.all([
    prisma.transaction.groupBy({
      by: ["categoryId"],
      where: { userId, type: "EXPENSE", date: { gte: start, lte: end } },
      _sum: { amount: true },
    }),
    prisma.transaction.groupBy({
      by: ["categoryId"],
      where: { userId, type: "EXPENSE", date: { gte: prevStart, lte: prevEnd } },
      _sum: { amount: true },
    }),
  ]);

  const categories = await prisma.category.findMany({ where: { userId } });
  const catMap = new Map(categories.map((c) => [c.id, c]));
  const prevMap = new Map(previous.map((p) => [p.categoryId, Number(p._sum.amount ?? 0)]));

  const total = current.reduce((s, c) => s + Number(c._sum.amount ?? 0), 0);

  return current
    .map((c) => {
      const amount = Number(c._sum.amount ?? 0);
      const prevAmount = prevMap.get(c.categoryId) ?? 0;
      const changePercent =
        prevAmount > 0 ? ((amount - prevAmount) / prevAmount) * 100 : amount > 0 ? 100 : 0;
      return {
        categoryId: c.categoryId,
        categoryName: catMap.get(c.categoryId ?? "")?.name ?? "Uncategorized",
        amount,
        percent: total > 0 ? Math.round((amount / total) * 100) : 0,
        changePercent: Math.round(changePercent * 10) / 10,
      };
    })
    .sort((a, b) => b.amount - a.amount);
}

export async function getMonthSummary(userId: string, month: Date = new Date()) {
  const start = startOfMonth(month);
  const end = endOfMonth(month);
  const prevStart = startOfMonth(subMonths(month, 1));
  const prevEnd = endOfMonth(subMonths(month, 1));

  async function sums(from: Date, to: Date) {
    const [income, expenses] = await Promise.all([
      prisma.transaction.aggregate({
        where: { userId, type: "INCOME", date: { gte: from, lte: to } },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { userId, type: "EXPENSE", date: { gte: from, lte: to } },
        _sum: { amount: true },
      }),
    ]);
    return {
      income: Number(income._sum.amount ?? 0),
      expenses: Number(expenses._sum.amount ?? 0),
    };
  }

  const [current, previous, accounts] = await Promise.all([
    sums(start, end),
    sums(prevStart, prevEnd),
    prisma.account.aggregate({ where: { userId }, _sum: { balance: true } }),
  ]);

  const currentSavings = current.income - current.expenses;
  const previousSavings = previous.income - previous.expenses;

  function pctChange(now: number, prev: number): number {
    if (prev === 0) return now > 0 ? 100 : 0;
    return Math.round(((now - prev) / Math.abs(prev)) * 1000) / 10;
  }

  return {
    totalBalance: Number(accounts._sum.balance ?? 0),
    monthlyIncome: current.income,
    monthlyExpenses: current.expenses,
    monthlySavings: currentSavings,
    incomeChangePercent: pctChange(current.income, previous.income),
    expensesChangePercent: pctChange(current.expenses, previous.expenses),
    savingsChangePercent: pctChange(currentSavings, previousSavings),
    savingsRate: current.income > 0 ? Math.round((currentSavings / current.income) * 100) : 0,
    previousSavingsRate:
      previous.income > 0 ? Math.round((previousSavings / previous.income) * 100) : 0,
  };
}
