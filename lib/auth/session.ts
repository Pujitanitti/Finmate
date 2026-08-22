import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db/prisma";

const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME ?? "finmate_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7; // 7 days

function getSecretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "AUTH_SECRET is not set. Copy .env.example to .env and set a random secret.",
    );
  }
  return new TextEncoder().encode(secret);
}

export interface SessionPayload {
  userId: string;
  email: string;
  /** Must match User.sessionVersion at verification time, or the session is treated as revoked. */
  sessionVersion: number;
}

export async function createSession(payload: {
  userId: string;
  email: string;
  sessionVersion: number;
}) {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecretKey());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Decodes and verifies the session JWT's signature/expiry, then checks its
 * embedded `sessionVersion` against the current value in the database. If a
 * user has logged out (see revokeAllSessions) or changed their password
 * since this token was issued, sessionVersion will have been bumped and this
 * token — despite being cryptographically valid and unexpired — is treated
 * as revoked. This is the fix for the previously-documented gap where
 * logout only cleared the client cookie without invalidating the token
 * server-side (see docs/SECURITY.md).
 *
 * Costs one extra indexed primary-key lookup per authenticated request —
 * acceptable at current scale; the natural next optimization if this ever
 * shows up as a bottleneck is caching {userId: sessionVersion} in Redis with
 * a short TTL rather than hitting Postgres on every request.
 */
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    const userId = payload.userId as string;
    const tokenSessionVersion = payload.sessionVersion as number | undefined;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { sessionVersion: true, email: true },
    });
    if (!user) return null;

    // Tokens issued before this feature existed won't have sessionVersion in
    // their payload; treat that as version 0, matching the column default,
    // so existing valid sessions aren't force-logged-out by this change.
    const effectiveTokenVersion = tokenSessionVersion ?? 0;
    if (effectiveTokenVersion !== user.sessionVersion) {
      return null; // revoked
    }

    return { userId, email: user.email, sessionVersion: user.sessionVersion };
  } catch {
    return null;
  }
}

/** Bumps sessionVersion, instantly invalidating every previously-issued token for this user. */
export async function revokeAllSessions(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { sessionVersion: { increment: 1 } },
  });
}

export { SESSION_COOKIE_NAME };
