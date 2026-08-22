import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/require-session";
import { prisma } from "@/lib/db/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).regex(/[A-Z]/).regex(/[0-9]/),
});

export async function PATCH(req: NextRequest) {
  const { session, response } = await requireSession();
  if (!session) return response;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Password does not meet requirements" }, { status: 400 });
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.userId } });
  const valid = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);
  // Bump sessionVersion in the same update as the password change — any
  // other outstanding token issued before this moment (e.g. one on a lost
  // device, or a stolen token) is instantly invalidated on its next request,
  // closing the previously-documented gap where a password change did not
  // revoke existing sessions.
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, sessionVersion: { increment: 1 } },
  });

  // Re-issue a fresh session for the browser making this request, using the
  // new sessionVersion, so the user isn't logged out of their own change.
  await createSession({
    userId: updated.id,
    email: updated.email,
    sessionVersion: updated.sessionVersion,
  });

  return NextResponse.json({ success: true });
}
