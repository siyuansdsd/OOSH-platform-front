"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { BRAND_LOGO_URL, BRAND_NAME } from "@/constants/branding";
import { useAuth } from "./AuthProvider";

interface LoginFormProps {
  isAdmin?: boolean;
}

export function LoginForm({ isAdmin }: LoginFormProps) {
  const { sendCode, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<{ text: string; variant: "error" | "success" } | null>(null);
  const [sendingCode, setSendingCode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const canSendCode = email.trim().length > 0 && (isAdmin ? password.trim().length > 0 : true);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleSendCode = async () => {
    if (!canSendCode) {
      setMessage({ text: "Fields cannot be empty.", variant: "error" });
      return;
    }
    setMessage(null);
    setSendingCode(true);
    setCooldown(60);
    try {
      await sendCode(email.trim(), {
        password: isAdmin ? password : undefined,
      });
      setMessage({ text: "Verification code sent. It expires in 5 minutes.", variant: "success" });
    } catch {
      setCooldown(0);
      setMessage({ text: "Email verification failed.", variant: "error" });
    } finally {
      setSendingCode(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);
    if (!email.trim() || !code.trim() || (isAdmin && !password.trim())) {
      setMessage({ text: "Fields cannot be empty.", variant: "error" });
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
      setMessage({ text: "Login successful", variant: "success" });
    } catch {
      setMessage({ text: "Verification code is incorrect or expired.", variant: "error" });
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
              disabled={sendingCode || cooldown > 0}
              className="btn-gradient min-w-[7.5rem] whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              {cooldown > 0 ? `${cooldown}s` : sendingCode ? "Sending" : "Verify"}
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
      <div className="min-h-[44px]">
        {message ? (
          <div
            className={`rounded-lg border px-3 py-2 text-xs ${
              message.variant === "error"
                ? "border-red-300 bg-red-50 text-red-600"
                : "border-emerald-200 bg-emerald-50 text-emerald-600"
            }`}
          >
            {message.text}
          </div>
        ) : null}
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="btn-gradient w-full rounded-lg px-4 py-2 text-sm font-semibold text-foreground transition disabled:cursor-not-allowed disabled:opacity-60"
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
