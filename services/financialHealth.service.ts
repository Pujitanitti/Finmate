/**
 * Transparent 0-100 Financial Health Score.
 * Weighted composite of five factors — every point is explainable.
 */

export interface FinancialHealthInputs {
  savingsRate: number; // % of income saved this month (can be negative)
  budgetAdherence: number; // 0-100, % of budgeted categories within limit
  spendingConsistency: number; // 0-100, higher = less month-to-month volatility
  goalProgress: number; // 0-100, average progress across active goals
  recurringExpenseRatio: number; // recurring expenses / monthly income, 0-1+
}

export interface FinancialHealthBreakdownItem {
  label: string;
  weight: number;
  rawValue: number;
  scoreContribution: number;
  maxContribution: number;
}

export interface FinancialHealthResult {
  score: number;
  breakdown: FinancialHealthBreakdownItem[];
}

const WEIGHTS = {
  savingsRate: 30,
  budgetAdherence: 25,
  spendingConsistency: 15,
  goalProgress: 15,
  recurringExpenseRatio: 15,
};

function clamp(n: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, n));
}

export function computeFinancialHealthScore(
  inputs: FinancialHealthInputs,
): FinancialHealthResult {
  // Savings rate: 0% → 0 points, 30%+ → full points
  const savingsScore = clamp((inputs.savingsRate / 30) * 100);

  // Budget adherence: already 0-100
  const budgetScore = clamp(inputs.budgetAdherence);

  // Spending consistency: already 0-100
  const consistencyScore = clamp(inputs.spendingConsistency);

  // Goal progress: already 0-100
  const goalScore = clamp(inputs.goalProgress);

  // Recurring expense ratio: 0% of income → full points, 50%+ → 0 points
  const recurringScore = clamp(100 - (inputs.recurringExpenseRatio / 0.5) * 100);

  const breakdown: FinancialHealthBreakdownItem[] = [
    {
      label: "Savings Rate",
      weight: WEIGHTS.savingsRate,
      rawValue: inputs.savingsRate,
      scoreContribution: Math.round((savingsScore / 100) * WEIGHTS.savingsRate),
      maxContribution: WEIGHTS.savingsRate,
    },
    {
      label: "Budget Adherence",
      weight: WEIGHTS.budgetAdherence,
      rawValue: inputs.budgetAdherence,
      scoreContribution: Math.round((budgetScore / 100) * WEIGHTS.budgetAdherence),
      maxContribution: WEIGHTS.budgetAdherence,
    },
    {
      label: "Spending Consistency",
      weight: WEIGHTS.spendingConsistency,
      rawValue: inputs.spendingConsistency,
      scoreContribution: Math.round(
        (consistencyScore / 100) * WEIGHTS.spendingConsistency,
      ),
      maxContribution: WEIGHTS.spendingConsistency,
    },
    {
      label: "Goal Progress",
      weight: WEIGHTS.goalProgress,
      rawValue: inputs.goalProgress,
      scoreContribution: Math.round((goalScore / 100) * WEIGHTS.goalProgress),
      maxContribution: WEIGHTS.goalProgress,
    },
    {
      label: "Recurring Expense Ratio",
      weight: WEIGHTS.recurringExpenseRatio,
      rawValue: inputs.recurringExpenseRatio,
      scoreContribution: Math.round(
        (recurringScore / 100) * WEIGHTS.recurringExpenseRatio,
      ),
      maxContribution: WEIGHTS.recurringExpenseRatio,
    },
  ];

  const score = breakdown.reduce((sum, item) => sum + item.scoreContribution, 0);

  return { score: clamp(score, 0, 100), breakdown };
}
