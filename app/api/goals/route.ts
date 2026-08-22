import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-session";
import { goalSchema } from "@/lib/validation/goal";
import { createGoal, listGoalsWithProgress } from "@/services/goal.service";

export async function GET() {
  const { session, response } = await requireSession();
  if (!session) return response;
  const goals = await listGoalsWithProgress(session.userId);
  return NextResponse.json({ goals });
}

export async function POST(req: NextRequest) {
  const { session, response } = await requireSession();
  if (!session) return response;
  const body = await req.json().catch(() => null);
  const parsed = goalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }
  const goal = await createGoal(session.userId, parsed.data);
  return NextResponse.json({ goal }, { status: 201 });
}
