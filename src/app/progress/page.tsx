"use client";

import { useState } from "react";
import { api } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  StatCardSkeleton,
  CardSkeleton,
  ListItemSkeleton,
} from "@/components/ui/loading-skeleton";
import {
  Loader2,
  TrendingUp,
  Activity,
  Target,
  Calendar,
  AlertCircle,
  Wifi,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";

export default function ProgressPage() {
  const [selectedExercise, setSelectedExercise] = useState<string>("");
  const [timeframe, setTimeframe] = useState<"week" | "month" | "year">(
    "month"
  );
  const [bodyWeight, setBodyWeight] = useState("");
  const [bodyWeightUnit, setBodyWeightUnit] = useState<"kg" | "lbs">("kg");

  // Queries with loading and error states
  const {
    data: exercises = [],
    isLoading: isLoadingExercises,
    error: exercisesError,
  } = api.exercise.getAll.useQuery({});
  const {
    data: bodyWeightHistory = [],
    isLoading: isLoadingBodyWeight,
    error: bodyWeightError,
  } = api.progress.getBodyWeightHistory.useQuery({ timeframe });
  const {
    data: sessionHistory = [],
    isLoading: isLoadingHistory,
    error: historyError,
  } = api.progress.getSessionHistory.useQuery({ limit: 10 });
  const {
    data: personalRecords = [],
    isLoading: isLoadingRecords,
    error: recordsError,
  } = api.progress.getPersonalRecords.useQuery({ timeframe });

  const {
    data: oneRM,
    isLoading: isLoadingOneRM,
    error: oneRMError,
  } = api.progress.getOneRM.useQuery(
    { exerciseId: selectedExercise },
    { enabled: !!selectedExercise }
  );

  const {
    data: volumeProgression = [],
    isLoading: isLoadingVolume,
    error: volumeError,
  } = api.progress.getVolumeProgression.useQuery(
    { exerciseId: selectedExercise, timeframe },
    { enabled: !!selectedExercise }
  );

  const {
    data: strengthStandards,
    isLoading: isLoadingStandards,
    error: standardsError,
  } = api.progress.getStrengthStandards.useQuery(
    { exerciseId: selectedExercise },
    { enabled: !!selectedExercise }
  );

  // Mutations
  const utils = api.useUtils();
  const logBodyWeightMutation = api.progress.logBodyWeight.useMutation({
    onSuccess: () => {
      toast.success("Body weight logged successfully!");
      setBodyWeight("");
      utils.progress.getBodyWeightHistory.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to log body weight: ${error.message}`);
    },
  });

  const handleLogBodyWeight = () => {
    const weight = parseFloat(bodyWeight);
    if (isNaN(weight) || weight <= 0) {
      toast.error("Please enter a valid weight");
      return;
    }

    logBodyWeightMutation.mutate({
      weight,
      unit: bodyWeightUnit,
    });
  };

  const selectedExerciseName =
    exercises.find((e) => e.id === selectedExercise)?.name || "";

  // Error display component
  const ErrorDisplay = ({
    error,
    retry,
  }: {
    error: any;
    retry?: () => void;
  }) => (
    <div className="text-center py-8">
      <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
      <p className="text-muted-foreground mb-4">
        {error?.message || "Failed to load data"}
      </p>
      {retry && (
        <Button variant="outline" onClick={retry}>
          Try again
        </Button>
      )}
    </div>
  );

  // Network status indicator
  const [isOnline, setIsOnline] = useState(true);

  if (typeof window !== "undefined") {
    window.addEventListener("online", () => setIsOnline(true));
    window.addEventListener("offline", () => setIsOnline(false));
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6 sm:space-y-8">
      {/* Network status indicator */}
      {!isOnline && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
          <div className="flex">
            <WifiOff className="h-5 w-5 text-yellow-400" />
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                You're currently offline. Some features may be limited.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Progress Analytics</h1>
          <p className="text-muted-foreground">
            Track your fitness journey with detailed analytics and insights
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Wifi className="h-4 w-4" />
          <span>{isOnline ? "Online" : "Offline"}</span>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-5 h-auto">
          <TabsTrigger value="overview" className="text-xs sm:text-sm">
            Overview
          </TabsTrigger>
          <TabsTrigger value="one-rm" className="text-xs sm:text-sm">
            1RM & PRs
          </TabsTrigger>
          <TabsTrigger value="volume" className="text-xs sm:text-sm">
            Volume
          </TabsTrigger>
          <TabsTrigger value="body-weight" className="text-xs sm:text-sm">
            Weight
          </TabsTrigger>
          <TabsTrigger value="history" className="text-xs sm:text-sm">
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Quick Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {isLoadingHistory || isLoadingRecords || isLoadingBodyWeight ? (
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
                    <CardTitle className="text-sm font-medium">
                      Total Sessions
                    </CardTitle>
                    <Activity className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {sessionHistory.length}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Last 20 sessions
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Personal Records
                    </CardTitle>
                    <Target className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {personalRecords.length}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      This {timeframe}
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
                    <div className="text-xl sm:text-2xl font-bold">
                      {bodyWeightHistory[0]
                        ? `${bodyWeightHistory[0].weight} ${bodyWeightHistory[0].unit}`
                        : "No data"}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Latest entry
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Avg Session Volume
                    </CardTitle>
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl sm:text-2xl font-bold">
                      {sessionHistory.length > 0
                        ? Math.round(
                            sessionHistory.reduce(
                              (sum, s: any) => sum + s.stats.totalVolume,
                              0
                            ) / sessionHistory.length
                          )
                        : 0}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      kg total volume
                    </p>
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          {/* Recent Personal Records */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Personal Records</CardTitle>
            </CardHeader>
            <CardContent>
              {recordsError ? (
                <ErrorDisplay error={recordsError} />
              ) : isLoadingRecords ? (
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <ListItemSkeleton key={i} />
                  ))}
                </div>
              ) : personalRecords.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No personal records found for this timeframe
                </p>
              ) : (
                <div className="space-y-4">
                  {personalRecords.slice(0, 5).map((pr: any) => (
                    <div
                      key={pr.exerciseId}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg gap-4"
                    >
                      <div>
                        <h4 className="font-medium">{pr.exerciseName}</h4>
                        <Badge variant="outline" className="mt-1">
                          {pr.muscleGroup}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">
                          {pr.maxWeight.weight}kg × {pr.maxWeight.reps}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          1RM: {Math.round(pr.maxOneRM.oneRM)}kg
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="one-rm" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Exercise Selection</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="exercise-select">Select Exercise</Label>
                  {exercisesError ? (
                    <ErrorDisplay error={exercisesError} />
                  ) : isLoadingExercises ? (
                    <div className="h-10 bg-muted rounded animate-pulse" />
                  ) : (
                    <Select
                      value={selectedExercise}
                      onValueChange={setSelectedExercise}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose an exercise..." />
                      </SelectTrigger>
                      <SelectContent>
                        {exercises.map((exercise) => (
                          <SelectItem key={exercise.id} value={exercise.id}>
                            {exercise.name} ({exercise.muscleGroup})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {selectedExercise && (
            <>
              {/* 1RM Display */}
              {oneRMError ? (
                <Card>
                  <CardContent>
                    <ErrorDisplay error={oneRMError} />
                  </CardContent>
                </Card>
              ) : isLoadingOneRM ? (
                <CardSkeleton />
              ) : oneRM ? (
                <Card>
                  <CardHeader>
                    <CardTitle>One Rep Max - {selectedExerciseName}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center space-y-4">
                      <div className="text-4xl font-bold text-primary">
                        {oneRM.oneRepMax} kg
                      </div>
                      <p className="text-muted-foreground">
                        Calculated from your best sets using Epley formula
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                        {oneRM.calculations
                          .slice(0, 4)
                          .map((calc: any, index) => (
                            <div
                              key={index}
                              className="text-center p-4 border rounded-lg"
                            >
                              <div className="font-bold">
                                {calc.weight}kg × {calc.reps}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                1RM: {calc.oneRM}kg
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {/* Strength Standards */}
              {standardsError ? (
                <Card>
                  <CardContent>
                    <ErrorDisplay error={standardsError} />
                  </CardContent>
                </Card>
              ) : isLoadingStandards ? (
                <CardSkeleton />
              ) : strengthStandards ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Strength Standards</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="text-center">
                        <Badge
                          variant="outline"
                          className="text-base sm:text-lg px-4 py-2"
                        >
                          Current Level:{" "}
                          {strengthStandards.currentLevel.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                        {Object.entries(strengthStandards.standards).map(
                          ([level, weight]) => (
                            <div
                              key={level}
                              className={`text-center p-3 sm:p-4 border rounded-lg ${
                                level === strengthStandards.currentLevel
                                  ? "border-primary bg-primary/10"
                                  : ""
                              }`}
                            >
                              <div className="font-medium capitalize text-sm sm:text-base">
                                {level}
                              </div>
                              <div className="text-xs sm:text-sm text-muted-foreground">
                                {weight}kg
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : null}
            </>
          )}
        </TabsContent>

        <TabsContent value="volume" className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
            <Select
              value={timeframe}
              onValueChange={(value: "week" | "month" | "year") =>
                setTimeframe(value)
              }
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Last Week</SelectItem>
                <SelectItem value="month">Last Month</SelectItem>
                <SelectItem value="year">Last Year</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {volumeError ? (
            <Card>
              <CardContent>
                <ErrorDisplay error={volumeError} />
              </CardContent>
            </Card>
          ) : isLoadingVolume ? (
            <CardSkeleton />
          ) : selectedExercise && volumeProgression.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>
                  Volume Progression - {selectedExerciseName}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {volumeProgression.slice(-7).map((data: any, index) => (
                      <div
                        key={index}
                        className="text-center p-4 border rounded-lg"
                      >
                        <div className="font-bold">{data.volume}kg</div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(data.date).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6">
                    <div className="text-center">
                      <div className="text-xl sm:text-2xl font-bold">
                        Total Volume:{" "}
                        {volumeProgression.reduce(
                          (sum: number, d: any) => sum + d.volume,
                          0
                        )}
                        kg
                      </div>
                      <div className="text-muted-foreground">
                        Over {volumeProgression.length} sessions
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : selectedExercise ? (
            <Card>
              <CardContent className="text-center py-12">
                <p className="text-muted-foreground">
                  No volume data available for {selectedExerciseName} in this
                  timeframe
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <p className="text-muted-foreground">
                  Select an exercise to view volume progression
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="body-weight" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Log Body Weight</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
                <div className="flex-1">
                  <Label htmlFor="weight">Weight</Label>
                  <Input
                    id="weight"
                    type="number"
                    placeholder="Enter weight..."
                    value={bodyWeight}
                    onChange={(e) => setBodyWeight(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div className="w-full sm:w-auto">
                  <Label htmlFor="unit">Unit</Label>
                  <Select
                    value={bodyWeightUnit}
                    onValueChange={(value: "kg" | "lbs") =>
                      setBodyWeightUnit(value)
                    }
                  >
                    <SelectTrigger className="w-full sm:w-[100px] mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kg">kg</SelectItem>
                      <SelectItem value="lbs">lbs</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end w-full sm:w-auto">
                  <Button
                    onClick={handleLogBodyWeight}
                    disabled={logBodyWeightMutation.isPending}
                    className="w-full sm:w-auto"
                  >
                    {logBodyWeightMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Log Weight
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Weight History</CardTitle>
            </CardHeader>
            <CardContent>
              {bodyWeightError ? (
                <ErrorDisplay error={bodyWeightError} />
              ) : isLoadingBodyWeight ? (
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <ListItemSkeleton key={i} />
                  ))}
                </div>
              ) : bodyWeightHistory.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No body weight entries found
                </p>
              ) : (
                <div className="space-y-4">
                  {bodyWeightHistory.map((entry: any) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div>
                        <div className="font-bold">
                          {entry.weight} {entry.unit}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(entry.loggedAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Session History</CardTitle>
            </CardHeader>
            <CardContent>
              {historyError ? (
                <ErrorDisplay error={historyError} />
              ) : isLoadingHistory ? (
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <CardSkeleton key={i} />
                  ))}
                </div>
              ) : sessionHistory.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No completed sessions found
                </p>
              ) : (
                <div className="space-y-4">
                  {sessionHistory.map((session: any) => (
                    <div
                      key={session.id}
                      className="p-4 sm:p-6 border rounded-lg"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-4">
                        <div>
                          <h3 className="font-bold">
                            {session.workout_templates?.name ||
                              `Day ${session.workout_templates?.day_number}`}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {session.start_time &&
                              new Date(session.start_time).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-left sm:text-right">
                          <div className="font-bold">
                            {session.stats.totalVolume}kg
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {session.stats.totalSets} sets •{" "}
                            {session.stats.exerciseCount} exercises
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {session.session_exercises.map(
                          (exercise: any, index: number) => (
                            <div
                              key={index}
                              className="flex items-center justify-between text-sm"
                            >
                              <span className="truncate pr-4">
                                {exercise.exercises?.name}
                              </span>
                              <span className="text-muted-foreground shrink-0">
                                {exercise.session_sets.length} sets
                              </span>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
