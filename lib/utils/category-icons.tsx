import {
  Utensils,
  ShoppingBag,
  Car,
  Receipt,
  Clapperboard,
  HeartPulse,
  GraduationCap,
  Plane,
  Wallet,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react";

/**
 * Maps a category name to a consistent icon + tint, reused everywhere a
 * category shows up (transactions, budgets, spending breakdown) so the same
 * category always looks the same across the app.
 */
export const CATEGORY_ICON_MAP: Record<string, { icon: LucideIcon; color: string; bg: string }> = {
  Food: { icon: Utensils, color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-500/10" },
  Shopping: { icon: ShoppingBag, color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-500/10" },
  Transport: { icon: Car, color: "text-sky-600 dark:text-sky-400", bg: "bg-sky-500/10" },
  Bills: { icon: Receipt, color: "text-red-600 dark:text-red-400", bg: "bg-red-500/10" },
  Entertainment: { icon: Clapperboard, color: "text-pink-600 dark:text-pink-400", bg: "bg-pink-500/10" },
  Health: { icon: HeartPulse, color: "text-green-600 dark:text-green-400", bg: "bg-green-500/10" },
  Education: { icon: GraduationCap, color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-500/10" },
  Travel: { icon: Plane, color: "text-teal-600 dark:text-teal-400", bg: "bg-teal-500/10" },
  Income: { icon: Wallet, color: "text-success", bg: "bg-success/10" },
};

const FALLBACK = { icon: MoreHorizontal, color: "text-slate-600 dark:text-slate-400", bg: "bg-slate-500/10" };

export function getCategoryIcon(name: string | null | undefined) {
  if (!name) return FALLBACK;
  return CATEGORY_ICON_MAP[name] ?? FALLBACK;
}

export function CategoryIcon({ name, size = 16 }: { name: string | null | undefined; size?: number }) {
  const { icon: Icon, color, bg } = getCategoryIcon(name);
  return (
    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${bg}`}>
      <Icon size={size} className={color} />
    </span>
  );
}
