import { test, expect } from "@playwright/test";

/**
 * End-to-end flow covering the core product loop:
 * Register → Login → Create account → Add transaction → Create budget
 * → Create goal → Open dashboard → Verify analytics
 *
 * Run with: npm run test:e2e (requires a local Postgres instance —
 * see docker-compose.yml — and `npm run db:migrate` applied first).
 */
test.describe("FinMate core user flow", () => {
  const uniqueEmail = `e2e-${Date.now()}@finmate.test`;
  const password = "TestPass123";

  test("full journey from registration to dashboard analytics", async ({ page }) => {
    // Register
    await page.goto("/register");
    await page.getByLabel("Name").fill("E2E Test User");
    await page.getByLabel("Email").fill(uniqueEmail);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: /get started/i }).click();

    // Onboarding
    await expect(page).toHaveURL(/\/onboarding/);
    await page.getByRole("button", { name: /continue/i }).click(); // step 0 -> 1
    await page.getByLabel(/monthly income/i).fill("65000");
    await page.getByRole("button", { name: /continue/i }).click(); // -> 2
    await page.getByText("Save money").click();
    await page.getByRole("button", { name: /continue/i }).click(); // -> 3
    await page.getByRole("button", { name: /go to dashboard/i }).click();

    // Dashboard loads
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText("Total Balance")).toBeVisible();

    // Create an account
    await page.goto("/accounts");
    await page.getByRole("button", { name: /add account/i }).click();
    await page.getByLabel(/account name/i).fill("Test Savings");
    await page.getByLabel(/starting balance/i).fill("10000");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Test Savings")).toBeVisible();

    // Add a transaction
    await page.goto("/transactions");
    await page.getByRole("button", { name: /add/i }).click();
    await page.getByLabel(/merchant/i).fill("Swiggy");
    await page.getByLabel(/amount/i).fill("450");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Swiggy")).toBeVisible();

    // Create a budget
    await page.goto("/budgets");
    await page.getByRole("button", { name: /set category budget/i }).click();
    await page.getByLabel(/monthly limit/i).fill("8000");
    await page.getByRole("button", { name: "Save" }).click();

    // Create a goal
    await page.goto("/goals");
    await page.getByRole("button", { name: /new goal/i }).click();
    await page.getByLabel(/goal name/i).fill("Emergency Fund");
    await page.getByLabel(/target amount/i).fill("50000");
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByText("Emergency Fund")).toBeVisible();

    // Back to dashboard, verify analytics reflect real data
    await page.goto("/dashboard");
    await expect(page.getByText("Monthly Expenses")).toBeVisible();
    await expect(page.getByText("Financial Health")).toBeVisible();
  });
});
