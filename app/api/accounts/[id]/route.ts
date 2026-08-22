import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-session";
import { accountSchema } from "@/lib/validation/account";
import { deleteAccount, updateAccount } from "@/services/account.service";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireSession();
  if (!session) return response;
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = accountSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }
  const account = await updateAccount(session.userId, id, parsed.data);
  return NextResponse.json({ account });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireSession();
  if (!session) return response;
  const { id } = await params;
  await deleteAccount(session.userId, id);
  return NextResponse.json({ success: true });
}
