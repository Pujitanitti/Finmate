import { requireUser } from "@/lib/auth/require-user";
import { getMonthSummary } from "@/services/analytics.service";
import { StatCard } from "@/components/dashboard/stat-card";
import { CashFlowChart } from "@/components/charts/cash-flow-chart";
import { SpendingBreakdown } from "@/components/charts/spending-breakdown";
import { HealthScoreCard } from "@/components/dashboard/health-score-card";
import { InsightsPreview } from "@/components/dashboard/insights-preview";
import { Card } from "@/components/ui/card";

export default async function DashboardPage() {
  // Fixed: this page previously called getSession() directly and used
  // session!.userId, trusting a session always exists. That crashed with
  // "Cannot read properties of null (reading 'userId')" instead of
  // redirecting cleanly whenever the session was actually invalid (e.g. a
  // browser cookie left over from before a database reset, pointing at a
  // user ID that no longer exists). requireUser() is the same guard every
  // other page uses — it redirects to /login itself if there's no valid
  // session, so this page can safely assume `user` is real.
  const user = await requireUser();
  const summary = await getMonthSummary(user.id);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Balance"
          value={summary.totalBalance}
          currency={user.currency}
          kind="balance"
        />
        <StatCard
          title="Monthly Income"
          value={summary.monthlyIncome}
          changePercent={summary.incomeChangePercent}
          currency={user.currency}
          kind="income"
        />
        <StatCard
          title="Monthly Expenses"
          value={summary.monthlyExpenses}
          changePercent={summary.expensesChangePercent}
          currency={user.currency}
          kind="expenses"
        />
        <StatCard
          title="Monthly Savings"
          value={summary.monthlySavings}
          changePercent={summary.savingsChangePercent}
          currency={user.currency}
          kind="savings"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <CashFlowChart currency={user.currency} />
        </Card>
        <HealthScoreCard />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h3 className="mb-4 font-medium">Spending by Category</h3>
          <SpendingBreakdown currency={user.currency} />
        </Card>
        <InsightsPreview />
      </div>
    </div>
  );
}
