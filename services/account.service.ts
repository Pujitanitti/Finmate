import { prisma } from "@/lib/db/prisma";
import type { AccountInput } from "@/lib/validation/account";

export async function createAccount(userId: string, input: AccountInput) {
  return prisma.account.create({
    data: { userId, name: input.name, type: input.type, balance: input.balance },
  });
}

export async function updateAccount(userId: string, accountId: string, input: AccountInput) {
  await prisma.account.findFirstOrThrow({ where: { id: accountId, userId } });
  return prisma.account.update({
    where: { id: accountId },
    data: { name: input.name, type: input.type },
  });
}

export async function deleteAccount(userId: string, accountId: string) {
  await prisma.account.findFirstOrThrow({ where: { id: accountId, userId } });
  return prisma.account.delete({ where: { id: accountId } });
}

export async function listAccounts(userId: string) {
  return prisma.account.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
}
