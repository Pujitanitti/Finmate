import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-session";
import { goalSchema } from "@/lib/validation/goal";
import { deleteGoal, updateGoal } from "@/services/goal.service";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireSession();
  if (!session) return response;
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = goalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }
  const goal = await updateGoal(session.userId, id, parsed.data);
  return NextResponse.json({ goal });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireSession();
  if (!session) return response;
  const { id } = await params;
  await deleteGoal(session.userId, id);
  return NextResponse.json({ success: true });
}
