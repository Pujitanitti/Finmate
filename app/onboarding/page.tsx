"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";

const GOALS = ["Save money", "Emergency fund", "Reduce spending", "Pay off debt"];
const STEPS = ["Name confirmed", "Monthly income", "Financial goals", "Currency"];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [income, setIncome] = useState("");
  const [goals, setGoals] = useState<string[]>([]);
  const [currency, setCurrency] = useState("INR");
  const [saving, setSaving] = useState(false);

  function toggleGoal(g: string) {
    setGoals((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));
  }

  async function finish() {
    setSaving(true);
    await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ monthlyIncome: Number(income) || 0, goals, currency }),
    });
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md p-6">
        <div className="mb-6 flex gap-1.5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 flex-1 rounded-full",
                i <= step ? "bg-primary" : "bg-muted",
              )}
            />
          ))}
        </div>

        {step === 1 && (
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold">What&apos;s your monthly income?</h2>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="income">Monthly income (₹)</Label>
              <Input
                id="income"
                type="number"
                min={0}
                value={income}
                onChange={(e) => setIncome(e.target.value)}
                placeholder="65000"
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold">What are your financial goals?</h2>
            <div className="grid grid-cols-2 gap-2">
              {GOALS.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => toggleGoal(g)}
                  className={cn(
                    "rounded-lg border border-border p-3 text-left text-sm transition-colors",
                    goals.includes(g) ? "border-primary bg-primary/5" : "hover:bg-muted",
                  )}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold">Preferred currency</h2>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="currency">Currency</Label>
              <select
                id="currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
              >
                <option value="INR">INR ₹ (default)</option>
                <option value="USD">USD $</option>
                <option value="EUR">EUR €</option>
                <option value="GBP">GBP £</option>
              </select>
            </div>
          </div>
        )}

        {step === 0 && (
          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">Let&apos;s set up your dashboard</h2>
            <p className="text-sm text-muted-foreground">
              A few quick questions so FinMate can personalize your budgets, goals, and
              insights.
            </p>
          </div>
        )}

        <div className="mt-6 flex justify-between">
          {step > 0 ? (
            <Button variant="outline" onClick={() => setStep((s) => s - 1)}>
              Back
            </Button>
          ) : (
            <span />
          )}
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep((s) => s + 1)}>Continue</Button>
          ) : (
            <Button onClick={finish} disabled={saving}>
              {saving ? "Setting up…" : "Go to Dashboard"}
            </Button>
          )}
        </div>
      </Card>
    </main>
  );
}
