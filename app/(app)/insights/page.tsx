import { requireUser } from "@/lib/auth/require-user";
import { InsightsList } from "@/components/insights/insights-list";

export default async function InsightsPage() {
  await requireUser();
  return <InsightsList />;
}
