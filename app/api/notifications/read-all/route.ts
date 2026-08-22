import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-session";
import { markAllAsRead } from "@/services/notification.service";

export async function POST() {
  const { session, response } = await requireSession();
  if (!session) return response;
  await markAllAsRead(session.userId);
  return NextResponse.json({ success: true });
}
