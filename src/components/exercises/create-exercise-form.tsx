"use client";

import { useState } from "react";
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

type CreateExerciseFormData = z.infer<typeof CreateExerciseSchema>;

interface CreateExerciseFormProps {
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

export function CreateExerciseForm({ onSuccess }: CreateExerciseFormProps) {
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState<string>("");
  const utils = api.useUtils();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<CreateExerciseFormData>({
    resolver: zodResolver(CreateExerciseSchema),
  });

  const createMutation = api.exercise.create.useMutation({
    onSuccess: () => {
      utils.exercise.getCustom.invalidate();
      utils.exercise.getAll.invalidate();
      reset();
      setSelectedMuscleGroup("");
      onSuccess?.();
    },
  });

  const onSubmit = (data: CreateExerciseFormData) => {
    createMutation.mutate(data);
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
          disabled={createMutation.isPending}
          className="w-full"
        >
          {createMutation.isPending ? "Creating..." : "Create Exercise"}
        </Button>
      </div>

      {createMutation.error && (
        <p className="text-sm text-destructive">
          Error creating exercise: {createMutation.error.message}
        </p>
      )}
    </form>
  );
}
