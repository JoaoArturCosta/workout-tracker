"use client";

import { useEffect } from "react";
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
import { CreateWorkoutTemplateSchema } from "@/lib/schemas";
import { toast } from "sonner";
import { ExerciseSelectionDialog } from "@/components/templates/exercise-selection-dialog";

const FormSchema = CreateWorkoutTemplateSchema.omit({
  userId: true,
}).extend({
  exercises: z
    .array(
      z.object({
        exerciseId: z.string().uuid(),
        orderIndex: z.number().min(0),
        sets: z.number().min(1).max(20),
        repsMin: z.number().min(1).max(100),
        repsMax: z.number().min(1).max(100),
        rpeTarget: z.number().min(6).max(10).optional(),
        restTimeSeconds: z.number().min(10).max(600).optional(),
      })
    )
    .optional(),
});

type FormData = z.infer<typeof FormSchema>;

interface EditTemplateFormProps {
  templateId: string;
  onSuccess: () => void;
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

export function EditTemplateForm({
  templateId,
  onSuccess,
}: EditTemplateFormProps) {
  const utils = api.useUtils();
  const { data: template } = api.template.getById.useQuery({ id: templateId });

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      name: "",
      dayNumber: 1,
      exercises: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "exercises",
  });

  // Get all exercises for looking up added exercises
  const { data: allExercises } = api.exercise.getAll.useQuery({});

  const updateTemplateMutation = api.template.update.useMutation({
    onSuccess: () => {
      utils.template.getAll.invalidate();
      utils.template.getById.invalidate({ id: templateId });
      toast.success("Template updated successfully!");
      onSuccess();
    },
    onError: (error) => {
      // Extract user-friendly error message
      let errorMessage = "Failed to update template";

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

  // Reset form when template data loads
  useEffect(() => {
    if (template) {
      reset({
        name: template.name,
        dayNumber: template.day_number,
        exercises:
          template.template_exercises?.map((te) => ({
            exerciseId: te.exercise_id,
            orderIndex: te.order_index,
            sets: te.sets,
            repsMin: te.reps_min,
            repsMax: te.reps_max,
            rpeTarget: te.rpe_target || undefined,
            restTimeSeconds: te.rest_time_seconds || 120,
          })) || [],
      });
    }
  }, [template, reset]);

  const onSubmit = async (data: FormData) => {
    try {
      // The server will override this with the actual session user ID
      const submitData = {
        ...data,
        userId: "00000000-0000-0000-0000-000000000000", // Valid UUID placeholder
      };
      await updateTemplateMutation.mutateAsync({
        id: templateId,
        data: submitData,
      });
    } catch (error) {
      // Error is already handled by onError callback above
      console.error("Failed to update template:", error);
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
  };

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

  if (!template) {
    return <div>Loading...</div>;
  }

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
          <ExerciseSelectionDialog
            trigger={
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Exercise
              </Button>
            }
            onExerciseSelect={addExercise}
            title="Add Exercise to Template"
          />
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
                      <div className="space-y-1">
                        <Label className="text-xs">Target</Label>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground h-10 px-3 border rounded-md bg-muted/30">
                          <Target className="h-3 w-3" />
                          <span>
                            {field.repsMin}-{field.repsMax} reps
                          </span>
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

      <div className="flex flex-col sm:flex-row gap-3 pt-6">
        <Button
          type="submit"
          disabled={isSubmitting || updateTemplateMutation.isPending}
          className="flex-1"
        >
          {isSubmitting || updateTemplateMutation.isPending
            ? "Updating..."
            : "Update Template"}
        </Button>
      </div>
    </form>
  );
}
