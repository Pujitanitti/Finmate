"use client";

import { useRouter, usePathname } from "next/navigation";
import { LogOut, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/layout/theme-provider";
import { NotificationBell } from "@/components/dashboard/notification-bell";
import { QuickAddTransaction } from "@/components/dashboard/quick-add-transaction";
import { titleForPath } from "@/lib/utils/route-titles";
import { clearApiQueryCache } from "@/lib/hooks/use-api-query";

export function Topbar({ userName }: { userName?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const title = titleForPath(pathname);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    // Clear the client-side query cache so, if another user logs in on the
    // same browser session, they never see a stale cached read of the
    // previous user's financial data.
    clearApiQueryCache();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        {userName && (
          <p className="text-sm text-muted-foreground">Welcome back, {userName}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <QuickAddTransaction />
        <NotificationBell />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </Button>
        <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Log out">
          <LogOut size={18} />
        </Button>
      </div>
    </header>
  );
}
