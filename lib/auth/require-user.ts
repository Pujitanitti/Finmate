import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

/** Server-component guard: redirects to /login or /onboarding as needed, else returns the full user record. */
export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/login");
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) redirect("/login");
  if (!user.onboarded) redirect("/onboarding");
  return user;
}
