/** Maps a pathname prefix to a human page title. Used by Topbar and PageTransition. */
export const ROUTE_TITLES: { prefix: string; title: string }[] = [
  { prefix: "/dashboard", title: "Dashboard" },
  { prefix: "/transactions", title: "Transactions" },
  { prefix: "/budgets", title: "Budgets" },
  { prefix: "/goals", title: "Goals" },
  { prefix: "/accounts", title: "Accounts" },
  { prefix: "/recurring", title: "Recurring" },
  { prefix: "/insights", title: "Insights" },
  { prefix: "/settings", title: "Settings" },
];

export function titleForPath(pathname: string): string {
  return ROUTE_TITLES.find((r) => pathname.startsWith(r.prefix))?.title ?? "FinMate";
}
