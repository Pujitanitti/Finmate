import Link from "next/link";
import {
  Wallet,
  PiggyBank,
  Target,
  ShieldCheck,
  Sparkles,
  BarChart3,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AnimatedDashboardPreview } from "@/components/landing/animated-dashboard-preview";
import { Logo } from "@/components/brand/logo";

const FEATURES = [
  {
    icon: Wallet,
    title: "Track Everything",
    description: "Income, expenses, accounts, and recurring payments in one place.",
  },
  {
    icon: PiggyBank,
    title: "Smart Budgets",
    description: "Category budgets with clear healthy / warning / exceeded status.",
  },
  {
    icon: Target,
    title: "Savings Goals",
    description: "Set targets, track contributions, and see if you're on pace.",
  },
  {
    icon: BarChart3,
    title: "Real Analytics",
    description: "Cash flow trends and category breakdowns from your real data.",
  },
  {
    icon: Sparkles,
    title: "FinMate Insights",
    description: "Rule-based, explainable insights — no paid AI required.",
  },
  {
    icon: ShieldCheck,
    title: "Built-In Security",
    description: "Hashed passwords, HTTP-only sessions, and per-user data isolation.",
  },
];

const STEPS = [
  { title: "Connect your accounts", description: "Add bank, cash, or card accounts manually — no bank linking required." },
  { title: "Log transactions", description: "Add income and expenses; FinMate suggests categories automatically." },
  { title: "Set budgets & goals", description: "Define monthly limits and savings targets that matter to you." },
  { title: "Get real insights", description: "The FinMate Insights Engine surfaces patterns from your actual data." },
];

export default function Home() {
  return (
    <main>
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/95 px-6 py-4 backdrop-blur">
        <Logo size={30} />
        <div className="flex items-center gap-2">
          <Link href="/login">
            <Button variant="ghost">Log in</Button>
          </Link>
          <Link href="/register">
            <Button>Get Started</Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="flex flex-col items-center gap-6 px-6 pb-16 pt-24 text-center">
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
          Take Control of Your Money.
        </h1>
        <p className="max-w-md text-muted-foreground">
          Track your spending, plan your future, and understand your finances with
          FinMate.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href="/register">
            <Button size="lg">
              Get Started <ArrowRight size={16} />
            </Button>
          </Link>
          <Link href="/register?demo=true">
            <Button size="lg" variant="outline">
              Explore Demo
            </Button>
          </Link>
        </div>

        <div className="mt-10 w-full">
          <AnimatedDashboardPreview />
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="mb-2 text-center text-2xl font-semibold">Everything you need</h2>
        <p className="mb-10 text-center text-sm text-muted-foreground">
          A complete personal finance toolkit, built to feel like a real SaaS product.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <Card key={title} className="p-5">
              <div className="mb-3 w-fit rounded-lg bg-primary/10 p-2 text-primary">
                <Icon size={20} />
              </div>
              <h3 className="mb-1 font-medium">{title}</h3>
              <p className="text-sm text-muted-foreground">{description}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-muted/40 px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-10 text-center text-2xl font-semibold">How FinMate works</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {STEPS.map((step, i) => (
              <div key={step.title} className="flex gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
                  {i + 1}
                </div>
                <div>
                  <h3 className="font-medium">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security */}
      <section className="mx-auto max-w-3xl px-6 py-16 text-center">
        <ShieldCheck className="mx-auto mb-4 text-primary" size={32} />
        <h2 className="mb-2 text-2xl font-semibold">Your data stays yours</h2>
        <p className="text-sm text-muted-foreground">
          Passwords are hashed with bcrypt, sessions use HTTP-only cookies, and every
          request is scoped to your account. FinMate never sells or shares your
          financial data.
        </p>
      </section>

      {/* Insights */}
      <section className="mx-auto max-w-3xl px-6 py-16 text-center">
        <Sparkles className="mx-auto mb-4 text-primary" size={32} />
        <h2 className="mb-2 text-2xl font-semibold">FinMate Insights Engine</h2>
        <p className="text-sm text-muted-foreground">
          A dedicated, rule-based engine that reads your real transactions, budgets,
          and goals to surface observations like spending changes, budget warnings,
          and savings progress — deterministic and fully explainable, with no paid AI
          API required.
        </p>
      </section>

      {/* CTA */}
      <section className="px-6 pb-24 pt-8 text-center">
        <h2 className="mb-4 text-2xl font-semibold">Ready to take control?</h2>
        <Link href="/register">
          <Button size="lg">
            Get Started Free <ArrowRight size={16} />
          </Button>
        </Link>
      </section>
    </main>
  );
}
