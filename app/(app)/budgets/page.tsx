import { requireUser } from "@/lib/auth/require-user";
import { prisma } from "@/lib/db/prisma";
import { BudgetBoard } from "@/components/budgets/budget-board";

export default async function BudgetsPage() {
  const user = await requireUser();
  const categories = await prisma.category.findMany({
    where: { userId: user.id },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return <BudgetBoard categories={categories} currency={user.currency} />;
}
