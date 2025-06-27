"use client";

import { useState, useEffect } from "react";
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
import { api } from "@/lib/trpc";
import { CreateExerciseSchema, type MuscleGroup } from "@/lib/schemas";
import type { z } from "zod";
import type { Exercise } from "@/lib/db/schema";

type EditExerciseFormData = z.infer<typeof CreateExerciseSchema>;

interface EditExerciseFormProps {
  exercise: Exercise;
  onSuccess?: () => void;
}

const muscleGroups = [
  { value: "chest", label: "Chest" },
  { value: "back", label: "Back" },
  { value: "shoulders", label: "Shoulders" },
  { value: "arms", label: "Arms" },
  { value: "legs", label: "Legs" },
  { value: "core", label: "Core" },
] as const;

export function EditExerciseForm({
  exercise,
  onSuccess,
}: EditExerciseFormProps) {
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState<string>(
    exercise.muscleGroup
  );
  const utils = api.useUtils();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    reset,
  } = useForm<EditExerciseFormData>({
    resolver: zodResolver(CreateExerciseSchema),
    defaultValues: {
      name: exercise.name,
      muscleGroup: exercise.muscleGroup,
      equipment: exercise.equipment || "",
    },
  });

  const updateMutation = api.exercise.update.useMutation({
    onSuccess: () => {
      utils.exercise.getCustom.invalidate();
      utils.exercise.getAll.invalidate();
      onSuccess?.();
    },
  });

  useEffect(() => {
    reset({
      name: exercise.name,
      muscleGroup: exercise.muscleGroup,
      equipment: exercise.equipment || "",
    });
    setSelectedMuscleGroup(exercise.muscleGroup);
  }, [exercise, reset]);

  const onSubmit = (data: EditExerciseFormData) => {
    updateMutation.mutate({
      id: exercise.id,
      data,
    });
  };

  const handleMuscleGroupChange = (value: string) => {
    setSelectedMuscleGroup(value);
    setValue("muscleGroup", value as MuscleGroup);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Exercise Name</Label>
        <Input
          id="name"
          placeholder="e.g., Incline Dumbbell Press"
          {...register("name")}
          className={errors.name ? "border-destructive" : ""}
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
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
          <p className="text-sm text-destructive">{errors.equipment.message}</p>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button
          type="submit"
          disabled={updateMutation.isPending}
          className="w-full"
        >
          {updateMutation.isPending ? "Updating..." : "Update Exercise"}
        </Button>
      </div>

      {updateMutation.error && (
        <p className="text-sm text-destructive">
          Error updating exercise: {updateMutation.error.message}
        </p>
      )}
    </form>
  );
}
