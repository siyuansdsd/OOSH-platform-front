"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { HomePageClient } from "@/components/home/HomePageClient";

export default function Home() {
  return (
    <ProtectedRoute>
      <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-background via-background/95 to-background px-4 py-10">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
          <section className="rounded-3xl border border-foreground/10 bg-white/5 p-8 text-foreground shadow-sm backdrop-blur-md">
            <h1 className="text-3xl font-semibold sm:text-4xl">
              Discover Sydney student projects
            </h1>
            <p className="mt-3 max-w-2xl text-base text-foreground/70">
              Browse video, image and website submissions from schools across
              Sydney. Use the search tools below to find a specific school or
              student team, or filter by content type to explore the gallery.
            </p>
          </section>

          <HomePageClient />
        </div>
      </div>
    </ProtectedRoute>
  );
}
