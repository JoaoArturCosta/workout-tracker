"use client";

import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, GripVertical, Dumbbell, Target } from "lucide-react";
import { api } from "@/lib/trpc";
import { CreateWorkoutTemplateSchema, MuscleGroupEnum } from "@/lib/schemas";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const FormSchema = CreateWorkoutTemplateSchema.omit({
  userId: true,
});

type FormData = z.infer<typeof FormSchema>;

interface CreateTemplateFormProps {
  onSuccess: () => void;
  selectedDay?: number;
}

const DAYS = [
  { number: 1, name: "Day 1" },
  { number: 2, name: "Day 2" },
  { number: 3, name: "Day 3" },
  { number: 4, name: "Day 4" },
  { number: 5, name: "Day 5" },
  { number: 6, name: "Day 6" },
  { number: 7, name: "Day 7" },
];

export function CreateTemplateForm({
  onSuccess,
  selectedDay,
}: CreateTemplateFormProps) {
  const [exerciseDialogOpen, setExerciseDialogOpen] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [muscleGroupFilter, setMuscleGroupFilter] = useState<string>("all");

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      name: "",
      dayNumber: selectedDay || 1,
      exercises: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "exercises",
  });

  // Get all exercises for looking up added exercises (not filtered by muscle group)
  const { data: allExercises } = api.exercise.getAll.useQuery({});

  // Get filtered exercises for the selection dialog
  const { data: exercises } = api.exercise.getAll.useQuery({
    muscleGroup:
      muscleGroupFilter === "all"
        ? undefined
        : (muscleGroupFilter as
            | "chest"
            | "back"
            | "shoulders"
            | "arms"
            | "legs"
            | "core"),
    search: exerciseSearch,
  });

  const createTemplateMutation = api.template.create.useMutation({
    onSuccess: () => {
      toast.success("Template created successfully!");
      onSuccess();
    },
    onError: (error) => {
      // Extract user-friendly error message
      let errorMessage = "Failed to create template";

      if (error.data?.zodError) {
        // Handle validation errors
        const zodErrors = error.data.zodError.fieldErrors;
        const firstError = Object.values(zodErrors)[0];
        if (firstError && firstError[0]) {
          errorMessage = firstError[0];
        }
      } else if (error.message) {
        // Use the server error message
        errorMessage = error.message;
      }

      toast.error(errorMessage);
      console.error("Mutation error:", error);
    },
  });

  const onSubmit = async (data: FormData) => {
    try {
      // The server will override this with the actual session user ID
      const submitData = {
        ...data,
        userId: "00000000-0000-0000-0000-000000000000", // Valid UUID placeholder
      };
      await createTemplateMutation.mutateAsync(submitData);
    } catch (error) {
      // Error is already handled by onError callback above
      console.error("Failed to create template:", error);
    }
  };

  const addExercise = (exercise: {
    id: string;
    name: string;
    muscleGroup: string;
    equipment?: string | null;
  }) => {
    append({
      exerciseId: exercise.id,
      orderIndex: fields.length,
      sets: 3,
      repsMin: 8,
      repsMax: 12,
      rpeTarget: undefined,
      restTimeSeconds: 120,
    });
    setExerciseDialogOpen(false);
  };

  const filteredExercises = exercises?.filter((exercise) => {
    const matchesSearch =
      !exerciseSearch ||
      exercise.name.toLowerCase().includes(exerciseSearch.toLowerCase());
    const matchesMuscleGroup =
      !muscleGroupFilter ||
      muscleGroupFilter === "all" ||
      exercise.muscleGroup === muscleGroupFilter;
    return matchesSearch && matchesMuscleGroup;
  });

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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Template Name</Label>
          <Input
            id="name"
            {...register("name")}
            placeholder="e.g., Push Day, Upper Body"
          />
          {errors.name && (
            <p className="text-sm text-destructive">{errors.name.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="dayNumber">Day</Label>
          <Select
            value={watch("dayNumber").toString()}
            onValueChange={(value) => setValue("dayNumber", parseInt(value))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DAYS.map((day) => (
                <SelectItem key={day.number} value={day.number.toString()}>
                  {day.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.dayNumber && (
            <p className="text-sm text-destructive">
              {errors.dayNumber.message}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <h3 className="text-lg font-semibold">Exercises</h3>
          <Dialog
            open={exerciseDialogOpen}
            onOpenChange={setExerciseDialogOpen}
          >
            <DialogTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Exercise
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Select Exercise</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex-1">
                    <Input
                      placeholder="Search exercises..."
                      value={exerciseSearch}
                      onChange={(e) => setExerciseSearch(e.target.value)}
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

                <div className="grid gap-2 max-h-96 overflow-y-auto">
                  {filteredExercises?.map((exercise) => (
                    <Card
                      key={exercise.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => addExercise(exercise)}
                    >
                      <CardContent className="p-3">
                        <div className="flex justify-between items-center">
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
                                <Badge variant="outline">
                                  {exercise.equipment}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <Plus className="h-4 w-4 flex-shrink-0 ml-2" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {fields.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-6 sm:p-8 text-center">
              <Dumbbell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-sm sm:text-base">
                No exercises added yet. Click Add Exercise to get started.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {fields.map((field, index) => {
              const exercise = allExercises?.find(
                (e) => e.id === field.exerciseId
              );
              return (
                <Card key={field.id} className="border-l-4 border-l-primary">
                  <CardHeader className="pb-3">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <GripVertical className="h-4 w-4 text-muted-foreground cursor-move flex-shrink-0" />
                        <span className="text-sm font-medium text-muted-foreground flex-shrink-0">
                          {index + 1}.
                        </span>
                        <CardTitle className="text-base truncate">
                          {exercise?.name}
                        </CardTitle>
                        {exercise && (
                          <Badge
                            variant="secondary"
                            className={`${getMuscleGroupColor(
                              exercise.muscleGroup
                            )} hidden sm:inline-flex`}
                          >
                            {exercise.muscleGroup}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {exercise && (
                          <Badge
                            variant="secondary"
                            className={`${getMuscleGroupColor(
                              exercise.muscleGroup
                            )} sm:hidden`}
                          >
                            {exercise.muscleGroup}
                          </Badge>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => remove(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                      <div className="space-y-1">
                        <Label className="text-xs">Sets</Label>
                        <Input
                          type="number"
                          min="1"
                          max="20"
                          {...register(`exercises.${index}.sets`, {
                            valueAsNumber: true,
                          })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Min Reps</Label>
                        <Input
                          type="number"
                          min="1"
                          max="100"
                          {...register(`exercises.${index}.repsMin`, {
                            valueAsNumber: true,
                          })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Max Reps</Label>
                        <Input
                          type="number"
                          min="1"
                          max="100"
                          {...register(`exercises.${index}.repsMax`, {
                            valueAsNumber: true,
                          })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">RPE</Label>
                        <Input
                          type="number"
                          min="6"
                          max="10"
                          step="0.5"
                          {...register(`exercises.${index}.rpeTarget`, {
                            setValueAs: (value) => {
                              if (
                                value === "" ||
                                value === null ||
                                value === undefined
                              ) {
                                return undefined;
                              }
                              const parsed = parseFloat(value);
                              return isNaN(parsed) ? undefined : parsed;
                            },
                          })}
                          placeholder="Optional"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Rest (sec)</Label>
                        <Input
                          type="number"
                          min="10"
                          max="600"
                          {...register(`exercises.${index}.restTimeSeconds`, {
                            valueAsNumber: true,
                          })}
                          placeholder="120"
                        />
                      </div>
                      <div className="flex items-end col-span-1 sm:col-span-2 lg:col-span-3 xl:col-span-1">
                        <div className="text-xs text-muted-foreground space-y-1 w-full">
                          <div className="flex items-center gap-1">
                            <Target className="h-3 w-3" />
                            <span className="truncate">
                              Sets: {watch(`exercises.${index}.sets`)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Dumbbell className="h-3 w-3" />
                            <span className="truncate">
                              Reps: {watch(`exercises.${index}.repsMin`)}-
                              {watch(`exercises.${index}.repsMax`)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full sm:w-auto min-w-32"
        >
          {isSubmitting ? "Creating..." : "Create Template"}
        </Button>
      </div>
    </form>
  );
}
