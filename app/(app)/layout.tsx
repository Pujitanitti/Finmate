import { requireUser } from "@/lib/auth/require-user";
import { Shell } from "@/components/layout/shell";

/**
 * Single shared layout for every protected section (dashboard, transactions,
 * budgets, goals, accounts, recurring, insights, settings).
 *
 * Previously each section had its own layout.tsx, each rendering its own
 * <Shell>. That meant every tab click unmounted the whole sidebar/topbar and
 * remounted a fresh one — re-running the auth DB query and re-initializing
 * the theme provider on every navigation. Moving all sections under this one
 * route group means React Server Components only re-render the *page*
 * segment on navigation; the Shell (and everything inside it — sidebar,
 * topbar, theme, notification bell) stays mounted the whole time.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return <Shell userName={user.name}>{children}</Shell>;
}
