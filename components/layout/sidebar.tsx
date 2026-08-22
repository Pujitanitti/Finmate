"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  ArrowLeftRight,
  PiggyBank,
  Target,
  Wallet,
  Repeat,
  Sparkles,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Logo } from "@/components/brand/logo";
import { prefetchApiQuery } from "@/lib/hooks/use-api-query";

const now = new Date();

// Maps each nav item to the primary API endpoint its page will fetch on
// mount. Hovering a nav item warms that endpoint's cache in the background
// (see prefetchApiQuery) — by the time the user actually clicks, the data
// often already arrived, making the tab switch feel instant instead of
// showing a skeleton. Routes with no single dominant endpoint (Settings,
// which has no data fetch) are simply omitted.
const NAV_ITEMS: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  prefetchUrl?: string;
}[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, prefetchUrl: "/api/health-score" },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/budgets", label: "Budgets", icon: PiggyBank, prefetchUrl: `/api/budgets?month=${now.getMonth() + 1}&year=${now.getFullYear()}` },
  { href: "/goals", label: "Goals", icon: Target, prefetchUrl: "/api/goals" },
  { href: "/accounts", label: "Accounts", icon: Wallet, prefetchUrl: "/api/accounts" },
  { href: "/recurring", label: "Recurring", icon: Repeat, prefetchUrl: "/api/recurring" },
  { href: "/insights", label: "Insights", icon: Sparkles, prefetchUrl: "/api/insights" },
  { href: "/settings", label: "Settings", icon: Settings },
];

// Light sidebar with a navy-tinted active state — this matches the
// original correct FinMate palette. (A dark navy sidebar was tried in the
// interim redesign, but with the restored single-navy palette the active
// pill would be visually identical to the sidebar background — invisible.
// The animated pill transition itself, a real interactive improvement, is
// preserved here; only the color treatment is restored.)
export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 flex-col border-r border-border bg-card px-3 py-6 md:flex">
      <Link href="/dashboard" className="mb-8 px-3">
        <Logo size={32} />
      </Link>
      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon, prefetchUrl }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onMouseEnter={() => prefetchUrl && prefetchApiQuery(prefetchUrl)}
              className={cn(
                "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {active && (
                <motion.span
                  layoutId="sidebar-active-pill"
                  className="absolute inset-0 rounded-lg bg-primary/10"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
              <Icon size={18} className="relative z-10" />
              <span className="relative z-10">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto rounded-lg bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-3">
        <p className="text-xs font-medium text-primary">FinMate Insights</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Rule-based, explainable insights from your real data — no paid AI.
        </p>
      </div>
    </aside>
  );
}
