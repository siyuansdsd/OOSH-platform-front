"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useAuth } from "./AuthProvider";

interface LoginFormProps {
  isAdmin?: boolean;
}

export function LoginForm({ isAdmin }: LoginFormProps) {
  const { sendCode, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [sendingCode, setSendingCode] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canSendCode = email.trim().length > 0 && (isAdmin ? password.trim().length > 0 : true);

  const handleSendCode = async () => {
    if (!canSendCode) {
      setMessage("Fields cannot be empty.");
      return;
    }
    setMessage(null);
    setSendingCode(true);
    try {
      await sendCode(email.trim(), {
        password: isAdmin ? password : undefined,
        purpose: isAdmin ? undefined : "login",
      });
      setMessage("Verification code sent. It expires in 5 minutes.");
    } catch {
      setMessage("Email verification failed.");
    } finally {
      setSendingCode(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);
    if (!email.trim() || !code.trim() || (isAdmin && !password.trim())) {
      setMessage("Fields cannot be empty.");
      return;
    }
    setSubmitting(true);
    try {
      await login({
        email: email.trim(),
        password: isAdmin ? password : undefined,
        code: code.trim(),
        isAdmin,
      });
      setMessage("Login successful");
    } catch {
      setMessage("Verification code is incorrect or expired.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="flex flex-col gap-1 text-sm text-foreground/80">
          Email
          <div className="flex gap-2">
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 rounded-lg border border-foreground/15 bg-background/60 px-3 py-2"
              placeholder="name@example.com"
            />
            <button
              type="button"
              onClick={handleSendCode}
              disabled={sendingCode}
              className="whitespace-nowrap rounded-lg border border-foreground/20 px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
            >
              {sendingCode ? "Sending…" : "Verify"}
            </button>
          </div>
        </label>
      </div>
      {isAdmin ? (
        <div>
          <label className="flex flex-col gap-1 text-sm text-foreground/80">
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-lg border border-foreground/15 bg-background/60 px-3 py-2"
              placeholder="Enter password"
            />
          </label>
        </div>
      ) : null}
      <div>
        <label className="flex flex-col gap-1 text-sm text-foreground/80">
          Verification code
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="rounded-lg border border-foreground/15 bg-background/60 px-3 py-2"
            placeholder="6-digit code"
          />
        </label>
      </div>
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
        {submitting ? "Signing in…" : isAdmin ? "Admin Login" : "Login"}
      </button>
      {!isAdmin ? (
        <p className="text-center text-xs text-foreground/60">
          No account yet?{" "}
          <Link className="font-semibold underline" href="/register">
            Register here
          </Link>
        </p>
      ) : null}
    </form>
  );
}
