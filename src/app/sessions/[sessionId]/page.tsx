"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Square,
  Clock,
  Target,
  CheckCircle2,
  Circle,
  Timer,
  Save,
} from "lucide-react";
import { api } from "@/lib/trpc";
import { toast } from "sonner";
import { LiveSetLogger } from "@/components/sessions/live-set-logger";
import { SessionTimer } from "@/components/sessions/session-timer";
import { PreviousSessionValues } from "@/components/sessions/previous-session-values";

interface SessionPageProps {
  params: Promise<{
    sessionId: string;
  }>;
}

export default function SessionPage({ params }: SessionPageProps) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [restTimer, setRestTimer] = useState(0);
  const [isResting, setIsResting] = useState(false);

  const { data: session, refetch } =
    api.session.getSessionWithExercises.useQuery({
      sessionId: resolvedParams.sessionId,
    });

  const completeSessionMutation = api.session.complete.useMutation({
    onSuccess: () => {
      toast.success("Workout completed! Great job! 🎉");
      router.push("/sessions");
    },
    onError: (error) => {
      toast.error("Failed to complete session: " + error.message);
    },
  });

  // Rest timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isResting && restTimer > 0) {
      interval = setInterval(() => {
        setRestTimer((prev) => {
          if (prev <= 1) {
            setIsResting(false);
            toast.success("Rest period finished!");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isResting, restTimer]);

  const handleCompleteSession = async () => {
    try {
      await completeSessionMutation.mutateAsync({
        sessionId: resolvedParams.sessionId,
      });
    } catch (error) {
      console.error("Failed to complete session:", error);
    }
  };

  const handleEndWorkout = () => {
    toast("End workout session?", {
      description: "Your progress will be saved.",
      action: {
        label: "End Session",
        onClick: () => handleCompleteSession(),
      },
      cancel: {
        label: "Continue",
        onClick: () => {},
      },
    });
  };

  const startRestTimer = (seconds: number = 120) => {
    setRestTimer(seconds);
    setIsResting(true);
    toast.success(
      `Rest timer started: ${Math.floor(seconds / 60)}:${(seconds % 60)
        .toString()
        .padStart(2, "0")}`
    );
  };

  const stopRestTimer = () => {
    setIsResting(false);
    setRestTimer(0);
    toast.info("Rest timer stopped");
  };

  const formatRestTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (!session) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Loading session...</h1>
        </div>
      </div>
    );
  }

  const exercises =
    session.session_exercises?.sort((a, b) => a.order_index - b.order_index) ||
    [];
  const currentExercise = exercises[currentExerciseIndex];
  const totalExercises = exercises.length;
  const completedSets = exercises.reduce(
    (total, ex) =>
      total +
      (ex.session_sets?.filter((set: any) => set.completed).length || 0),
    0
  );
  const totalSets = exercises.reduce(
    (total, ex) => total + (ex.session_sets?.length || 0),
    0
  );

  const getMuscleGroupColor = (muscleGroup: string) => {
    const colors: Record<string, string> = {
      chest: "bg-red-100 text-red-800",
      back: "bg-blue-100 text-blue-800",
      shoulders: "bg-yellow-100 text-yellow-800",
      arms: "bg-purple-100 text-purple-800",
      legs: "bg-green-100 text-green-800",
      core: "bg-orange-100 text-orange-800",
    };
    return colors[muscleGroup] || "bg-gray-100 text-gray-800";
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">
            {session.workout_templates?.name}
          </h1>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Target className="h-4 w-4" />
              {completedSets}/{totalSets} sets
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              Exercise {currentExerciseIndex + 1}/{totalExercises}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <SessionTimer startTime={session.start_time} />
          <Button variant="outline" size="sm" onClick={handleEndWorkout}>
            <Square className="h-4 w-4 mr-1" />
            End
          </Button>
        </div>
      </div>

      {/* Rest Timer */}
      {isResting && (
        <Card className="mb-6 border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Timer className="h-5 w-5 text-blue-600" />
                <div>
                  <h3 className="font-semibold">Rest Period</h3>
                  <p className="text-sm text-muted-foreground">
                    Time remaining: {formatRestTime(restTimer)}
                  </p>
                </div>
              </div>
              <Button variant="outline" onClick={stopRestTimer}>
                Skip Rest
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Exercise Area */}
        <div className="lg:col-span-2 space-y-6">
          {/* Current Exercise */}
          {currentExercise && (
            <Card>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-xl">
                      {currentExercise.exercises?.name}
                    </CardTitle>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge
                        variant="secondary"
                        className={getMuscleGroupColor(
                          currentExercise.exercises?.muscle_group || ""
                        )}
                      >
                        {currentExercise.exercises?.muscle_group}
                      </Badge>
                      {currentExercise.exercises?.equipment && (
                        <Badge variant="outline">
                          {currentExercise.exercises.equipment}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentExerciseIndex === 0}
                      onClick={() =>
                        setCurrentExerciseIndex((prev) => Math.max(0, prev - 1))
                      }
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentExerciseIndex === totalExercises - 1}
                      onClick={() =>
                        setCurrentExerciseIndex((prev) =>
                          Math.min(totalExercises - 1, prev + 1)
                        )
                      }
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <LiveSetLogger
                  sessionExercise={currentExercise}
                  onSetComplete={() => {
                    refetch();
                    // Use the rest time from template exercise, fallback to 120 seconds
                    const restTime =
                      currentExercise.template_exercise?.restTimeSeconds || 120;
                    startRestTimer(restTime);
                  }}
                />
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Exercise List */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Exercises</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {exercises.map((exercise, index) => {
                const completedSetsCount =
                  exercise.session_sets?.filter((set: any) => set.completed)
                    .length || 0;
                const totalSetsCount = exercise.session_sets?.length || 0;
                const isCompleted =
                  completedSetsCount === totalSetsCount && totalSetsCount > 0;
                const isCurrent = index === currentExerciseIndex;

                return (
                  <div
                    key={exercise.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      isCurrent
                        ? "border-primary bg-primary/5"
                        : isCompleted
                        ? "border-green-200 bg-green-50"
                        : "border-gray-200"
                    }`}
                    onClick={() => setCurrentExerciseIndex(index)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {isCompleted ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <Circle className="h-4 w-4 text-gray-400" />
                        )}
                        <span
                          className={`text-sm font-medium ${
                            isCurrent ? "text-primary" : ""
                          }`}
                        >
                          {exercise.exercises?.name}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {completedSetsCount}/{totalSetsCount}
                      </span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Previous Session Values */}
          {currentExercise && (
            <PreviousSessionValues exerciseId={currentExercise.exercise_id} />
          )}
        </div>
      </div>

      {/* Complete Session Button */}
      {completedSets === totalSets && totalSets > 0 && (
        <Card className="mt-6 border-green-200 bg-green-50">
          <CardContent className="p-4 text-center">
            <h3 className="font-semibold text-green-800 mb-2">
              Workout Complete! 🎉
            </h3>
            <p className="text-sm text-green-700 mb-4">
              You&apos;ve completed all exercises. Great job!
            </p>
            <Button
              onClick={handleCompleteSession}
              className="bg-green-600 hover:bg-green-700"
            >
              <Save className="h-4 w-4 mr-2" />
              Complete Session
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
