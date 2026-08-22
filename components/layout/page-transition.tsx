"use client";

import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Subtle 180ms fade/slide on route change. This is purely a CSS-driven
 * transition on already-loaded content — it never blocks or delays
 * navigation, and there is no spinner or fake loading state involved.
 * The perceived "instant" feel comes from the shared layout (Shell no
 * longer remounts); this just adds polish on top of that.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
