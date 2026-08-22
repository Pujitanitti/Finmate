import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-session";
import { budgetSchema } from "@/lib/validation/budget";
import { getBudgetForMonth, upsertBudget } from "@/services/budget.service";

export async function GET(req: NextRequest) {
  const { session, response } = await requireSession();
  if (!session) return response;
  const params = req.nextUrl.searchParams;
  const now = new Date();
  const month = Number(params.get("month") ?? now.getMonth() + 1);
  const year = Number(params.get("year") ?? now.getFullYear());
  const budget = await getBudgetForMonth(session.userId, month, year);
  return NextResponse.json({ budget });
}

export async function POST(req: NextRequest) {
  const { session, response } = await requireSession();
  if (!session) return response;
  const body = await req.json().catch(() => null);
  const parsed = budgetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }
  const budget = await upsertBudget(session.userId, parsed.data);
  return NextResponse.json({ budget }, { status: 201 });
}
