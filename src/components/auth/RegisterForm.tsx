"use client";

import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { registerUser, type RegisterInput } from "@/lib/auth/api";

export function RegisterForm() {
  const { sendCode, login } = useAuth();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [username, setUsername] = useState("");
  const [street, setStreet] = useState("");
  const [suburb, setSuburb] = useState("");
  const [city, setCity] = useState("");
  const [childrenSchool, setChildrenSchool] = useState("");
  const [childrenAge, setChildrenAge] = useState("");
  const [message, setMessage] = useState<{
    text: string;
    variant: "error" | "success";
  } | null>(null);
  const [sendingCode, setSendingCode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const canSendCode = email.trim().length > 0;

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
      await sendCode(email.trim(), { purpose: "register" });
      setMessage({
        text: "Verification code sent. It expires in 5 minutes.",
        variant: "success",
      });
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
    if (!email.trim() || !code.trim()) {
      setMessage({ text: "Fields cannot be empty.", variant: "error" });
      return;
    }
    setSubmitting(true);
    try {
      const payload: RegisterInput = {
        email: email.trim(),
        code: code.trim(),
        username: username.trim() || email.trim(),
        address:
          street || suburb || city
            ? {
                street: street || undefined,
                suburb: suburb || undefined,
                city: city || undefined,
              }
            : undefined,
        childrenSchool: childrenSchool || undefined,
        childrenAge: childrenAge || undefined,
      };
      await registerUser(payload);
      await login({ email: payload.email, code: payload.code });
      setMessage({ text: "Registration successful", variant: "success" });
    } catch {
      setMessage({
        text: "Verification code is incorrect or expired.",
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="flex flex-col gap-1 text-sm text-foreground/80">
        Email
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 rounded-lg border border-foreground/15 bg-background/60 px-3 py-2"
            placeholder="name@example.com"
          />
          <button
            type="button"
            onClick={handleSendCode}
            disabled={sendingCode || cooldown > 0}
            className="min-w-[7.5rem] whitespace-nowrap rounded-lg border border-transparent bg-gradient-to-r from-orange-500/80 via-white/70 to-blue-500/70 px-3 py-2 text-sm font-medium text-foreground shadow-sm backdrop-blur disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cooldown > 0 ? `${cooldown}s` : sendingCode ? "Sending" : "Verify"}
          </button>
        </div>
      </label>

      <label className="flex flex-col gap-1 text-sm text-foreground/80">
        Verification code
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="rounded-lg border border-foreground/15 bg-background/60 px-3 py-2"
          placeholder="6-digit code"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-foreground/80">
        Display name
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="rounded-lg border border-foreground/15 bg-background/60 px-3 py-2"
          placeholder="Your name"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm text-foreground/80">
          Street
          <input
            value={street}
            onChange={(e) => setStreet(e.target.value)}
            className="rounded-lg border border-foreground/15 bg-background/60 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-foreground/80">
          Suburb
          <input
            value={suburb}
            onChange={(e) => setSuburb(e.target.value)}
            className="rounded-lg border border-foreground/15 bg-background/60 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-foreground/80">
          City
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="rounded-lg border border-foreground/15 bg-background/60 px-3 py-2"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm text-foreground/80">
        Children school
        <input
          value={childrenSchool}
          onChange={(e) => setChildrenSchool(e.target.value)}
          className="rounded-lg border border-foreground/15 bg-background/60 px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-foreground/80">
        Children age
        <input
          value={childrenAge}
          onChange={(e) => setChildrenAge(e.target.value)}
          className="rounded-lg border border-foreground/15 bg-background/60 px-3 py-2"
        />
      </label>

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
        className="w-full rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Registering…" : "Register"}
      </button>
    </form>
  );
}
