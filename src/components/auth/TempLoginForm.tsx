"use client";

import { FormEvent, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";

export function TempLoginForm() {
  const { loginWithPassword } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);
    setSubmitting(true);
    if (!username.trim() || !password.trim()) {
      setMessage("Fields cannot be empty.");
      return;
    }
    try {
      await loginWithPassword({ username: username.trim(), password });
      setMessage("Login successful");
    } catch {
      setMessage("Email verification failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="flex flex-col gap-1 text-sm text-foreground/80">
        Username
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="rounded-lg border border-foreground/15 bg-background/60 px-3 py-2"
          placeholder="temporary username"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-foreground/80">
        Password
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-lg border border-foreground/15 bg-background/60 px-3 py-2"
          placeholder="password"
        />
      </label>
      {message ? (
        <div className="rounded-lg border border-foreground/20 bg-background/60 px-3 py-2 text-xs text-foreground">
          {message}
        </div>
      ) : null}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Signing in…" : "Login"}
      </button>
    </form>
  );
}
