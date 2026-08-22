import { describe, it, expect } from "vitest";
import { computeGoalProgress, isGoalOnTrack } from "@/services/goal.service";

describe("computeGoalProgress", () => {
  it("computes percentage funded, capped at 100", () => {
    expect(computeGoalProgress(5000, 10000)).toBe(50);
    expect(computeGoalProgress(12000, 10000)).toBe(100);
  });

  it("returns 0 for a zero target", () => {
    expect(computeGoalProgress(500, 0)).toBe(0);
  });
});

describe("isGoalOnTrack", () => {
  it("returns null when there is no target date or contribution rate", () => {
    expect(isGoalOnTrack(1000, 10000, null, 500)).toBeNull();
    expect(isGoalOnTrack(1000, 10000, new Date(), 0)).toBeNull();
  });

  it("returns true when projected contributions reach the target", () => {
    const targetDate = new Date();
    targetDate.setMonth(targetDate.getMonth() + 6);
    expect(isGoalOnTrack(1000, 7000, targetDate, 1500)).toBe(true);
  });

  it("returns false when projected contributions fall short", () => {
    const targetDate = new Date();
    targetDate.setMonth(targetDate.getMonth() + 2);
    expect(isGoalOnTrack(1000, 50000, targetDate, 500)).toBe(false);
  });
});
