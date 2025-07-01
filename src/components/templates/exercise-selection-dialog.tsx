"use client";

import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Plus,
  Search,
  Dumbbell,
  ArrowLeft,
  Edit2,
  Check,
  X,
} from "lucide-react";
import { api } from "@/lib/trpc";
import {
  CreateExerciseSchema,
  MuscleGroupEnum,
  type MuscleGroup,
} from "@/lib/schemas";
import { toast } from "sonner";
import type { z } from "zod";

type CreateExerciseFormData = z.infer<typeof CreateExerciseSchema>;

// Exercise interface that matches what tRPC returns (dates are serialized as strings)
interface Exercise {
  id: string;
  name: string;
  muscleGroup: string;
  equipment: string | null;
  isCustom: boolean | null;
  userId: string | null;
  createdAt: string;
}

interface ExerciseSelectionDialogProps {
  trigger: React.ReactNode;
  onExerciseSelect: (exercise: Exercise) => void;
  title?: string;
}

const muscleGroups = [
  { value: "chest", label: "Chest" },
  { value: "back", label: "Back" },
  { value: "shoulders", label: "Shoulders" },
  { value: "arms", label: "Arms" },
  { value: "legs", label: "Legs" },
  { value: "core", label: "Core" },
] as const;

// Simple string similarity function for duplicate detection
function similarity(a: string, b: string): number {
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;

  if (longer.length === 0) return 1.0;

  return (longer.length - levenshteinDistance(longer, shorter)) / longer.length;
}

function levenshteinDistance(a: string, b: string): number {
  const matrix = Array(b.length + 1)
    .fill(null)
    .map(() => Array(a.length + 1).fill(null));

  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + indicator
      );
    }
  }

  return matrix[b.length][a.length];
}

