"use client";

import { FormEvent, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { BRAND_LOGO_URL, BRAND_NAME } from "@/constants/branding";

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
      <div className="flex flex-col items-center gap-2 py-2">
        <img
          src={BRAND_LOGO_URL}
          alt={`${BRAND_NAME} logo`}
          className="h-14 w-14 rounded-full border border-white/60 bg-white/80 object-contain shadow"
        />
        <span className="text-xs uppercase tracking-wide text-foreground/50">
          {BRAND_NAME}
        </span>
      </div>
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
        className="btn-gradient w-full rounded-lg px-4 py-2 text-sm font-semibold text-foreground transition disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Signing in…" : "Login"}
      </button>
    </form>
  );
}
