import { prisma } from "@/lib/db/prisma";
import type { TransactionInput } from "@/lib/validation/transaction";
import { Prisma, TransactionType } from "@prisma/client";

export interface TransactionFilters {
  search?: string;
  categoryId?: string;
  accountId?: string;
  type?: TransactionType;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
  sortBy?: "date" | "amount";
  sortDir?: "asc" | "desc";
}

/** Applies a signed delta to an account's balance. Runs inside the caller's transaction. */
async function adjustAccountBalance(
  tx: Prisma.TransactionClient,
  accountId: string,
  delta: number,
) {
  await tx.account.update({
    where: { id: accountId },
    data: { balance: { increment: delta } },
  });
}

function signedAmount(type: TransactionType, amount: number): number {
  return type === "EXPENSE" ? -Math.abs(amount) : Math.abs(amount);
}

export async function createTransaction(userId: string, input: TransactionInput) {
  return prisma.$transaction(async (tx) => {
    const txn = await tx.transaction.create({
      data: {
        userId,
        accountId: input.accountId,
        categoryId: input.categoryId ?? null,
        merchant: input.merchant,
        amount: input.amount,
        type: input.type,
        notes: input.notes ?? null,
        date: input.date,
        tags: input.tags?.length
          ? {
              create: await Promise.all(
                input.tags.map(async (name) => {
                  const tag = await tx.tag.upsert({
                    where: { userId_name: { userId, name } },
                    update: {},
                    create: { userId, name },
                  });
                  return { tagId: tag.id };
                }),
              ),
            }
          : undefined,
      },
      include: { category: true, tags: { include: { tag: true } } },
    });

    await adjustAccountBalance(tx, input.accountId, signedAmount(input.type, input.amount));

    return txn;
  });
}

export async function updateTransaction(
  userId: string,
  transactionId: string,
  input: TransactionInput,
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.transaction.findFirstOrThrow({
      where: { id: transactionId, userId },
    });

    // Reverse old balance effect, apply new one (handles account changes too)
    await adjustAccountBalance(
      tx,
      existing.accountId,
      -signedAmount(existing.type, Number(existing.amount)),
    );
    await adjustAccountBalance(tx, input.accountId, signedAmount(input.type, input.amount));

    return tx.transaction.update({
      where: { id: transactionId },
      data: {
        accountId: input.accountId,
        categoryId: input.categoryId ?? null,
        merchant: input.merchant,
        amount: input.amount,
        type: input.type,
        notes: input.notes ?? null,
        date: input.date,
      },
      include: { category: true },
    });
  });
}

export async function deleteTransaction(userId: string, transactionId: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.transaction.findFirstOrThrow({
      where: { id: transactionId, userId },
    });
    await adjustAccountBalance(
      tx,
      existing.accountId,
      -signedAmount(existing.type, Number(existing.amount)),
    );
    return tx.transaction.delete({ where: { id: transactionId } });
  });
}

export async function listTransactions(userId: string, filters: TransactionFilters = {}) {
  const {
    search,
    categoryId,
    accountId,
    type,
    from,
    to,
    page = 1,
    pageSize = 20,
    sortBy = "date",
    sortDir = "desc",
  } = filters;

  const where: Prisma.TransactionWhereInput = {
    userId,
    ...(search ? { merchant: { contains: search, mode: "insensitive" } } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(accountId ? { accountId } : {}),
    ...(type ? { type } : {}),
    ...(from || to
      ? { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: { category: true, account: true, tags: { include: { tag: true } } },
      orderBy: { [sortBy]: sortDir },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.transaction.count({ where }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}
