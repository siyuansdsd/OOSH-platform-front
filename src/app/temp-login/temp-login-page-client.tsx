"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { TempLoginForm } from "@/components/auth/TempLoginForm";
import { useAuth } from "@/components/auth/AuthProvider";

export function TempLoginPageClient() {
  const { accessToken, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && accessToken) {
      router.replace("/");
    }
  }, [loading, accessToken, router]);

  return (
    <div className="min-h-[calc(100vh-4rem)] px-4 py-10">
      <div className="mx-auto flex w-full max-w-md flex-col gap-6 rounded-3xl border border-foreground/10 bg-white/5 p-6 text-foreground shadow-sm backdrop-blur">
        <div>
          <h1 className="text-2xl font-semibold">Temporary login</h1>
          <p className="mt-2 text-sm text-foreground/60">
            Enter the temporary username and password provided to you.
          </p>
        </div>
        <TempLoginForm />
      </div>
    </div>
  );
}
