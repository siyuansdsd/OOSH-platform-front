"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { LoginForm } from "@/components/auth/LoginForm";
import { useAuth } from "@/components/auth/AuthProvider";

export default function AdminLoginPage() {
  const { accessToken, scope, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && accessToken && scope === "admin") {
      router.replace("/adminmanagement");
    }
  }, [loading, accessToken, scope, router]);

  return (
    <div className="min-h-[calc(100vh-4rem)] px-4 py-10">
      <div className="mx-auto flex w-full max-w-md flex-col gap-6 rounded-3xl border border-foreground/10 bg-white/5 p-6 text-foreground shadow-sm backdrop-blur">
        <div>
          <h1 className="text-2xl font-semibold">Admin sign in</h1>
          <p className="mt-2 text-sm text-foreground/60">
            Admin access requires an administrator account and verification code.
          </p>
        </div>
        <LoginForm isAdmin />
      </div>
    </div>
  );
}
