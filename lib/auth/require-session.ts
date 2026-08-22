import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";

/** Guard used at the top of every protected route handler. */
export async function requireSession() {
  const session = await getSession();
  if (!session) {
    return { session: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { session, response: null };
}
