"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "./AuthProvider";

export function NavBar() {
  const { user, scope, accessToken, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const role = (user?.role || "").toLowerCase();
  const normalizedScope = (scope || "").toLowerCase();
  const canSeeUpload = normalizedScope === "admin" || role !== "user";

  const handleLogout = async () => {
    setBusy(true);
    try {
      await logout();
      router.replace("/login");
    } finally {
      setBusy(false);
    }
  };

  return (
    <nav className="flex items-center gap-3 text-sm">
      {accessToken ? (
        <>
          {canSeeUpload ? (
            <Link className="hover:underline" href="/upload">
              Upload
            </Link>
          ) : null}
          {normalizedScope === "admin" ? (
            <Link className="hover:underline" href="/adminmanagement">
              Admin
            </Link>
          ) : null}
          <Link
            href="/profile"
            className="hidden sm:inline text-foreground/60 hover:underline"
          >
            {user?.display_name || user?.username || user?.email}
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            disabled={busy}
            className="rounded-full border border-foreground/20 px-3 py-1 text-xs font-medium hover:border-foreground/40 hover:bg-foreground/5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Signing out…" : "Log out"}
          </button>
        </>
      ) : (
        <>
      {pathname !== "/login" ? (
        <Link
          className="rounded-full border border-foreground/20 px-3 py-1 hover:border-foreground/40 hover:bg-foreground/5"
          href="/login"
        >
          Log in
        </Link>
      ) : null}
      {pathname !== "/register" ? (
        <Link
          className="rounded-full border border-foreground/20 px-3 py-1 hover:border-foreground/40 hover:bg-foreground/5"
          href="/register"
        >
          Register
        </Link>
      ) : null}
      {pathname !== "/temp-login" ? (
        <Link
          className="rounded-full border border-foreground/20 px-3 py-1 hover:border-foreground/40 hover:bg-foreground/5"
          href="/temp-login"
        >
          Temporary login
        </Link>
      ) : null}
        </>
      )}
    </nav>
  );
}
