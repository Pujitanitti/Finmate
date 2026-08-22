import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

const schema = z.object({
  monthlyIncome: z.number().min(0),
  goals: z.array(z.string()).default([]),
  currency: z.string().default("INR"),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.userId },
    data: {
      monthlyIncome: parsed.data.monthlyIncome,
      currency: parsed.data.currency,
      onboarded: true,
      preference: {
        upsert: {
          create: { currency: parsed.data.currency },
          update: { currency: parsed.data.currency },
        },
      },
    },
  });

  // Seed goal placeholders from selected onboarding goals
  if (parsed.data.goals.length > 0) {
    await prisma.goal.createMany({
      data: parsed.data.goals.map((name) => ({
        userId: session.userId,
        name,
        targetAmount: 0,
        currentAmount: 0,
      })),
    });
  }

  return NextResponse.json({ success: true });
}
