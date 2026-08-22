import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-session";
import { getCashFlow, type CashFlowRange } from "@/services/analytics.service";

export async function GET(req: NextRequest) {
  const { session, response } = await requireSession();
  if (!session) return response;
  const range = (req.nextUrl.searchParams.get("range") as CashFlowRange) ?? "30d";
  const data = await getCashFlow(session.userId, range);
  return NextResponse.json({ data });
}
