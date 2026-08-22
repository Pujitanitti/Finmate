import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/require-session";
import { prisma } from "@/lib/db/prisma";

const schema = z.object({
  theme: z.enum(["light", "dark", "system"]).optional(),
  currency: z.string().optional(),
  notifyBudgetWarning: z.boolean().optional(),
  notifyGoalMilestone: z.boolean().optional(),
  notifyRecurring: z.boolean().optional(),
  notifyMonthlySummary: z.boolean().optional(),
});

export async function PATCH(req: NextRequest) {
  const { session, response } = await requireSession();
  if (!session) return response;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const preference = await prisma.userPreference.upsert({
    where: { userId: session.userId },
    update: parsed.data,
    create: { userId: session.userId, ...parsed.data },
  });

  if (parsed.data.currency) {
    await prisma.user.update({
      where: { id: session.userId },
      data: { currency: parsed.data.currency },
    });
  }

  return NextResponse.json({ preference });
}
