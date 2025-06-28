"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Play,
  Clock,
  Calendar,
  Target,
  Dumbbell,
  Trophy,
  History,
} from "lucide-react";
import { api } from "@/lib/trpc";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";

export default function SessionsPage() {
  const router = useRouter();
  const [, setSelectedTemplateId] = useState<string>("");

  const { data: currentSession } = api.session.getCurrent.useQuery();
  const { data: templates } = api.template.getAll.useQuery();
  const { data: sessionHistory } = api.session.getHistory.useQuery({
    limit: 10,
  });

  const startSessionMutation = api.session.start.useMutation({
    onSuccess: (session) => {
      toast.success("Workout session started! 💪");
      router.push(`/sessions/${session.id}`);
    },
    onError: (error) => {
      toast.error("Failed to start session: " + error.message);
    },
  });

  const handleStartWorkout = async (templateId: string) => {
    try {
      await startSessionMutation.mutateAsync({ templateId });
    } catch (error) {
      console.error("Failed to start session:", error);
    }
  };

  const handleResumeSession = () => {
    if (currentSession) {
      toast.info("Resuming workout session");
      router.push(`/sessions/${currentSession.id}`);
    }
  };

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return "N/A";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const getDayName = (dayNumber: number) => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return days[dayNumber - 1] || `Day ${dayNumber}`;
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Workout Sessions</h1>
          <p className="text-muted-foreground">
            Start new workouts or continue your fitness journey
          </p>
        </div>
      </div>

      {/* Active Session Alert */}
      {currentSession && (
        <Card className="mb-6 border-orange-200 bg-orange-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-3 w-3 bg-orange-500 rounded-full animate-pulse" />
                <div>
                  <h3 className="font-semibold">Active Workout</h3>
                  <p className="text-sm text-muted-foreground">
                    {currentSession.workout_templates?.name} • Started{" "}
                    {formatDistanceToNow(new Date(currentSession.start_time), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
              </div>
              <Button onClick={handleResumeSession}>
                <Play className="h-4 w-4 mr-2" />
                Resume Workout
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="start" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="start">Start Workout</TabsTrigger>
          <TabsTrigger value="history">Session History</TabsTrigger>
        </TabsList>

        <TabsContent value="start" className="mt-6">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold mb-4">Choose a Template</h2>

            {templates && templates.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {templates.map((template) => (
                  <Card
                    key={template.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => setSelectedTemplateId(template.id)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg">
                            {template.name}
                          </CardTitle>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline">
                              {getDayName(template.dayNumber)}
                            </Badge>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Dumbbell className="h-3 w-3" />
                              {template.template_exercises?.length || 0}{" "}
                              exercises
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Target className="h-3 w-3" />
                            {template.template_exercises?.reduce(
                              (sum, te) => sum + te.sets,
                              0
                            ) || 0}{" "}
                            sets
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />~
                            {(template.template_exercises?.length || 0) * 3 +
                              (template.template_exercises?.reduce(
                                (sum, te) => sum + te.sets,
                                0
                              ) || 0) *
                                2}{" "}
                            min
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartWorkout(template.id);
                          }}
                          disabled={
                            startSessionMutation.isPending || !!currentSession
                          }
                        >
                          {startSessionMutation.isPending
                            ? "Starting..."
                            : "Start"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="border-dashed">
                <CardContent className="p-8 text-center">
                  <Dumbbell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">No Templates Found</h3>
                  <p className="text-muted-foreground mb-4">
                    Create a workout template first to start a session.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => router.push("/templates")}
                  >
                    Create Template
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5" />
              <h2 className="text-xl font-semibold">Recent Sessions</h2>
            </div>

            {sessionHistory && sessionHistory.length > 0 ? (
              <div className="space-y-3">
                {sessionHistory.map((session) => (
                  <Card key={session.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <Trophy className="h-4 w-4 text-green-600" />
                            <div>
                              <h4 className="font-medium">
                                {session.workout_templates?.name}
                              </h4>
                              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {format(
                                    new Date(session.start_time),
                                    "MMM d, yyyy"
                                  )}
                                </div>
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {formatDuration(session.duration_minutes)}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">
                            {getDayName(
                              session.workout_templates?.dayNumber || 1
                            )}
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              router.push(`/sessions/${session.id}`)
                            }
                          >
                            View Details
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="border-dashed">
                <CardContent className="p-8 text-center">
                  <History className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">No Session History</h3>
                  <p className="text-muted-foreground">
                    Complete your first workout to see your session history
                    here.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
