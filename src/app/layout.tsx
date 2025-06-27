import "@/app/globals.css";
import { Inter } from "next/font/google";
import Link from "next/link";
import { Providers } from "@/components/providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Workout Tracker",
  description: "Track your workouts and progress",
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
            <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <div className="container mx-auto px-4">
                <div className="flex h-16 items-center justify-between">
                  <div className="flex items-center space-x-8">
                    <Link href="/" className="text-xl font-bold">
                      Workout Tracker
                    </Link>
                    <div className="hidden md:flex items-center space-x-6">
                      <Link
                        href="/exercises"
                        className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Exercises
                      </Link>
                      <Link
                        href="/templates"
                        className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Templates
                      </Link>
                      <Link
                        href="/sessions"
                        className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Sessions
                      </Link>
                      <Link
                        href="/progress"
                        className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Progress
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </nav>
            <main>{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
