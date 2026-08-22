import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-session";
import { refreshNotifications } from "@/services/notification.service";

export async function GET(req: NextRequest) {
  const { session, response } = await requireSession();
  if (!session) return response;

  const params = req.nextUrl.searchParams;
  const page = params.has("page") ? Number(params.get("page")) : undefined;
  const pageSize = params.has("pageSize") ? Number(params.get("pageSize")) : undefined;

  const result = await refreshNotifications(session.userId, { page, pageSize });

  // "notifications" stays the array field for backward compatibility with
  // the existing NotificationBell component; pagination metadata is
  // additionally exposed for any future caller that wants it.
  return NextResponse.json({
    notifications: result.items,
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
    totalPages: result.totalPages,
  });
}
