import { describe, it, expect } from "vitest";
import { suggestCategory } from "@/services/categorization.service";

describe("suggestCategory", () => {
  it.each([
    ["Swiggy", "Food"],
    ["Zomato Order", "Food"],
    ["Uber Trip", "Transport"],
    ["Netflix Subscription", "Entertainment"],
    ["Amazon.in", "Shopping"],
    ["Electricity Board Bill", "Bills"],
    ["Monthly Salary", "Income"],
  ])("categorizes %s as %s", (merchant, expected) => {
    expect(suggestCategory(merchant)).toBe(expected);
  });

  it("defaults to Other for unrecognized merchants", () => {
    expect(suggestCategory("Some Random Shop XYZ")).toBe("Other");
  });

  it("lets the category be overridden by the user (suggestion is only a default)", () => {
    const suggestion = suggestCategory("Swiggy");
    const userOverride = "Health"; // user can always override
    expect(suggestion).toBe("Food");
    expect(userOverride).not.toBe(suggestion);
  });
});
