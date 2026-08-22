import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-session";
import { transactionSchema } from "@/lib/validation/transaction";
import { deleteTransaction, updateTransaction } from "@/services/transaction.service";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireSession();
  if (!session) return response;
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = transactionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  const txn = await updateTransaction(session.userId, id, parsed.data);
  return NextResponse.json({ transaction: txn });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireSession();
  if (!session) return response;
  const { id } = await params;
  await deleteTransaction(session.userId, id);
  return NextResponse.json({ success: true });
}
