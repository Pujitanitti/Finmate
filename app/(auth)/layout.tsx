import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";

/**
 * Wraps /login and /register. If the user already has a genuinely valid
 * (non-revoked) session, redirect them straight to the dashboard instead of
 * showing the login form again.
 *
 * This uses getSession() — the same authoritative, sessionVersion-aware
 * check every protected page uses — rather than the lightweight crypto-only
 * check middleware.ts uses for its fast-path redirect. That distinction is
 * exactly what fixes a real infinite-redirect-loop bug: a cookie that's
 * cryptographically valid but has been revoked (sessionVersion mismatch —
 * e.g. left over from before a database reset) is correctly treated as "not
 * logged in" here, so this layout renders the login page normally instead
 * of trying to redirect somewhere that would immediately redirect back.
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (session) {
    redirect("/dashboard");
  }
  return <>{children}</>;
}
