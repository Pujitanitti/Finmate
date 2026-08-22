"use client";

import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";

const bars = [40, 65, 50, 80, 55, 90, 70];

export function AnimatedDashboardPreview() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      <Card className="mx-auto w-full max-w-3xl p-6">
        <div className="mb-6 grid grid-cols-3 gap-4">
          {[
            { label: "Total Balance", value: "₹85,400", change: "+8.4%", up: true },
            { label: "Monthly Expenses", value: "₹38,500", change: "-5.2%", up: false },
            { label: "Savings Rate", value: "34%", change: "+6%", up: true },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * i, duration: 0.4 }}
              className="rounded-lg border border-border p-3"
            >
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className="mt-1 text-lg font-semibold">{stat.value}</p>
              <p className={`mt-0.5 flex items-center gap-1 text-xs ${stat.up ? "text-success" : "text-destructive"}`}>
                {stat.up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {stat.change}
              </p>
            </motion.div>
          ))}
        </div>
        <div className="flex h-40 items-end gap-3 rounded-lg border border-border p-4">
          {bars.map((h, i) => (
            <motion.div
              key={i}
              initial={{ height: 0 }}
              animate={{ height: `${h}%` }}
              transition={{ delay: 0.3 + i * 0.06, duration: 0.5, ease: "easeOut" }}
              className="flex-1 rounded-t-md bg-primary/80"
            />
          ))}
        </div>
      </Card>
    </motion.div>
  );
}
