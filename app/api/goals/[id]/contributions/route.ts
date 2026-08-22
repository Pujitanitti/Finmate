import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-session";
import { contributionSchema } from "@/lib/validation/goal";
import { addContribution } from "@/services/goal.service";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireSession();
  if (!session) return response;
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = contributionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }
  const contribution = await addContribution(session.userId, id, parsed.data);
  return NextResponse.json({ contribution }, { status: 201 });
}
