/**
 * FinMate Insights Engine — 100% deterministic, rule-based.
 * No OpenAI / Claude / Gemini / paid AI API is used or required.
 * Each rule below is a pure function of real database aggregates,
 * making every generated insight explainable and reproducible.
 */
import { prisma } from "@/lib/db/prisma";
import { getMonthSummary, getSpendingByCategory } from "@/services/analytics.service";
import { InsightSeverity } from "@prisma/client";

export interface GeneratedInsight {
  severity: InsightSeverity;
  message: string;
  metric: string;
}

const SIGNIFICANT_CHANGE_THRESHOLD = 15; // percent
const BUDGET_WARNING_THRESHOLD = 80; // percent used

export async function generateInsights(userId: string): Promise<GeneratedInsight[]> {
  const insights: GeneratedInsight[] = [];
  const now = new Date();

  const [summary, categorySpend, budget, goals, recurring] = await Promise.all([
    getMonthSummary(userId, now),
    getSpendingByCategory(userId, now),
    prisma.budget.findUnique({
      where: {
        userId_month_year: { userId, month: now.getMonth() + 1, year: now.getFullYear() },
      },
      include: { items: { include: { category: true } } },
    }),
    prisma.goal.findMany({ where: { userId } }),
    prisma.recurringPayment.findMany({ where: { userId, status: "ACTIVE" } }),
  ]);

  // Rule 1: category spend change > threshold
  for (const cat of categorySpend) {
    if (Math.abs(cat.changePercent) >= SIGNIFICANT_CHANGE_THRESHOLD) {
      const direction = cat.changePercent > 0 ? "increased" : "decreased";
      insights.push({
        severity: cat.changePercent > 0 ? "WARNING" : "POSITIVE",
        message: `Your ${cat.categoryName} spending ${direction} by ${Math.abs(
          cat.changePercent,
        ).toFixed(0)}% this month compared with last month.`,
        metric: `category_change_${cat.categoryId ?? "uncategorized"}`,
      });
    }
  }

  // Rule 2: budget usage over warning threshold
  if (budget) {
    for (const item of budget.items) {
      const spent = categorySpend.find((c) => c.categoryId === item.categoryId)?.amount ?? 0;
      const usagePct = Number(item.limit) > 0 ? (spent / Number(item.limit)) * 100 : 0;
      if (usagePct >= 100) {
        insights.push({
          severity: "WARNING",
          message: `You've exceeded your ${item.category.name} budget by ${(
            usagePct - 100
          ).toFixed(0)}%.`,
          metric: `budget_exceeded_${item.categoryId}`,
        });
      } else if (usagePct >= BUDGET_WARNING_THRESHOLD) {
        insights.push({
          severity: "WARNING",
          message: `You're approaching your ${item.category.name} budget limit — ${usagePct.toFixed(
            0,
          )}% used.`,
          metric: `budget_warning_${item.categoryId}`,
        });
      }
    }
  }

  // Rule 3: savings rate change
  if (summary.savingsRate !== summary.previousSavingsRate) {
    const improved = summary.savingsRate > summary.previousSavingsRate;
    insights.push({
      severity: improved ? "POSITIVE" : "INFORMATIONAL",
      message: `Your savings rate ${improved ? "improved" : "changed"} from ${
        summary.previousSavingsRate
      }% to ${summary.savingsRate}% this month.`,
      metric: "savings_rate_change",
    });
  }

  // Rule 4: recurring expense load
  if (recurring.length > 0) {
    const monthlyTotal = recurring.reduce((sum, r) => {
      const multiplier =
        r.frequency === "WEEKLY" ? 4.33 : r.frequency === "QUARTERLY" ? 1 / 3 : r.frequency === "YEARLY" ? 1 / 12 : 1;
      return sum + Number(r.amount) * multiplier;
    }, 0);
    insights.push({
      severity: "INFORMATIONAL",
      message: `You have ₹${Math.round(monthlyTotal).toLocaleString(
        "en-IN",
      )} in recurring expenses this month across ${recurring.length} subscriptions/bills.`,
      metric: "recurring_expense_load",
    });
  }

  // Rule 5: goal on-track projection
  for (const goal of goals) {
    if (!goal.targetDate || Number(goal.targetAmount) <= 0) continue;
    const monthsRemaining = Math.max(
      1,
      (goal.targetDate.getFullYear() - now.getFullYear()) * 12 +
        (goal.targetDate.getMonth() - now.getMonth()),
    );
    const remaining = Number(goal.targetAmount) - Number(goal.currentAmount);
    const requiredMonthly = remaining / monthsRemaining;
    if (remaining <= 0) {
      insights.push({
        severity: "POSITIVE",
        message: `You've reached your "${goal.name}" goal! 🎉`,
        metric: `goal_reached_${goal.id}`,
      });
    } else if (summary.monthlySavings >= requiredMonthly) {
      insights.push({
        severity: "POSITIVE",
        message: `At your current savings rate, you're on track to reach your "${goal.name}" goal.`,
        metric: `goal_on_track_${goal.id}`,
      });
    }
  }

  return insights;
}

/** Persists freshly generated insights, avoiding duplicate metrics for today. */
export async function refreshInsights(
  userId: string,
  options: { page?: number; pageSize?: number } = {},
) {
  const { page = 1, pageSize = 20 } = options;

  const generated = await generateInsights(userId);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const existingToday = await prisma.insight.findMany({
    where: { userId, createdAt: { gte: today } },
    select: { metric: true },
  });
  const existingMetrics = new Set(existingToday.map((i) => i.metric));

  const toCreate = generated.filter((g) => !existingMetrics.has(g.metric));

  if (toCreate.length > 0) {
    await prisma.insight.createMany({
      data: toCreate.map((g) => ({
        userId,
        severity: g.severity,
        message: g.message,
        metric: g.metric,
      })),
    });
  }

  // Paginated read, closing the previously-documented unbounded-growth gap
  // for this model (see docs/DATABASE.md). Defaults (page 1, pageSize 20)
  // exactly match the prior fixed `take: 20` behavior, so existing callers
  // that don't pass options see no change.
  const where = { userId };
  const [items, total] = await Promise.all([
    prisma.insight.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.insight.count({ where }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}
