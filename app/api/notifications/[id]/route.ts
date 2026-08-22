import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-session";
import { markAsRead } from "@/services/notification.service";

export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireSession();
  if (!session) return response;
  const { id } = await params;
  const notification = await markAsRead(session.userId, id);
  return NextResponse.json({ notification });
}
