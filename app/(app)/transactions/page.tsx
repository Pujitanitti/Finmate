import { requireUser } from "@/lib/auth/require-user";
import { prisma } from "@/lib/db/prisma";
import { TransactionsTable } from "@/components/transactions/transactions-table";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ categoryId?: string }>;
}) {
  const user = await requireUser();
  const { categoryId } = await searchParams;

  const [accounts, categories] = await Promise.all([
    prisma.account.findMany({ where: { userId: user.id }, select: { id: true, name: true } }),
    prisma.category.findMany({ where: { userId: user.id }, select: { id: true, name: true } }),
  ]);

  return (
    <TransactionsTable
      accounts={accounts}
      categories={categories}
      currency={user.currency}
      initialCategoryId={categoryId}
    />
  );
}
