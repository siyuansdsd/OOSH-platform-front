"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useAuth } from "@/components/auth/AuthProvider";

export default function ProfilePage() {
  return (
    <ProtectedRoute>
      <ProfileForm />
    </ProtectedRoute>
  );
}

type MessageState = { text: string; variant: "success" | "error" } | null;

function ProfileForm() {
  const { user, updateProfile, handleAuthError } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<MessageState>(null);

  useEffect(() => {
    const nextDisplay =
      typeof user?.display_name === "string"
        ? user.display_name
        : typeof user?.username === "string"
        ? user.username
        : "";
    const nextEmail =
      typeof user?.email === "string" ? user.email : "";
    setDisplayName(nextDisplay);
    setEmail(nextEmail);
  }, [user?.display_name, user?.username, user?.email]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    const trimmed = displayName.trim();
    if (!trimmed) {
      setMessage({ text: "Display name is required.", variant: "error" });
      return;
    }
    if (typeof window !== "undefined") {
      const confirmed = window.confirm(
        "Are you sure you want to update your profile details?"
      );
      if (!confirmed) return;
    }
    setBusy(true);
    try {
      await updateProfile(trimmed);
      setMessage({ text: "Profile updated successfully.", variant: "success" });
    } catch (error: unknown) {
      handleAuthError(error);
      setMessage({
        text:
          error instanceof Error ? error.message : "Failed to update profile.",
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] px-4 py-10">
      <div className="glass-panel mx-auto flex w-full max-w-xl flex-col gap-6 rounded-3xl p-6 text-foreground shadow-lg">
        <div>
          <h1 className="text-2xl font-semibold">Account settings</h1>
          <p className="mt-2 text-sm text-foreground/60">
            Update your personal details. Your email is locked and cannot be changed.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <label className="flex flex-col gap-1 text-sm text-foreground/80">
            Display name
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              className="rounded-lg border border-foreground/15 bg-background/60 px-3 py-2"
              placeholder="Enter your display name"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-foreground/80">
            Email
            <div className="relative">
              <input
                value={email}
                disabled
                className="w-full rounded-lg border border-foreground/15 bg-foreground/10 px-3 py-2 text-foreground/70 opacity-80"
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs uppercase tracking-wide text-foreground/40">
                Locked
              </span>
            </div>
          </label>

          <div className="min-h-[1.5rem] text-sm">
            {message ? (
              <p
                className={`rounded-lg border px-3 py-2 text-xs ${
                  message.variant === "success"
                    ? "border-emerald-300 bg-emerald-500/10 text-emerald-700"
                    : "border-red-300 bg-red-500/10 text-red-600"
                }`}
              >
                {message.text}
              </p>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={busy}
            className="btn-gradient w-full rounded-lg px-4 py-2 text-sm font-semibold text-foreground transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Updating…" : "Update"}
          </button>
        </form>
      </div>
    </div>
  );
}
