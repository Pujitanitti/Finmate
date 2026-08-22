"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Mail, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/brand/logo";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Safeguard: if something genuinely hangs (a stalled connection, a
    // server that never responds), don't leave the button stuck on
    // "Logging in…" forever — surface a clear, actionable message instead.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      let data: { error?: string } = {};
      try {
        data = await res.json();
      } catch {
        // Response wasn't valid JSON — a genuine server-side failure
        // (e.g. an unhandled exception returning an HTML error page)
        // rather than the API's normal error-response shape.
        setError("Something went wrong on our end. Please try again in a moment.");
        return;
      }

      if (!res.ok) {
        // Distinguish rate-limiting from invalid credentials from any
        // other server error, rather than one generic "Login failed."
        // for every non-2xx response.
        if (res.status === 429) {
          setError(data.error ?? "Too many login attempts. Please wait a few minutes and try again.");
        } else if (res.status === 401) {
          setError(data.error ?? "Invalid email or password.");
        } else if (res.status >= 500) {
          setError("Something went wrong on our end. Please try again in a moment.");
        } else {
          setError(data.error ?? "Login failed. Please check your details and try again.");
        }
        return;
      }

      router.push(searchParams.get("redirectTo") ?? "/dashboard");
      router.refresh();
    } catch (err) {
      clearTimeout(timeout);
      if (err instanceof DOMException && err.name === "AbortError") {
        setError("The request took too long. Please check your connection and try again.");
      } else {
        setError("Network error — please check your connection and try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-surface-tint via-background to-background px-4 py-12">
      {/* Soft floating blue glow accents — subtle, decorative only */}
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />

      <div className="relative w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo size={44} />
        </div>
        <Card className="border-border/80 p-8 shadow-glow-primary backdrop-blur-sm sm:p-10">
          <h1 className="mb-2 text-2xl font-semibold">Welcome back</h1>
          <p className="mb-8 text-sm text-muted-foreground">Log in to FinMate.</p>
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="h-12 pl-11 text-base"
                  placeholder="you@example.com"
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="h-12 pl-11 text-base"
                  placeholder="••••••••"
                />
              </div>
            </div>
            {error && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" disabled={loading} size="lg" className="mt-2">
              {loading ? "Signing in…" : "Log In"}
            </Button>
          </form>
          <p className="mt-8 text-center text-sm text-muted-foreground">
            New to FinMate?{" "}
            <Link href="/register" className="font-medium text-primary hover:underline">
              Create an account
            </Link>
          </p>
        </Card>
      </div>
    </main>
  );
}
