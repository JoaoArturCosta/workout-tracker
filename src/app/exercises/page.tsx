"use client";

import { useState } from "react";
import { api } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Filter, Dumbbell } from "lucide-react";
import { CreateExerciseForm } from "@/components/exercises/create-exercise-form";
import { ExerciseCard } from "@/components/exercises/exercise-card";
import { useSession } from "next-auth/react";
import { MuscleGroupEnum } from "@/lib/schemas";
import type { z } from "zod";

type MuscleGroup = z.infer<typeof MuscleGroupEnum>;

const muscleGroups: { value: MuscleGroup; label: string }[] = [
  { value: "chest", label: "Chest" },
  { value: "back", label: "Back" },
  { value: "shoulders", label: "Shoulders" },
  { value: "arms", label: "Arms" },
  { value: "legs", label: "Legs" },
  { value: "core", label: "Core" },
];

export default function ExercisesPage() {
  const { data: session } = useSession();
  const [search, setSearch] = useState("");
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState<string>("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // Get all exercises with filters
  const { data: allExercises, isLoading: isLoadingAll } =
    api.exercise.getAll.useQuery({
      search: search.trim() || undefined,
      muscleGroup:
        selectedMuscleGroup === "all"
          ? undefined
          : (selectedMuscleGroup as MuscleGroup),
    });

  // Get custom exercises for authenticated users
  const { data: customExercises, isLoading: isLoadingCustom } =
    api.exercise.getCustom.useQuery(undefined, {
      enabled: !!session?.user,
    });

  const filteredExercises =
    allExercises?.filter((exercise) => {
      if (
        selectedMuscleGroup !== "all" &&
        exercise.muscleGroup !== selectedMuscleGroup
      ) {
        return false;
      }
      if (
        search.trim() &&
        !exercise.name.toLowerCase().includes(search.toLowerCase())
      ) {
        return false;
      }
      return true;
    }) || [];

  const handleCreateSuccess = () => {
    setIsCreateDialogOpen(false);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col gap-4 mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Dumbbell className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Exercise Database</h1>
              <p className="text-muted-foreground">
                Browse and manage exercises for your workouts
              </p>
            </div>
          </div>
          {session?.user && (
            <Dialog
              open={isCreateDialogOpen}
              onOpenChange={setIsCreateDialogOpen}
            >
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Custom Exercise
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Custom Exercise</DialogTitle>
                </DialogHeader>
                <CreateExerciseForm onSuccess={handleCreateSuccess} />
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search exercises..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select
              value={selectedMuscleGroup}
              onValueChange={setSelectedMuscleGroup}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Muscle group" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Groups</SelectItem>
                {muscleGroups.map((group) => (
                  <SelectItem key={group.value} value={group.value}>
                    {group.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Exercise Lists */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="all">All Exercises</TabsTrigger>
          <TabsTrigger value="custom" disabled={!session?.user}>
            My Custom Exercises
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {isLoadingAll
                ? "Loading..."
                : `${filteredExercises.length} exercises found`}
            </p>
            <div className="flex gap-2">
              {muscleGroups.map((group) => {
                const count =
                  allExercises?.filter((ex) => ex.muscleGroup === group.value)
                    .length || 0;
                return (
                  <Badge
                    key={group.value}
                    variant="secondary"
                    className="text-xs"
                  >
                    {group.label}: {count}
                  </Badge>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {isLoadingAll ? (
              // Loading skeleton
              Array.from({ length: 6 }).map((_, i) => (
                <Card key={i}>
                  <CardHeader>
                    <div className="h-4 bg-muted rounded animate-pulse" />
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="h-3 bg-muted rounded animate-pulse" />
                      <div className="h-3 bg-muted rounded w-2/3 animate-pulse" />
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : filteredExercises.length > 0 ? (
              filteredExercises.map((exercise) => (
                <ExerciseCard key={exercise.id} exercise={exercise} />
              ))
            ) : (
              <div className="col-span-full text-center py-8">
                <p className="text-muted-foreground">
                  No exercises found matching your criteria.
                </p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="custom" className="mt-6">
          <div className="mb-4">
            <p className="text-sm text-muted-foreground">
              {isLoadingCustom
                ? "Loading..."
                : `${customExercises?.length || 0} custom exercises`}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {isLoadingCustom ? (
              // Loading skeleton
              Array.from({ length: 3 }).map((_, i) => (
                <Card key={i}>
                  <CardHeader>
                    <div className="h-4 bg-muted rounded animate-pulse" />
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="h-3 bg-muted rounded animate-pulse" />
                      <div className="h-3 bg-muted rounded w-2/3 animate-pulse" />
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : customExercises && customExercises.length > 0 ? (
              customExercises.map((exercise) => (
                <ExerciseCard
                  key={exercise.id}
                  exercise={exercise}
                  showActions
                />
              ))
            ) : (
              <div className="col-span-full text-center py-8">
                <p className="text-muted-foreground">
                  You haven&apos;t created any custom exercises yet.
                </p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setIsCreateDialogOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Custom Exercise
                </Button>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
