/**
 * Verifies the single most important security property in this codebase:
 * one user cannot read or modify another user's financial data, even when
 * given a valid resource ID belonging to someone else. This was previously
 * enforced only by code (findFirstOrThrow scoped by userId in every service
 * function) and never verified by a test — see docs/TESTING.md P0.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { registerUser } from "@/services/auth.service";
import { createTransaction, updateTransaction, deleteTransaction } from "@/services/transaction.service";
import { createGoal, updateGoal, deleteGoal, addContribution } from "@/services/goal.service";
import { createAccount } from "@/services/account.service";

const RUN_ID = Date.now();
let userA: { id: string };
let userB: { id: string };
let accountA: { id: string };

beforeAll(async () => {
  userA = await registerUser({
    name: "User A",
    email: `owner-a-${RUN_ID}@finmate.test`,
    password: "TestPass123",
  });
  userB = await registerUser({
    name: "User B",
    email: `owner-b-${RUN_ID}@finmate.test`,
    password: "TestPass123",
  });
  accountA = await createAccount(userA.id, { name: "A's Account", type: "BANK", balance: 1000 });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
  await prisma.$disconnect();
});

describe("cross-user data isolation — transactions", () => {
  it("prevents user B from updating user A's transaction", async () => {
    const category = await prisma.category.findFirstOrThrow({ where: { userId: userA.id } });
    const txn = await createTransaction(userA.id, {
      merchant: "A's Coffee",
      amount: 100,
      type: "EXPENSE",
      accountId: accountA.id,
      categoryId: category.id,
      date: new Date(),
      tags: [],
    });

    await expect(
      updateTransaction(userB.id, txn.id, {
        merchant: "Hijacked",
        amount: 999999,
        type: "EXPENSE",
        accountId: accountA.id,
        categoryId: category.id,
        date: new Date(),
        tags: [],
      }),
    ).rejects.toThrow();

    // Confirm it genuinely wasn't modified.
    const unchanged = await prisma.transaction.findUniqueOrThrow({ where: { id: txn.id } });
    expect(unchanged.merchant).toBe("A's Coffee");
    expect(Number(unchanged.amount)).toBe(100);
  });

  it("prevents user B from deleting user A's transaction", async () => {
    const category = await prisma.category.findFirstOrThrow({ where: { userId: userA.id } });
    const txn = await createTransaction(userA.id, {
      merchant: "A's Groceries",
      amount: 50,
      type: "EXPENSE",
      accountId: accountA.id,
      categoryId: category.id,
      date: new Date(),
      tags: [],
    });

    await expect(deleteTransaction(userB.id, txn.id)).rejects.toThrow();

    const stillExists = await prisma.transaction.findUnique({ where: { id: txn.id } });
    expect(stillExists).not.toBeNull();
  });
});

describe("cross-user data isolation — goals", () => {
  it("prevents user B from updating, contributing to, or deleting user A's goal", async () => {
    const goal = await createGoal(userA.id, { name: "A's Emergency Fund", targetAmount: 10000 });

    await expect(
      updateGoal(userB.id, goal.id, { name: "Hijacked Goal", targetAmount: 1 }),
    ).rejects.toThrow();

    await expect(
      addContribution(userB.id, goal.id, { amount: 5000 }),
    ).rejects.toThrow();

    await expect(deleteGoal(userB.id, goal.id)).rejects.toThrow();

    const unchanged = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });
    expect(unchanged.name).toBe("A's Emergency Fund");
    expect(Number(unchanged.currentAmount)).toBe(0);
  });

  it("allows the owning user to modify their own goal normally", async () => {
    const goal = await createGoal(userA.id, { name: "A's Vacation Fund", targetAmount: 5000 });
    const updated = await updateGoal(userA.id, goal.id, { name: "A's Updated Vacation Fund", targetAmount: 6000 });
    expect(updated.name).toBe("A's Updated Vacation Fund");
  });
});

describe("goal contribution atomicity", () => {
  it("correctly accumulates concurrent contributions without losing an update", async () => {
    const goal = await createGoal(userA.id, { name: "Concurrency Test Goal", targetAmount: 100000 });

    // Fire 10 concurrent contributions of 100 each. With the atomic
    // `{ increment }` fix, all 10 must be reflected — a read-then-write
    // implementation would be expected to lose some of these under real
    // concurrency.
    await Promise.all(
      Array.from({ length: 10 }).map(() => addContribution(userA.id, goal.id, { amount: 100 })),
    );

    const final = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });
    expect(Number(final.currentAmount)).toBe(1000);
  });
});
