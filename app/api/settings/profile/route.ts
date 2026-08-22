import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/require-session";
import { prisma } from "@/lib/db/prisma";

const schema = z.object({ name: z.string().trim().min(2).max(80) });

export async function PATCH(req: NextRequest) {
  const { session, response } = await requireSession();
  if (!session) return response;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid name" }, { status: 400 });
  const user = await prisma.user.update({
    where: { id: session.userId },
    data: { name: parsed.data.name },
  });
  return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email } });
}
