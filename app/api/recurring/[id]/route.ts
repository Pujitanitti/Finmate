import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-session";
import { deleteRecurringPayment } from "@/services/recurring.service";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireSession();
  if (!session) return response;
  const { id } = await params;
  await deleteRecurringPayment(session.userId, id);
  return NextResponse.json({ success: true });
}
