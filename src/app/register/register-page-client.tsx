"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { useAuth } from "@/components/auth/AuthProvider";

export function RegisterPageClient() {
  const { accessToken, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && accessToken) {
      router.replace("/");
    }
  }, [loading, accessToken, router]);

  return (
    <div className="min-h-[calc(100vh-4rem)] px-4 py-10">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 rounded-3xl border border-foreground/10 bg-white/5 p-6 text-foreground shadow-sm backdrop-blur">
        <div>
          <h1 className="text-2xl font-semibold">Create your account</h1>
          <p className="mt-2 text-sm text-foreground/60">
            Verify your email, tell us a little about your family, and you&apos;re ready to explore.
          </p>
        </div>
        <RegisterForm />
        <p className="text-center text-xs text-foreground/60">
          Already have an account?{" "}
          <Link className="font-semibold underline" href="/login">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