export function ExerciseSelectionDialog({
  trigger,
  onExerciseSelect,
  title = "Add Exercise",
}: ExerciseSelectionDialogProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [muscleGroupFilter, setMuscleGroupFilter] = useState<string>("all");
  const [isCreating, setIsCreating] = useState(false);
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState<string>("");

  // Edit mode state
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(
    null
  );
  const [editForm, setEditForm] = useState<{
    name: string;
    muscleGroup: string;
    equipment: string;
  }>({
    name: "",
    muscleGroup: "",
    equipment: "",
  });

  const utils = api.useUtils();

  // Debounced search term
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Get exercises with search and filter
  const { data: exercises } = api.exercise.getAll.useQuery({
    muscleGroup:
      muscleGroupFilter === "all"
        ? undefined
        : (muscleGroupFilter as MuscleGroup),
    search: debouncedSearchTerm || undefined,
  });

  // Create exercise form
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset: resetForm,
    setValue,
  } = useForm<CreateExerciseFormData>({
    resolver: zodResolver(CreateExerciseSchema),
    defaultValues: {
      name: "",
      muscleGroup: undefined,
      equipment: "",
    },
  });

  const createMutation = api.exercise.create.useMutation({
    onSuccess: (newExercise) => {
      // Select the newly created exercise first
      onExerciseSelect(newExercise);

      // Show success message
      toast.success("Exercise created and added successfully!");

      // Give a moment for the exercise to be added, then close and reset
      setTimeout(() => {
        setOpen(false);

        // Reset form and state
        resetForm();
        setSelectedMuscleGroup("");
        setIsCreating(false);
        setSearchTerm("");
      }, 100);

      // Invalidate queries to refresh exercise list
      utils.exercise.getAll.invalidate();
      utils.exercise.getCustom.invalidate();
    },
    onError: (error) => {
      toast.error("Failed to create exercise: " + error.message);
    },
  });

  const updateMutation = api.exercise.update.useMutation({
    onSuccess: () => {
      setEditingExerciseId(null);
      toast.success("Exercise updated successfully!");

      // Invalidate queries to refresh exercise list
      utils.exercise.getAll.invalidate();
      utils.exercise.getCustom.invalidate();
    },
    onError: (error) => {
      toast.error("Failed to update exercise: " + error.message);
    },
  });

  // Filter exercises based on search and muscle group
  const filteredExercises = useMemo(() => {
    if (!exercises) return [];

    return exercises.filter((exercise) => {
      const matchesSearch =
        !debouncedSearchTerm ||
        exercise.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase());
      const matchesMuscleGroup =
        muscleGroupFilter === "all" ||
        exercise.muscleGroup === muscleGroupFilter;
      return matchesSearch && matchesMuscleGroup;
    });
  }, [exercises, debouncedSearchTerm, muscleGroupFilter]);

  // Detect potential duplicates
  const potentialDuplicates = useMemo(() => {
    if (!searchTerm.trim() || !exercises) return [];

    return exercises
      .filter(
        (exercise) =>
          similarity(exercise.name.toLowerCase(), searchTerm.toLowerCase()) >
          0.7
      )
      .slice(0, 3); // Show max 3 similar exercises
  }, [exercises, searchTerm]);

  // Determine if we should show create option
  const shouldShowCreateOption = useMemo(() => {
    return (
      searchTerm.trim().length > 2 &&
      (filteredExercises.length === 0 ||
        !filteredExercises.some(
          (ex) => ex.name.toLowerCase() === searchTerm.toLowerCase()
        ))
    );
  }, [searchTerm, filteredExercises]);

  // Auto-infer muscle group from exercise name
  useEffect(() => {
    if (searchTerm && !selectedMuscleGroup) {
      const term = searchTerm.toLowerCase();
      let inferredGroup = "";

      // Simple muscle group inference based on common exercise names
      if (
        term.includes("bench") ||
        term.includes("press") ||
        term.includes("fly") ||
        term.includes("push")
      ) {
        inferredGroup = "chest";
      } else if (
        term.includes("pull") ||
        term.includes("row") ||
        term.includes("deadlift")
      ) {
        inferredGroup = "back";
      } else if (
        term.includes("shoulder") ||
        term.includes("lateral") ||
        term.includes("overhead")
      ) {
        inferredGroup = "shoulders";
      } else if (
        term.includes("curl") ||
        term.includes("tricep") ||
        term.includes("bicep")
      ) {
        inferredGroup = "arms";
      } else if (
        term.includes("squat") ||
        term.includes("lunge") ||
        term.includes("leg")
      ) {
        inferredGroup = "legs";
      } else if (
        term.includes("plank") ||
        term.includes("crunch") ||
        term.includes("abs")
      ) {
        inferredGroup = "core";
      }

      if (inferredGroup && isCreating) {
        setSelectedMuscleGroup(inferredGroup);
        setValue("muscleGroup", inferredGroup as MuscleGroup);
      }
    }
  }, [searchTerm, selectedMuscleGroup, isCreating, setValue]);

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

  const handleCreateExercise = () => {
    setIsCreating(true);
    setValue("name", searchTerm);
  };

  const handleBackToSearch = () => {
    setIsCreating(false);
    resetForm();
    setSelectedMuscleGroup("");
  };

  const onSubmit = (data: CreateExerciseFormData) => {
    createMutation.mutate(data);
  };

  const handleMuscleGroupChange = (value: string) => {
    setSelectedMuscleGroup(value);
    setValue("muscleGroup", value as MuscleGroup);
  };

  const handleEditExercise = (exercise: Exercise) => {
    setEditingExerciseId(exercise.id);
    setEditForm({
      name: exercise.name,
      muscleGroup: exercise.muscleGroup,
      equipment: exercise.equipment || "",
    });
  };

  const handleSaveEdit = () => {
    if (!editingExerciseId) return;

    updateMutation.mutate({
      id: editingExerciseId,
      data: {
        name: editForm.name,
        muscleGroup: editForm.muscleGroup as MuscleGroup,
        equipment: editForm.equipment || undefined,
      },
    });
  };

  const handleCancelEdit = () => {
    setEditingExerciseId(null);
    setEditForm({ name: "", muscleGroup: "", equipment: "" });
  };

  const handleDialogOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      // Reset state when dialog closes
      setSearchTerm("");
      setMuscleGroupFilter("all");
      setIsCreating(false);
      resetForm();
      setSelectedMuscleGroup("");
      setEditingExerciseId(null);
      setEditForm({ name: "", muscleGroup: "", equipment: "" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isCreating && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBackToSearch}
                className="p-1 h-auto"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            {isCreating ? "Create New Exercise" : title}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col space-y-4">
          {!isCreating ? (
            <>
              {/* Search and Filter Controls */}
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search exercises..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                    autoFocus
                  />
                </div>
                <Select
                  value={muscleGroupFilter}
                  onValueChange={setMuscleGroupFilter}
                >
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue placeholder="All muscles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All muscles</SelectItem>
                    {MuscleGroupEnum.options.map((group) => (
                      <SelectItem key={group} value={group}>
                        {group.charAt(0).toUpperCase() + group.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Results Area */}
              <div className="flex-1 overflow-y-auto space-y-3">
                {/* Show potential duplicates warning if any */}
                {potentialDuplicates.length > 0 && shouldShowCreateOption && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm font-medium text-amber-800 mb-2">
                      Similar exercises found:
                    </p>
                    <div className="space-y-1">
                      {potentialDuplicates.map((exercise) => (
                        <button
                          key={exercise.id}
                          onClick={() => {
                            onExerciseSelect(exercise);
                            setOpen(false);
                          }}
                          className="text-sm text-amber-700 hover:text-amber-900 block"
                        >
                          • {exercise.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Create Exercise Option */}
                {shouldShowCreateOption && (
                  <Card
                    className="cursor-pointer hover:bg-primary/5 border-primary/20 transition-colors"
                    onClick={handleCreateExercise}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                          <Plus className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-primary">
                            Create &quot;{searchTerm}&quot;
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            Add as new custom exercise
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Existing Exercises */}
                {filteredExercises.length > 0 ? (
                  <div className="space-y-2">
                    {searchTerm && (
                      <p className="text-sm text-muted-foreground px-1">
                        {filteredExercises.length} exercise
                        {filteredExercises.length !== 1 ? "s" : ""} found
                      </p>
                    )}
                    {filteredExercises.map((exercise) => (
                      <Card
                        key={exercise.id}
                        className={
                          editingExerciseId === exercise.id
                            ? "border-primary"
                            : "cursor-pointer hover:bg-muted/50 transition-colors"
                        }
                      >
                        <CardContent className="p-3">
                          {editingExerciseId === exercise.id ? (
                            // Edit mode
                            <div className="space-y-3">
                              <div className="space-y-2">
                                <Label className="text-xs">Exercise Name</Label>
                                <Input
                                  value={editForm.name}
                                  onChange={(e) =>
                                    setEditForm((prev) => ({
                                      ...prev,
                                      name: e.target.value,
                                    }))
                                  }
                                  className="text-sm"
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-2">
                                  <Label className="text-xs">
                                    Muscle Group
                                  </Label>
                                  <Select
                                    value={editForm.muscleGroup}
                                    onValueChange={(value) =>
                                      setEditForm((prev) => ({
                                        ...prev,
                                        muscleGroup: value,
                                      }))
                                    }
                                  >
                                    <SelectTrigger className="text-sm">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {muscleGroups.map((group) => (
                                        <SelectItem
                                          key={group.value}
                                          value={group.value}
                                        >
                                          {group.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-xs">Equipment</Label>
                                  <Input
                                    value={editForm.equipment}
                                    onChange={(e) =>
                                      setEditForm((prev) => ({
                                        ...prev,
                                        equipment: e.target.value,
                                      }))
                                    }
                                    placeholder="Optional"
                                    className="text-sm"
                                  />
                                </div>
                              </div>
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={handleCancelEdit}
                                  disabled={updateMutation.isPending}
                                >
                                  <X className="h-3 w-3 mr-1" />
                                  Cancel
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={handleSaveEdit}
                                  disabled={
                                    updateMutation.isPending ||
                                    !editForm.name.trim()
                                  }
                                >
                                  <Check className="h-3 w-3 mr-1" />
                                  {updateMutation.isPending
                                    ? "Saving..."
                                    : "Save"}
                                </Button>
                              </div>
                            </div>
                          ) : (
                            // View mode
                            <div
                              className="flex justify-between items-center"
                              onClick={() => {
                                onExerciseSelect(exercise);
                                setOpen(false);
                              }}
                            >
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium truncate">
                                  {exercise.name}
                                </h4>
                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                  <Badge
                                    variant="secondary"
                                    className={getMuscleGroupColor(
                                      exercise.muscleGroup
                                    )}
                                  >
                                    {exercise.muscleGroup}
                                  </Badge>
                                  {exercise.equipment && (
                                    <Badge
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      {exercise.equipment}
                                    </Badge>
                                  )}
                                  {exercise.isCustom && (
                                    <Badge
                                      variant="outline"
                                      className="text-xs bg-blue-50 text-blue-700"
                                    >
                                      Custom
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                {exercise.isCustom && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEditExercise(exercise);
                                    }}
                                    className="h-8 w-8 p-0 opacity-60 hover:opacity-100"
                                  >
                                    <Edit2 className="h-3 w-3" />
                                  </Button>
                                )}
                                <Plus className="h-4 w-4 flex-shrink-0 ml-1 text-muted-foreground" />
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : searchTerm && !shouldShowCreateOption ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No exercises found for &quot;{searchTerm}&quot;</p>
                  </div>
                ) : !searchTerm ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Dumbbell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Start typing to search exercises...</p>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            /* Create Exercise Form */
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="space-y-4 flex-1 overflow-y-auto"
            >
              <div className="space-y-2">
                <Label htmlFor="name">Exercise Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Incline Dumbbell Press"
                  {...register("name")}
                  className={errors.name ? "border-destructive" : ""}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">
                    {errors.name.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="muscleGroup">Muscle Group</Label>
                <Select
                  value={selectedMuscleGroup}
                  onValueChange={handleMuscleGroupChange}
                >
                  <SelectTrigger
                    className={errors.muscleGroup ? "border-destructive" : ""}
                  >
                    <SelectValue placeholder="Select muscle group" />
                  </SelectTrigger>
                  <SelectContent>
                    {muscleGroups.map((group) => (
                      <SelectItem key={group.value} value={group.value}>
                        {group.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.muscleGroup && (
                  <p className="text-sm text-destructive">
                    {errors.muscleGroup.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="equipment">Equipment (Optional)</Label>
                <Input
                  id="equipment"
                  placeholder="e.g., Dumbbells, Barbell, Cable Machine"
                  {...register("equipment")}
                  className={errors.equipment ? "border-destructive" : ""}
                />
                {errors.equipment && (
                  <p className="text-sm text-destructive">
                    {errors.equipment.message}
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBackToSearch}
                  disabled={createMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="min-w-[120px]"
                >
                  {createMutation.isPending ? "Creating..." : "Create & Add"}
                </Button>
              </div>

              {createMutation.error && (
                <p className="text-sm text-destructive">
                  Error creating exercise: {createMutation.error.message}
                </p>
              )}
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
