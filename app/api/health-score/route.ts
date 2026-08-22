import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-session";
import { prisma } from "@/lib/db/prisma";
import { getMonthSummary } from "@/services/analytics.service";
import { getBudgetForMonth } from "@/services/budget.service";
import { listGoalsWithProgress } from "@/services/goal.service";
import { computeFinancialHealthScore } from "@/services/financialHealth.service";

export async function GET() {
  const { session, response } = await requireSession();
  if (!session) return response;
  const userId = session.userId;
  const now = new Date();

  const [summary, budget, goals, recurring, user] = await Promise.all([
    getMonthSummary(userId, now),
    getBudgetForMonth(userId, now.getMonth() + 1, now.getFullYear()),
    listGoalsWithProgress(userId),
    prisma.recurringPayment.findMany({ where: { userId, status: "ACTIVE" } }),
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
  ]);

  const budgetAdherence =
    budget && budget.items.length > 0
      ? (budget.items.filter((i) => i.status !== "EXCEEDED").length / budget.items.length) * 100
      : 100;

  const goalProgress =
    goals.length > 0 ? goals.reduce((s, g) => s + g.progress, 0) / goals.length : 0;

  const monthlyIncome = Number(user.monthlyIncome ?? summary.monthlyIncome ?? 0);
  const recurringMonthlyTotal = recurring.reduce((sum, r) => {
    const multiplier =
      r.frequency === "WEEKLY" ? 4.33 : r.frequency === "QUARTERLY" ? 1 / 3 : r.frequency === "YEARLY" ? 1 / 12 : 1;
    return sum + Number(r.amount) * multiplier;
  }, 0);
  const recurringExpenseRatio = monthlyIncome > 0 ? recurringMonthlyTotal / monthlyIncome : 0;

  // Spending consistency: compare current month expenses to a simple stability heuristic
  const spendingConsistency = 70; // baseline until multi-month volatility tracking is added

  const result = computeFinancialHealthScore({
    savingsRate: summary.savingsRate,
    budgetAdherence,
    spendingConsistency,
    goalProgress,
    recurringExpenseRatio,
  });

  return NextResponse.json(result);
}
