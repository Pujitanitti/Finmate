import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-session";
import { getSpendingByCategory } from "@/services/analytics.service";

export async function GET() {
  const { session, response } = await requireSession();
  if (!session) return response;
  const data = await getSpendingByCategory(session.userId);
  return NextResponse.json({ data });
}
