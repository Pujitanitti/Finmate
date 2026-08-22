"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/layout/theme-provider";
import { useToast } from "@/components/layout/toast";

export function SettingsPanels({
  user,
}: {
  user: { name: string; email: string; currency: string };
}) {
  const { theme, setTheme } = useTheme();
  const { showToast } = useToast();
  const [name, setName] = useState(user.name);
  const [savingName, setSavingName] = useState(false);
  const [nameMsg, setNameMsg] = useState<string | null>(null);

  const [passwords, setPasswords] = useState({ current: "", next: "" });
  const [savingPw, setSavingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState<string | null>(null);

  const [currency, setCurrency] = useState(user.currency);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setSavingName(true);
    setNameMsg(null);
    const res = await fetch("/api/settings/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setNameMsg(res.ok ? "Saved." : "Failed to save.");
    showToast(res.ok ? "Profile updated" : "Failed to update profile", res.ok ? "success" : "error");
    setSavingName(false);
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setSavingPw(true);
    setPwMsg(null);
    const res = await fetch("/api/settings/password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: passwords.current, newPassword: passwords.next }),
    });
    const data = await res.json();
    setPwMsg(res.ok ? "Password updated." : data.error ?? "Failed to update password.");
    showToast(
      res.ok ? "Password updated" : data.error ?? "Failed to update password",
      res.ok ? "success" : "error",
    );
    setSavingPw(false);
    if (res.ok) setPasswords({ current: "", next: "" });
  }

  async function saveCurrency(newCurrency: string) {
    setCurrency(newCurrency);
    await fetch("/api/settings/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currency: newCurrency }),
    });
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-foreground">Profile</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={saveName} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Email</Label>
              <Input value={user.email} disabled />
            </div>
            {nameMsg && <p className="text-sm text-muted-foreground">{nameMsg}</p>}
            <Button type="submit" disabled={savingName} className="w-fit">
              {savingName ? "Saving…" : "Save changes"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-foreground">Security</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={savePassword} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Current password</Label>
              <Input
                type="password"
                value={passwords.current}
                onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>New password</Label>
              <Input
                type="password"
                value={passwords.next}
                onChange={(e) => setPasswords({ ...passwords, next: e.target.value })}
              />
            </div>
            {pwMsg && <p className="text-sm text-muted-foreground">{pwMsg}</p>}
            <Button type="submit" disabled={savingPw} className="w-fit">
              {savingPw ? "Updating…" : "Update password"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-foreground">Appearance</CardTitle></CardHeader>
        <CardContent className="flex gap-2">
          <Button variant={theme === "light" ? "default" : "outline"} onClick={() => setTheme("light")}>
            Light
          </Button>
          <Button variant={theme === "dark" ? "default" : "outline"} onClick={() => setTheme("dark")}>
            Dark
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-foreground">Currency</CardTitle></CardHeader>
        <CardContent>
          <select
            className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
            value={currency}
            onChange={(e) => saveCurrency(e.target.value)}
          >
            <option value="INR">INR ₹</option>
            <option value="USD">USD $</option>
            <option value="EUR">EUR €</option>
            <option value="GBP">GBP £</option>
          </select>
        </CardContent>
      </Card>
    </div>
  );
}
