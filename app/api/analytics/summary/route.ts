import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-session";
import { getMonthSummary } from "@/services/analytics.service";

export async function GET() {
  const { session, response } = await requireSession();
  if (!session) return response;
  const summary = await getMonthSummary(session.userId);
  return NextResponse.json({ summary });
}
