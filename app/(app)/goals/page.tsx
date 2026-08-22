import { requireUser } from "@/lib/auth/require-user";
import { GoalsBoard } from "@/components/goals/goals-board";

export default async function GoalsPage() {
  const user = await requireUser();
  return <GoalsBoard currency={user.currency} />;
}
