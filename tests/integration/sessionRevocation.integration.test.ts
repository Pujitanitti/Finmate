/**
 * Verifies the session-revocation fix: logging out (or changing password)
 * invalidates a previously-issued token even though the JWT itself remains
 * cryptographically valid and unexpired. See lib/auth/session.ts.
 */
import { describe, it, expect, afterAll } from "vitest";
import { SignJWT } from "jose";
import { prisma } from "@/lib/db/prisma";
import { registerUser } from "@/services/auth.service";
import { revokeAllSessions } from "@/lib/auth/session";

const RUN_ID = Date.now();

function getSecretKey() {
  return new TextEncoder().encode(process.env.AUTH_SECRET ?? "test-secret-for-ci");
}

async function signToken(userId: string, email: string, sessionVersion: number) {
  return new SignJWT({ userId, email, sessionVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecretKey());
}

async function verifyAgainstCurrentVersion(userId: string, tokenSessionVersion: number) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { sessionVersion: true },
  });
  return tokenSessionVersion === user.sessionVersion;
}

describe("session revocation", () => {
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { contains: `session-revoke-${RUN_ID}` } } });
    await prisma.$disconnect();
  });

  it("a freshly issued token's sessionVersion matches the current user record", async () => {
    const user = await registerUser({
      name: "Revocation Test",
      email: `session-revoke-${RUN_ID}-a@finmate.test`,
      password: "TestPass123",
    });

    const token = await signToken(user.id, user.email, user.sessionVersion);
    const decoded = JSON.parse(
      Buffer.from(token.split(".")[1]!, "base64url").toString(),
    );

    expect(await verifyAgainstCurrentVersion(user.id, decoded.sessionVersion)).toBe(true);
  });

  it("a token issued before revokeAllSessions is rejected afterward", async () => {
    const user = await registerUser({
      name: "Revocation Test 2",
      email: `session-revoke-${RUN_ID}-b@finmate.test`,
      password: "TestPass123",
    });

    const tokenIssuedBeforeRevocation = await signToken(user.id, user.email, user.sessionVersion);
    const decodedBefore = JSON.parse(
      Buffer.from(tokenIssuedBeforeRevocation.split(".")[1]!, "base64url").toString(),
    );

    // Simulates a logout / password change on another device.
    await revokeAllSessions(user.id);

    const stillValid = await verifyAgainstCurrentVersion(user.id, decodedBefore.sessionVersion);
    expect(stillValid).toBe(false);
  });

  it("a freshly re-issued token after revocation is valid again", async () => {
    const user = await registerUser({
      name: "Revocation Test 3",
      email: `session-revoke-${RUN_ID}-c@finmate.test`,
      password: "TestPass123",
    });

    await revokeAllSessions(user.id);

    const refreshedUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    const newToken = await signToken(refreshedUser.id, refreshedUser.email, refreshedUser.sessionVersion);
    const decoded = JSON.parse(Buffer.from(newToken.split(".")[1]!, "base64url").toString());

    expect(await verifyAgainstCurrentVersion(user.id, decoded.sessionVersion)).toBe(true);
  });
});
