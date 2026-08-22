import { prisma } from "@/lib/db/prisma";
import type { RecurringPaymentInput } from "@/lib/validation/recurring";
import { addMonths, addWeeks, addYears } from "date-fns";

export async function createRecurringPayment(userId: string, input: RecurringPaymentInput) {
  return prisma.recurringPayment.create({
    data: {
      userId,
      name: input.name,
      amount: input.amount,
      frequency: input.frequency,
      categoryId: input.categoryId,
      nextDueDate: input.nextDueDate,
    },
    include: { category: true },
  });
}

export async function listRecurringPayments(userId: string) {
  return prisma.recurringPayment.findMany({
    where: { userId },
    include: { category: true },
    orderBy: { nextDueDate: "asc" },
  });
}

export async function deleteRecurringPayment(userId: string, id: string) {
  await prisma.recurringPayment.findFirstOrThrow({ where: { id, userId } });
  return prisma.recurringPayment.delete({ where: { id } });
}

export function advanceDueDate(date: Date, frequency: "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY"): Date {
  switch (frequency) {
    case "WEEKLY":
      return addWeeks(date, 1);
    case "MONTHLY":
      return addMonths(date, 1);
    case "QUARTERLY":
      return addMonths(date, 3);
    case "YEARLY":
      return addYears(date, 1);
  }
}

/** Marks payments due within the next 3 days, for the "upcoming" notification rule. */
export async function getUpcomingRecurringPayments(userId: string, withinDays = 3) {
  const now = new Date();
  const cutoff = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);
  return prisma.recurringPayment.findMany({
    where: { userId, status: "ACTIVE", nextDueDate: { gte: now, lte: cutoff } },
    include: { category: true },
  });
}
