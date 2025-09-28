"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { HomePageClient } from "@/components/home/HomePageClient";

export default function Home() {
  return (
    <ProtectedRoute>
      <div className="min-h-[calc(100vh-4rem)] px-4 py-10">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
          <section className="glass-panel rounded-3xl p-8 text-foreground shadow-sm">
            <h1 className="text-3xl font-semibold sm:text-4xl">
              Discover <span className="bg-gradient-to-r from-orange-500 to-orange-600 bg-clip-text text-transparent">Max Hacker Tech Club</span> student projects
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
