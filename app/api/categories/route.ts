import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/require-session";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const { session, response } = await requireSession();
  if (!session) return response;
  const categories = await prisma.category.findMany({
    where: { userId: session.userId },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ categories });
}

const schema = z.object({ name: z.string().trim().min(1).max(50), color: z.string().optional() });

export async function POST(req: NextRequest) {
  const { session, response } = await requireSession();
  if (!session) return response;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  const category = await prisma.category.create({
    data: { userId: session.userId, name: parsed.data.name, color: parsed.data.color },
  });
  return NextResponse.json({ category }, { status: 201 });
}
