import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-session";
import { accountSchema } from "@/lib/validation/account";
import { createAccount, listAccounts } from "@/services/account.service";

export async function GET() {
  const { session, response } = await requireSession();
  if (!session) return response;
  const accounts = await listAccounts(session.userId);
  return NextResponse.json({ accounts });
}

export async function POST(req: NextRequest) {
  const { session, response } = await requireSession();
  if (!session) return response;
  const body = await req.json().catch(() => null);
  const parsed = accountSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }
  const account = await createAccount(session.userId, parsed.data);
  return NextResponse.json({ account }, { status: 201 });
}
