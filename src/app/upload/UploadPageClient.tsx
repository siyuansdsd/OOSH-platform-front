"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import UploadFormClient from "@/components/upload/UploadFormClient";

export function UploadPageClient() {
  return (
    <ProtectedRoute>
      <div className="min-h-[calc(100vh-4rem)] px-4 py-8">
        <UploadFormClient />
      </div>
    </ProtectedRoute>
  );
}
