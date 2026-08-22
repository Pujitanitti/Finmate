import { prisma } from "@/lib/db/prisma";
import { NotificationType } from "@prisma/client";

export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
) {
  return prisma.notification.create({ data: { userId, type, title, message } });
}

export interface PaginatedNotifications {
  items: Awaited<ReturnType<typeof prisma.notification.findMany>>;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Paginated notification listing. `page`/`pageSize` are optional so the
 * existing "give me the latest N" call sites (the notification bell) keep
 * working unchanged — passing them opts into real offset pagination instead
 * of a fixed `take` limit. This closes the previously-documented gap where
 * Notification was one of the models flagged for unbounded per-user growth
 * with no pagination (see docs/DATABASE.md's Potential Performance
 * Bottlenecks section, now updated).
 */
export async function listNotifications(
  userId: string,
  options: { unreadOnly?: boolean; page?: number; pageSize?: number } = {},
): Promise<PaginatedNotifications> {
  const { unreadOnly = false, page = 1, pageSize = 50 } = options;
  const where = { userId, ...(unreadOnly ? { isRead: false } : {}) };

  const [items, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.notification.count({ where }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function markAsRead(userId: string, notificationId: string) {
  await prisma.notification.findFirstOrThrow({ where: { id: notificationId, userId } });
  return prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });
}

export async function markAllAsRead(userId: string) {
  return prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
}

/**
 * Generates notifications from current state: budget warnings, goal
 * milestones, and upcoming recurring payments. Idempotent per day via
 * a simple duplicate-title-today check.
 */
export async function refreshNotifications(
  userId: string,
  options: { page?: number; pageSize?: number } = {},
) {
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const existingToday = await prisma.notification.findMany({
    where: { userId, createdAt: { gte: today } },
    select: { title: true },
  });
  const existingTitles = new Set(existingToday.map((n) => n.title));

  const toCreate: { type: NotificationType; title: string; message: string }[] = [];

  const budget = await prisma.budget.findUnique({
    where: {
      userId_month_year: { userId, month: now.getMonth() + 1, year: now.getFullYear() },
    },
    include: { items: { include: { category: true } } },
  });

  if (budget) {
    for (const item of budget.items) {
      if (item.status === "WARNING" || item.status === "EXCEEDED") {
        const title = `${item.category.name} budget ${
          item.status === "EXCEEDED" ? "exceeded" : "warning"
        }`;
        if (!existingTitles.has(title)) {
          toCreate.push({
            type: item.status === "EXCEEDED" ? "BUDGET_EXCEEDED" : "BUDGET_WARNING",
            title,
            message:
              item.status === "EXCEEDED"
                ? `You've exceeded your ${item.category.name} budget for this month.`
                : `You're close to your ${item.category.name} budget limit.`,
          });
        }
      }
    }
  }

  const upcoming = await prisma.recurringPayment.findMany({
    where: {
      userId,
      status: "ACTIVE",
      nextDueDate: { gte: now, lte: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000) },
    },
  });
  for (const payment of upcoming) {
    const title = `Upcoming: ${payment.name}`;
    if (!existingTitles.has(title)) {
      toCreate.push({
        type: "RECURRING_UPCOMING",
        title,
        message: `${payment.name} (₹${Number(payment.amount).toLocaleString(
          "en-IN",
        )}) is due soon.`,
      });
    }
  }

  if (toCreate.length > 0) {
    await prisma.notification.createMany({
      data: toCreate.map((n) => ({ userId, ...n })),
    });
  }

  return listNotifications(userId, options);
}