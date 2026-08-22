import { describe, it, expect } from "vitest";
import { computeBudgetStatus } from "@/services/budget.service";

describe("computeBudgetStatus", () => {
  it("is HEALTHY under 80% usage", () => {
    expect(computeBudgetStatus(3000, 8000)).toBe("HEALTHY");
  });

  it("is WARNING between 80% and 100% usage", () => {
    expect(computeBudgetStatus(6500, 8000)).toBe("WARNING");
  });

  it("is EXCEEDED at or above 100% usage", () => {
    expect(computeBudgetStatus(8100, 8000)).toBe("EXCEEDED");
    expect(computeBudgetStatus(8000, 8000)).toBe("EXCEEDED");
  });

  it("treats a zero limit as HEALTHY (no budget set)", () => {
    expect(computeBudgetStatus(500, 0)).toBe("HEALTHY");
  });
});
