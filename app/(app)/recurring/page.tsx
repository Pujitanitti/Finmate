import { requireUser } from "@/lib/auth/require-user";
import { prisma } from "@/lib/db/prisma";
import { RecurringBoard } from "@/components/recurring/recurring-board";

export default async function RecurringPage() {
  const user = await requireUser();
  const categories = await prisma.category.findMany({
    where: { userId: user.id },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return <RecurringBoard currency={user.currency} categories={categories} />;
}
