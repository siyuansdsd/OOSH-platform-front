"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { useAuth } from "@/components/auth/AuthProvider";

export default function LoginPage() {
  const { accessToken, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && accessToken) {
      router.replace("/");
    }
  }, [loading, accessToken, router]);

  return (
    <div className="min-h-[calc(100vh-4rem)] px-4 py-10">
      <div className="glass-panel mx-auto flex w-full max-w-md flex-col gap-6 rounded-3xl p-6 text-foreground shadow-lg">
        <div>
          <h1 className="text-2xl font-semibold">Sign in</h1>
          <p className="mt-2 text-sm text-foreground/60">
            Enter your credentials and verification code to access the platform.
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
