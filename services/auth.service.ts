import { prisma } from "@/lib/db/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession, getSession, revokeAllSessions } from "@/lib/auth/session";
import type { LoginInput, RegisterInput } from "@/lib/validation/auth";
import { DEFAULT_CATEGORIES } from "@/lib/utils/default-categories";

export class AuthError extends Error {}

export async function registerUser(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new AuthError("An account with this email already exists.");
  }

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
      preference: { create: {} },
      categories: {
        create: DEFAULT_CATEGORIES.map((c) => ({
          name: c.name,
          icon: c.icon,
          color: c.color,
          isDefault: true,
        })),
      },
    },
  });

  await createSession({ userId: user.id, email: user.email, sessionVersion: user.sessionVersion });
  return user;
}

export async function loginUser(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) {
    throw new AuthError("Invalid email or password.");
  }

  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) {
    throw new AuthError("Invalid email or password.");
  }

  await createSession({ userId: user.id, email: user.email, sessionVersion: user.sessionVersion });
  return user;
}

/**
 * Logs out the current browser session (clears the cookie) AND revokes every
 * other outstanding session token for this user by bumping sessionVersion —
 * closing the previously-documented gap where logout only cleared the
 * client-side cookie without invalidating the JWT server-side.
 */
export async function logoutUser() {
  const session = await getSession();
  if (session) {
    await revokeAllSessions(session.userId);
  }
  await destroySession();
}
