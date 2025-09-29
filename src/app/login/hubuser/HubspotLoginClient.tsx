"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import type { LoginResponse } from "@/lib/auth/api";

type HubLoginStatus = "pending" | "success" | "error";

export function HubspotLoginClient({ contactId }: { contactId: string }) {
  const router = useRouter();
  const { adoptLoginResponse } = useAuth();
  const [status, setStatus] = useState<HubLoginStatus>("pending");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const displayMessage = useMemo(() => {
    if (status === "pending") return "[verify your info...]";
    if (status === "success") return "Verification complete. Redirecting...";
    return errorMessage ?? "We couldn't verify your details.";
  }, [status, errorMessage]);

  useEffect(() => {
    if (!contactId) {
      setStatus("error");
      setErrorMessage("Missing contact information. Redirecting to sign in...");
      const timeout = window.setTimeout(() => {
        router.replace("/login");
      }, 2000);
      return () => window.clearTimeout(timeout);
    }

    const controller = new AbortController();

    const run = async () => {
      setStatus("pending");
      setErrorMessage(null);
      try {
        const response = await fetch("/api/users/hubspot-login", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ contactId }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || "Verification failed");
        }

        const data = (await response.json()) as LoginResponse;
        adoptLoginResponse(data);
        setStatus("success");

        window.setTimeout(() => {
          router.replace("/");
        }, 500);
      } catch (error: unknown) {
        if (controller.signal.aborted) return;
        console.error("Hubspot login failed", error);
        const message =
          error instanceof Error
            ? error.message || "Verification failed"
            : String(error ?? "Verification failed");
        setErrorMessage(`${message}. Redirecting to sign in...`);
        setStatus("error");

        window.setTimeout(() => {
          router.replace("/login");
        }, 2000);
      }
    };

    void run();

    return () => {
      controller.abort();
    };
  }, [contactId, adoptLoginResponse, router]);

  return (
    <div className="min-h-[calc(100vh-4rem)] px-4 py-10">
      <div className="glass-panel mx-auto flex w-full max-w-md flex-col items-center gap-6 rounded-3xl p-6 text-center text-foreground shadow-lg">
        <div className="flex flex-col items-center gap-4">
          <div
            className={`text-lg font-semibold ${
              status === "pending"
                ? "bg-gradient-to-r from-orange-400 via-amber-500 to-blue-500 bg-clip-text text-transparent"
                : ""
            }`}
          >
            {displayMessage}
          </div>
          {status === "pending" ? (
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-orange-400 border-t-blue-500" />
          ) : null}
        </div>
        {status === "error" ? (
          <p className="text-sm text-foreground/70">
            You will be redirected shortly. Please try signing in manually if
            the issue persists.
          </p>
        ) : null}
      </div>
    </div>
  );
}
