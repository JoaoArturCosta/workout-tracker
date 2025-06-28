import "@/app/globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import { Providers } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Dumbbell, Target, TrendingUp, Play } from "lucide-react";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Workout Tracker",
  description: "Plan workouts, track progress, achieve your goals",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <div className="min-h-screen bg-background">
            <nav className="border-b bg-white">
              <div className="container mx-auto px-4">
                <div className="flex items-center justify-between h-16">
                  <Link
                    href="/"
                    className="flex items-center gap-2 font-bold text-lg"
                  >
                    <Dumbbell className="h-6 w-6" />
                    Workout Tracker
                  </Link>

                  <div className="flex items-center gap-4">
                    <Button variant="ghost" asChild>
                      <Link
                        href="/exercises"
                        className="flex items-center gap-2"
                      >
                        <Target className="h-4 w-4" />
                        Exercises
                      </Link>
                    </Button>
                    <Button variant="ghost" asChild>
                      <Link
                        href="/templates"
                        className="flex items-center gap-2"
                      >
                        <TrendingUp className="h-4 w-4" />
                        Templates
                      </Link>
                    </Button>
                    <Button variant="ghost" asChild>
                      <Link
                        href="/sessions"
                        className="flex items-center gap-2"
                      >
                        <Play className="h-4 w-4" />
                        Sessions
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            </nav>
            <main className="flex-1">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
