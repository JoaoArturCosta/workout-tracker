import "@/app/globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import { Providers } from "@/components/providers";
import { ErrorBoundary } from "@/components/error-boundary";
import { Button } from "@/components/ui/button";
import { Dumbbell, TrendingUp, Play, BarChart3 } from "lucide-react";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Workout Tracker",
  description: "Plan workouts, track progress, achieve your goals",
  manifest: "/manifest.json",
  keywords: ["workout", "fitness", "tracker", "exercise", "progress", "health"],
  authors: [{ name: "Workout Tracker Team" }],
  creator: "Workout Tracker",
  publisher: "Workout Tracker",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXTAUTH_URL || "http://localhost:3000"),
  openGraph: {
    title: "Workout Tracker",
    description: "Plan workouts, track progress, achieve your goals",
    url: "/",
    siteName: "Workout Tracker",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Workout Tracker",
    description: "Plan workouts, track progress, achieve your goals",
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: "cover",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Workout Tracker",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#000000" />
        <meta name="background-color" content="#ffffff" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body className={inter.className}>
        <ErrorBoundary>
          <Providers>
            <div className="min-h-screen bg-background">
              <nav className="border-b bg-white sticky top-0 z-50">
                <div className="container mx-auto px-4">
                  <div className="flex items-center justify-between h-16">
                    <Link
                      href="/"
                      className="flex items-center gap-2 font-bold text-lg"
                    >
                      <Dumbbell className="h-6 w-6" />
                      Workout Tracker
                    </Link>

                    <div className="flex items-center gap-2 md:gap-4 overflow-x-auto">
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        className="shrink-0"
                      >
                        <Link
                          href="/templates"
                          className="flex items-center gap-2"
                        >
                          <TrendingUp className="h-4 w-4" />
                          <span className="hidden sm:inline">Templates</span>
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        className="shrink-0"
                      >
                        <Link
                          href="/sessions"
                          className="flex items-center gap-2"
                        >
                          <Play className="h-4 w-4" />
                          <span className="hidden sm:inline">Sessions</span>
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        className="shrink-0"
                      >
                        <Link
                          href="/progress"
                          className="flex items-center gap-2"
                        >
                          <BarChart3 className="h-4 w-4" />
                          <span className="hidden sm:inline">Progress</span>
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </nav>
              <main className="flex-1 pb-safe">{children}</main>
            </div>
          </Providers>
        </ErrorBoundary>
      </body>
    </html>
  );
}
