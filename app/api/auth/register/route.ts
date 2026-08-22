import { NextRequest, NextResponse } from "next/server";
import { registerSchema } from "@/lib/validation/auth";
import { registerUser, AuthError } from "@/services/auth.service";
import { checkRateLimit, getClientKey } from "@/lib/security/rate-limit";

// 3 registrations per 15 minutes per client IP — enough for a real user
// retrying a typo'd signup, tight enough to deter mass account creation.
const REGISTER_RATE_LIMIT = { limit: 3, windowMs: 15 * 60 * 1000 };

export async function POST(req: NextRequest) {
  const clientKey = getClientKey(req);
  const rateLimit = checkRateLimit(`register:${clientKey}`, REGISTER_RATE_LIMIT);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many registration attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  try {
    const user = await registerUser(parsed.data);
    return NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error("Register error:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
