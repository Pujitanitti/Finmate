/**
 * Integration tests against a real PostgreSQL database.
 * See tests/integration/README.md for how to run these.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { registerUser, loginUser, AuthError } from "@/services/auth.service";

const TEST_EMAIL = `integration-test-${Date.now()}@finmate.test`;
const TEST_PASSWORD = "TestPass123";

describe("auth.service — real database", () => {
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
    await prisma.$disconnect();
  });

  it("registers a new user and creates default categories", async () => {
    const user = await registerUser({
      name: "Integration Test User",
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });

    expect(user.email).toBe(TEST_EMAIL);
    // Password must never be stored in plaintext.
    expect(user.passwordHash).not.toBe(TEST_PASSWORD);

    const categories = await prisma.category.findMany({ where: { userId: user.id } });
    expect(categories.length).toBeGreaterThan(0);
  });

  it("rejects registration with a duplicate email", async () => {
    await expect(
      registerUser({ name: "Duplicate", email: TEST_EMAIL, password: TEST_PASSWORD }),
    ).rejects.toThrow(AuthError);
  });

  it("logs in successfully with correct credentials", async () => {
    const user = await loginUser({ email: TEST_EMAIL, password: TEST_PASSWORD });
    expect(user.email).toBe(TEST_EMAIL);
  });

  it("rejects login with an incorrect password", async () => {
    await expect(
      loginUser({ email: TEST_EMAIL, password: "WrongPassword123" }),
    ).rejects.toThrow(AuthError);
  });

  it("rejects login for a non-existent email without revealing whether the account exists", async () => {
    let caught: unknown;
    try {
      await loginUser({ email: "nobody-real@finmate.test", password: "AnyPassword123" });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(AuthError);
    // The error message must be identical to the wrong-password case above —
    // it should not leak "this email doesn't exist" as distinct from "wrong password".
    expect((caught as AuthError).message).toBe("Invalid email or password.");
  });
});
