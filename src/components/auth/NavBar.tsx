"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "./AuthProvider";
import { updateCurrentUser } from "@/lib/api/admin";

export function NavBar() {
  const { user, scope, accessToken, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  // Password change modal state
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const role = (user?.role || "").toLowerCase();
  const normalizedScope = (scope || "").toLowerCase();
  const canSeeUpload = normalizedScope === "admin" || role !== "user";
  const canChangePassword = ["employee", "admin"].includes(role);
  const isTemporaryAccount = role === "temporary";

  const handleLogout = async () => {
    setBusy(true);
    try {
      await logout();
      router.replace("/login");
    } finally {
      setBusy(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!newPassword || newPassword !== confirmPassword) {
      setError("Passwords don't match or are empty");
      return;
    }
    if (!accessToken) {
      setError("Not authenticated");
      return;
    }

    setChangingPassword(true);
    setError(null);
    try {
      // Debug log for troubleshooting
      console.log("Attempting password change for user:", { role, scope, normalizedScope });

      // Use the PATCH /api/users/me endpoint
      await updateCurrentUser({ password: newPassword }, accessToken);
      setShowPasswordChange(false);
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      console.error("Password change error:", err);

      // Check if it's a 403 error and provide more specific feedback
      if (err?.message?.includes('403') || err?.message?.toLowerCase().includes('forbidden')) {
        setError(`Access denied. User role: ${role}, scope: ${scope}. You may not have permission to change your password through this interface.`);
      } else {
        setError(err?.message || "Failed to change password");
      }
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <>
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
          {canChangePassword ? (
            <button
              type="button"
              onClick={() => setShowPasswordChange(true)}
              className="hidden sm:inline text-foreground/60 hover:underline"
              title="Click to change password"
            >
              {typeof user?.display_name === "string" && user.display_name
                ? user.display_name
                : typeof user?.username === "string" && user.username
                ? user.username
                : typeof user?.email === "string"
                ? user.email
                : "Profile"}
            </button>
          ) : isTemporaryAccount ? (
            <span className="hidden sm:inline text-foreground/60">
              {typeof user?.username === "string" && user.username
                ? user.username
                : "Temporary User"}
            </span>
          ) : (
            <Link
              href="/profile"
              className="hidden sm:inline text-foreground/60 hover:underline"
            >
              {typeof user?.display_name === "string" && user.display_name
                ? user.display_name
                : typeof user?.username === "string" && user.username
                ? user.username
                : typeof user?.email === "string"
                ? user.email
                : "Profile"}
            </Link>
          )}
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

      {/* Password Change Modal */}
      {showPasswordChange && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4" style={{ paddingTop: '15vh' }}>
          <div className="w-full max-w-md rounded-3xl bg-background p-6 text-foreground shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Change Password</h3>
              <button
                type="button"
                onClick={() => {
                  setShowPasswordChange(false);
                  setNewPassword("");
                  setConfirmPassword("");
                  setError(null);
                }}
                className="rounded-lg border border-foreground/20 px-3 py-1 text-sm"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <label className="text-sm text-foreground/80">
                New Password
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-foreground/15 bg-background/60 px-3 py-2"
                />
              </label>

              <label className="text-sm text-foreground/80">
                Confirm Password
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-foreground/15 bg-background/60 px-3 py-2"
                />
              </label>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordChange(false);
                    setNewPassword("");
                    setConfirmPassword("");
                    setError(null);
                  }}
                  className="rounded-lg border border-foreground/20 px-4 py-2 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handlePasswordChange}
                  disabled={changingPassword || !newPassword || newPassword !== confirmPassword}
                  className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {changingPassword ? "Changing..." : "Change Password"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
