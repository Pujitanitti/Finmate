import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-session";
import { transactionSchema } from "@/lib/validation/transaction";
import { createTransaction, listTransactions } from "@/services/transaction.service";

export async function GET(req: NextRequest) {
  const { session, response } = await requireSession();
  if (!session) return response;

  const params = req.nextUrl.searchParams;
  const result = await listTransactions(session.userId, {
    search: params.get("search") ?? undefined,
    categoryId: params.get("categoryId") ?? undefined,
    accountId: params.get("accountId") ?? undefined,
    type: (params.get("type") as any) ?? undefined,
    page: Number(params.get("page") ?? 1),
    pageSize: Number(params.get("pageSize") ?? 20),
  });
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const { session, response } = await requireSession();
  if (!session) return response;

  const body = await req.json().catch(() => null);
  const parsed = transactionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  const txn = await createTransaction(session.userId, parsed.data);
  return NextResponse.json({ transaction: txn }, { status: 201 });
}
