"use client";

import { AdminManagementClient } from "@/components/admin/AdminManagementClient";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

export function AdminManagementPageClient() {
  return (
    <ProtectedRoute requiredScope="admin" redirectTo="/admin-login">
      <div className="min-h-[calc(100vh-4rem)] px-4 py-10">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
          <header className="rounded-3xl border border-foreground/10 bg-white/5 p-6 text-foreground shadow-sm backdrop-blur">
            <h1 className="text-2xl font-semibold">Administration</h1>
            <p className="mt-2 text-sm text-foreground/70">
              Review and manage homework submissions and user accounts. Select items to apply
              bulk actions, or open an entry to edit details.
            </p>
          </header>
          <AdminManagementClient />
        </div>
      </div>
    </ProtectedRoute>
  );
}
