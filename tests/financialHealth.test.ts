import { describe, it, expect } from "vitest";
import { computeFinancialHealthScore } from "@/services/financialHealth.service";

describe("computeFinancialHealthScore", () => {
  it("returns 100 for a perfect financial profile", () => {
    const result = computeFinancialHealthScore({
      savingsRate: 30,
      budgetAdherence: 100,
      spendingConsistency: 100,
      goalProgress: 100,
      recurringExpenseRatio: 0,
    });
    expect(result.score).toBe(100);
  });

  it("returns 0 for a poor financial profile", () => {
    const result = computeFinancialHealthScore({
      savingsRate: 0,
      budgetAdherence: 0,
      spendingConsistency: 0,
      goalProgress: 0,
      recurringExpenseRatio: 1,
    });
    expect(result.score).toBe(0);
  });

  it("caps savings rate contribution at the weight for the factor", () => {
    const result = computeFinancialHealthScore({
      savingsRate: 60, // above the 30% "full points" threshold
      budgetAdherence: 0,
      spendingConsistency: 0,
      goalProgress: 0,
      recurringExpenseRatio: 1,
    });
    const savingsItem = result.breakdown.find((b) => b.label === "Savings Rate")!;
    expect(savingsItem.scoreContribution).toBe(savingsItem.maxContribution);
  });

  it("breakdown contributions always sum to the total score", () => {
    const result = computeFinancialHealthScore({
      savingsRate: 18,
      budgetAdherence: 70,
      spendingConsistency: 55,
      goalProgress: 40,
      recurringExpenseRatio: 0.25,
    });
    const sum = result.breakdown.reduce((s, b) => s + b.scoreContribution, 0);
    expect(sum).toBe(result.score);
  });
});
