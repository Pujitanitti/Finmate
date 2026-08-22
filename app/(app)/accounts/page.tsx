import { requireUser } from "@/lib/auth/require-user";
import { AccountsBoard } from "@/components/accounts/accounts-board";

export default async function AccountsPage() {
  const user = await requireUser();
  return <AccountsBoard currency={user.currency} />;
}
