import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME ?? "finmate_session";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/transactions",
  "/budgets",
  "/goals",
  "/accounts",
  "/recurring",
  "/insights",
  "/settings",
];

/**
 * Edge-runtime check: verifies the JWT's signature and expiry only — it does
 * NOT check sessionVersion (Prisma/Postgres access isn't available in the
 * default Next.js edge middleware runtime). This means a cryptographically
 * valid but server-side-revoked token (see revokeAllSessions in
 * lib/auth/session.ts) will still pass this check and reach the page.
 *
 * That's an intentional, documented split, not an oversight: the
 * authoritative revocation check happens in lib/auth/session.ts's
 * getSession(), which runs in the Node.js runtime for every Server
 * Component and Route Handler on a protected page, and will correctly
 * redirect/401 a revoked session even though middleware let the request
 * through. Middleware's job here is purely a fast-path redirect for
 * obviously-missing/invalid tokens, avoiding rendering a page shell that's
 * about to redirect anyway — it is not the security boundary.
 */
async function isAuthenticated(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return false;
  const secret = process.env.AUTH_SECRET;
  if (!secret) return false;
  try {
    await jwtVerify(token, new TextEncoder().encode(secret));
    return true;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));

  if (isProtected) {
    const authed = await isAuthenticated(req);
    if (!authed) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("redirectTo", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Redirecting an already-logged-in user AWAY from /login or /register is
  // intentionally NOT done here anymore. It used to be — but doing it with
  // only the lightweight crypto-only check above caused a real infinite
  // redirect loop (ERR_TOO_MANY_REDIRECTS): a cryptographically valid but
  // server-side-revoked cookie (e.g. left over from before a database
  // reset) would make middleware bounce the user from /login toward
  // /dashboard, while /dashboard's authoritative, revocation-aware check
  // would immediately bounce them back to /login — forever. That
  // "already logged in" redirect now happens in app/(auth)/layout.tsx
  // instead, using the same authoritative getSession() check (which
  // correctly checks revocation) that protects every other page — so it
  // can never disagree with itself and loop.
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/transactions/:path*",
    "/budgets/:path*",
    "/goals/:path*",
    "/accounts/:path*",
    "/recurring/:path*",
    "/insights/:path*",
    "/settings/:path*",
  ],
};
