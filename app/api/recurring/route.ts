import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-session";
import { recurringPaymentSchema } from "@/lib/validation/recurring";
import { createRecurringPayment, listRecurringPayments } from "@/services/recurring.service";

export async function GET() {
  const { session, response } = await requireSession();
  if (!session) return response;
  const payments = await listRecurringPayments(session.userId);
  return NextResponse.json({ payments });
}

export async function POST(req: NextRequest) {
  const { session, response } = await requireSession();
  if (!session) return response;
  const body = await req.json().catch(() => null);
  const parsed = recurringPaymentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }
  const payment = await createRecurringPayment(session.userId, parsed.data);
  return NextResponse.json({ payment }, { status: 201 });
}
