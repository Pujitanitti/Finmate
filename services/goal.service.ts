import { prisma } from "@/lib/db/prisma";
import type { ContributionInput, GoalInput } from "@/lib/validation/goal";

export async function createGoal(userId: string, input: GoalInput) {
  return prisma.goal.create({
    data: {
      userId,
      name: input.name,
      targetAmount: input.targetAmount,
      targetDate: input.targetDate ?? null,
    },
  });
}

export async function updateGoal(userId: string, goalId: string, input: GoalInput) {
  await prisma.goal.findFirstOrThrow({ where: { id: goalId, userId } });
  return prisma.goal.update({
    where: { id: goalId },
    data: {
      name: input.name,
      targetAmount: input.targetAmount,
      targetDate: input.targetDate ?? null,
    },
  });
}

export async function deleteGoal(userId: string, goalId: string) {
  await prisma.goal.findFirstOrThrow({ where: { id: goalId, userId } });
  return prisma.goal.delete({ where: { id: goalId } });
}

export async function addContribution(
  userId: string,
  goalId: string,
  input: ContributionInput,
) {
  // Ownership check only — does NOT read currentAmount for use in the write
  // below. The actual increment happens atomically at the database layer via
  // Prisma's `{ increment }` syntax inside the same $transaction as the
  // contribution row insert, so two concurrent contributions to the same
  // goal can never silently overwrite one another (the previous read-then-
  // write pattern here was a real, documented race condition — see
  // docs/ROADMAP.md item 9 and docs/DATABASE_INTERVIEW.md Q25/Q26).
  await prisma.goal.findFirstOrThrow({ where: { id: goalId, userId } });

  return prisma.$transaction(async (tx) => {
    const contribution = await tx.goalContribution.create({
      data: { goalId, amount: input.amount, note: input.note ?? null },
    });

    await tx.goal.update({
      where: { id: goalId },
      data: { currentAmount: { increment: input.amount } },
    });

    return contribution;
  });
}

export function computeGoalProgress(currentAmount: number, targetAmount: number): number {
  if (targetAmount <= 0) return 0;
  return Math.min(100, Math.round((currentAmount / targetAmount) * 100));
}

/**
 * Projects whether the goal is on track given the average monthly
 * contribution rate over the last 3 months of contributions.
 */
export function isGoalOnTrack(
  currentAmount: number,
  targetAmount: number,
  targetDate: Date | null,
  monthlyContributionRate: number,
): boolean | null {
  if (!targetDate || monthlyContributionRate <= 0) return null;
  const monthsRemaining = Math.max(
    0,
    (targetDate.getFullYear() - new Date().getFullYear()) * 12 +
      (targetDate.getMonth() - new Date().getMonth()),
  );
  const projected = currentAmount + monthlyContributionRate * monthsRemaining;
  return projected >= targetAmount;
}

export async function listGoalsWithProgress(userId: string) {
  const goals = await prisma.goal.findMany({
    where: { userId },
    include: { contributions: { orderBy: { date: "desc" }, take: 6 } },
    orderBy: { createdAt: "desc" },
  });

  return goals.map((goal) => {
    const avgMonthly =
      goal.contributions.length > 0
        ? goal.contributions.reduce((s, c) => s + Number(c.amount), 0) /
          Math.max(1, goal.contributions.length)
        : 0;

    return {
      ...goal,
      progress: computeGoalProgress(Number(goal.currentAmount), Number(goal.targetAmount)),
      onTrack: isGoalOnTrack(
        Number(goal.currentAmount),
        Number(goal.targetAmount),
        goal.targetDate,
        avgMonthly,
      ),
    };
  });
}
