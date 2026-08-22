import { NextRequest, NextResponse } from "next/server";
import { loginSchema } from "@/lib/validation/auth";
import { loginUser, AuthError } from "@/services/auth.service";
import { checkRateLimit, getClientKey } from "@/lib/security/rate-limit";

// 5 attempts per 5 minutes per client IP — generous enough for a genuine user
// who mistypes a password a couple of times, tight enough to make brute-force
// login guessing impractical.
const LOGIN_RATE_LIMIT = { limit: 5, windowMs: 5 * 60 * 1000 };

export async function POST(req: NextRequest) {
  const clientKey = getClientKey(req);
  const rateLimit = checkRateLimit(`login:${clientKey}`, LOGIN_RATE_LIMIT);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many login attempts. Please try again in a few minutes." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  try {
    const user = await loginUser(parsed.data);
    return NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error("Login error:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
