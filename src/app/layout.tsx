import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { NavBar } from "@/components/auth/NavBar";
import { BRAND_LOGO_URL, BRAND_NAME } from "@/constants/branding";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MaxHacker OOSH Platform",
  description: "A minimal upload platform",
  icons: {
    icon: [
      { url: BRAND_LOGO_URL, type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          <header className="sticky top-0 z-20 border-b border-foreground/10 backdrop-blur supports-[backdrop-filter]:bg-white/40 dark:supports-[backdrop-filter]:bg-black/30">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-2 py-3">
              <a href="/" className="flex items-center gap-2 font-semibold">
                <img
                  src={BRAND_LOGO_URL}
                  alt={`${BRAND_NAME} logo`}
                  className="h-10 w-10 rounded-full border border-white/40 bg-white/80 object-contain shadow-sm"
                />
                <span className="hidden text-lg sm:inline">{BRAND_NAME}</span>
              </a>
              <NavBar />
            </div>
          </header>
          <main>{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
