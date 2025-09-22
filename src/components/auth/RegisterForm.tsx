"use client";

import { FormEvent, useState } from "react";
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
  const [message, setMessage] = useState<string | null>(null);
  const [sendingCode, setSendingCode] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canSendCode = email.trim().length > 0;

  const handleSendCode = async () => {
    if (!canSendCode) {
      setMessage("Fields cannot be empty.");
      return;
    }
    setMessage(null);
    setSendingCode(true);
    try {
      await sendCode(email.trim(), undefined, "register");
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
    if (!email.trim() || !code.trim()) {
      setMessage("Fields cannot be empty.");
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
      setMessage("Registration successful");
    } catch {
      setMessage("Verification code is incorrect or expired.");
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
            disabled={sendingCode}
            className="whitespace-nowrap rounded-lg border border-foreground/20 px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sendingCode ? "Sending…" : "Send code"}
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
        {submitting ? "Registering…" : "Register"}
      </button>
    </form>
  );
}
