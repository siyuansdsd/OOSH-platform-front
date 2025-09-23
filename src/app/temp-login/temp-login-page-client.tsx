"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { TempLoginForm } from "@/components/auth/TempLoginForm";
import { useAuth } from "@/components/auth/AuthProvider";
import { BRAND_LOGO_URL, BRAND_NAME } from "@/constants/branding";

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
      <div className="glass-panel mx-auto flex w-full max-w-md flex-col gap-6 rounded-3xl p-6 text-foreground shadow-lg">
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
