"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CardSkeleton,
  StatCardSkeleton,
} from "@/components/ui/loading-skeleton";
import { api } from "@/lib/trpc";
import type { Template, TemplateExercise, Session } from "@/lib/types";
import {
  Dumbbell,
  Target,
  TrendingUp,
  Play,
  BarChart3,
  Plus,
  Calendar,
  Activity,
  Clock,
  Zap,
  ArrowRight,
} from "lucide-react";

export default function HomePage() {
  const { data: session, status } = useSession();
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update time every minute for greeting
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Optimized queries with proper loading states
  const { data: templates = [], isLoading: isLoadingTemplates } =
    api.template.getAll.useQuery(
      undefined,
      { enabled: !!session, staleTime: 5 * 60 * 1000 } // Cache for 5 minutes
    );

  const { data: recentSession, isLoading: isLoadingSession } =
    api.session.getHistory.useQuery(
      { limit: 1 },
      { enabled: !!session, staleTime: 2 * 60 * 1000 } // Cache for 2 minutes
    );

  const { data: currentWeightData } =
    api.progress.getBodyWeightHistory.useQuery(
      { timeframe: "week" },
      { enabled: !!session, staleTime: 10 * 60 * 1000 } // Cache for 10 minutes
    );

  const { data: weeklyStats } = api.progress.getSessionHistory.useQuery(
    { limit: 7 },
    { enabled: !!session, staleTime: 5 * 60 * 1000 }
  );

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const getMuscleGroupColor = (muscleGroup: string) => {
    const colors: Record<string, string> = {
      chest: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      back: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      shoulders:
        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      arms: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
      legs: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      core: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    };
    return (
      colors[muscleGroup] ||
      "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
    );
  };

  if (status === "loading") {
    return (
      <div className="container mx-auto p-4 sm:p-6 space-y-6 sm:space-y-8">
        <div className="space-y-4">
          <div className="h-8 bg-muted rounded w-64 animate-pulse" />
          <div className="h-4 bg-muted rounded w-96 animate-pulse" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-[90vh] flex items-center justify-center">
        <div className="text-center space-y-6 max-w-2xl mx-auto p-6">
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="p-4 bg-primary/10 rounded-full">
                <Dumbbell className="h-16 w-16 text-primary" />
              </div>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">
              Track Your Fitness Journey
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-md mx-auto">
              Plan workouts, track progress, and achieve your goals with our
              comprehensive workout tracker.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto text-sm">
            <div className="text-center p-4 border rounded-lg">
              <Target className="h-8 w-8 text-primary mx-auto mb-2" />
              <h3 className="font-medium">Plan Workouts</h3>
              <p className="text-muted-foreground">Create custom templates</p>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <Activity className="h-8 w-8 text-primary mx-auto mb-2" />
              <h3 className="font-medium">Track Sessions</h3>
              <p className="text-muted-foreground">Log your workouts</p>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <BarChart3 className="h-8 w-8 text-primary mx-auto mb-2" />
              <h3 className="font-medium">View Progress</h3>
              <p className="text-muted-foreground">Analyze your gains</p>
            </div>
          </div>

          <div className="space-y-4">
            <Button size="lg" className="text-lg px-8 py-6" asChild>
              <Link href="/api/auth/signin">
                Get Started
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <p className="text-sm text-muted-foreground">
              Sign in with Google to start tracking your workouts
            </p>
          </div>
        </div>
      </div>
    );
  }

  const totalWeeklyVolume =
    weeklyStats?.reduce(
      (sum: number, session: { stats?: { totalVolume?: number } }) =>
        sum + (session.stats?.totalVolume || 0),
      0
    ) || 0;

  const averageSessionDuration = weeklyStats?.length
    ? Math.round(
        weeklyStats.reduce(
          (sum: number, session: { duration_minutes: number | null }) =>
            sum + (session.duration_minutes || 0),
          0
        ) / weeklyStats.length
      )
    : 0;

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6 sm:space-y-8">
      {/* Welcome Header */}
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold">
          {getGreeting()}, {session.user?.name?.split(" ")[0] || "Athlete"}! 💪
        </h1>
        <p className="text-muted-foreground">
          Ready to crush your workout today? Let&apos;s see what you&apos;ve got
          planned.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoadingSession || !weeklyStats ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">This Week</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-xl sm:text-2xl font-bold">
                  {weeklyStats.length}
                </div>
                <p className="text-xs text-muted-foreground">
                  Sessions completed
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Weekly Volume
                </CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-xl sm:text-2xl font-bold">
                  {Math.round(totalWeeklyVolume)}
                </div>
                <p className="text-xs text-muted-foreground">kg total lifted</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Avg Duration
                </CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-xl sm:text-2xl font-bold">
                  {averageSessionDuration}
                </div>
                <p className="text-xs text-muted-foreground">
                  minutes per session
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Current Weight
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-lg sm:text-xl font-bold">
                  {currentWeightData?.[0]
                    ? `${currentWeightData[0].weight} ${currentWeightData[0].unit}`
                    : "No data"}
                </div>
                <p className="text-xs text-muted-foreground">Body weight</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button asChild className="w-full justify-start h-12">
              <Link href="/sessions">
                <Play className="h-4 w-4 mr-2" />
                Start New Workout
              </Link>
            </Button>
            <Button
              variant="outline"
              asChild
              className="w-full justify-start h-12"
            >
              <Link href="/templates">
                <Plus className="h-4 w-4 mr-2" />
                Create Template
              </Link>
            </Button>
            <Button
              variant="outline"
              asChild
              className="w-full justify-start h-12"
            >
              <Link href="/progress">
                <BarChart3 className="h-4 w-4 mr-2" />
                View Progress
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Workout Templates */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Your Templates
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/templates">View All</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {isLoadingTemplates ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-12 bg-muted rounded animate-pulse"
                  />
                ))}
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-8">
                <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">No templates yet</p>
                <Button asChild>
                  <Link href="/templates">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Template
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {templates.slice(0, 3).map((template: Template) => (
                  <div
                    key={template.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-lg font-bold text-primary">
                        {template.dayNumber}
                      </div>
                      <div>
                        <div className="font-medium">{template.name}</div>
                        <div className="text-sm text-muted-foreground flex flex-wrap gap-1">
                          {template.template_exercises
                            ?.slice(0, 2)
                            .map((te: TemplateExercise, idx: number) => (
                              <Badge
                                key={idx}
                                variant="outline"
                                className={`text-xs ${getMuscleGroupColor(
                                  te.exercise?.muscleGroup as string
                                )}`}
                              >
                                {te.exercise?.muscleGroup}
                              </Badge>
                            ))}
                          {template.template_exercises?.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{template.template_exercises.length - 2}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" asChild>
                      <Link href={`/sessions?template=${template.id}`}>
                        <Play className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      {recentSession && recentSession.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentSession.slice(0, 2).map((session: Session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div>
                    <div className="font-medium">
                      {session.workout_templates?.name ||
                        `Day ${session.workout_templates?.dayNumber}`}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {session.start_time &&
                        new Date(session.start_time).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">
                      {session.duration_minutes || 0}min
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {session.completed ? "Completed" : "In Progress"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
