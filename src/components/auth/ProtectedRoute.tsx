"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredScope?: "admin";
  redirectTo?: string;
}

export function ProtectedRoute({ children, requiredScope, redirectTo }: ProtectedRouteProps) {
  const { accessToken, scope, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!accessToken) {
      router.replace(redirectTo || (requiredScope === "admin" ? "/admin-login" : "/login"));
      return;
    }
    if (requiredScope === "admin" && scope !== "admin") {
      router.replace("/admin-login");
    }
  }, [accessToken, scope, loading, redirectTo, requiredScope, router]);

  if (!accessToken || (requiredScope === "admin" && scope !== "admin")) {
    return null;
  }
  return <>{children}</>;
}
