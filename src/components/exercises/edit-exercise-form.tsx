"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
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
import { api } from "@/lib/trpc";
import { toast } from "sonner";
import type { Exercise } from "@/lib/schemas";

const editExerciseSchema = z.object({
  name: z.string().min(1, "Exercise name is required").max(100),
  muscleGroup: z.enum(["chest", "back", "shoulders", "arms", "legs", "core"]),
  equipment: z.string().optional(),
});

type EditExerciseFormData = z.infer<typeof editExerciseSchema>;

interface EditExerciseFormProps {
  exercise: Exercise;
  onSuccess: () => void;
}

const muscleGroupOptions = [
  { value: "chest", label: "Chest" },
  { value: "back", label: "Back" },
  { value: "shoulders", label: "Shoulders" },
  { value: "arms", label: "Arms" },
  { value: "legs", label: "Legs" },
  { value: "core", label: "Core" },
];

export function EditExerciseForm({
  exercise,
  onSuccess,
}: EditExerciseFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<EditExerciseFormData>({
    resolver: zodResolver(editExerciseSchema),
    defaultValues: {
      name: exercise.name,
      muscleGroup: exercise.muscleGroup,
      equipment: exercise.equipment || "",
    },
  });

  const selectedMuscleGroup = watch("muscleGroup");

  const updateMutation = api.exercise.update.useMutation({
    onSuccess: () => {
      toast.success("Exercise updated successfully!");
      onSuccess();
    },
    onError: (error) => {
      toast.error(`Failed to update exercise: ${error.message}`);
      setIsSubmitting(false);
    },
  });

  const onSubmit = async (data: EditExerciseFormData) => {
    setIsSubmitting(true);
    try {
      await updateMutation.mutateAsync({
        id: exercise.id,
        data,
      });
    } catch (error) {
      console.error("Failed to update exercise:", error);
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Exercise Name</Label>
        <Input
          id="name"
          {...register("name")}
          placeholder="e.g., Bench Press"
          className={errors.name ? "border-red-500" : ""}
        />
        {errors.name && (
          <p className="text-sm text-red-500">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="muscleGroup">Muscle Group</Label>
        <Select
          value={selectedMuscleGroup}
          onValueChange={(value) =>
            setValue(
              "muscleGroup",
              value as
                | "chest"
                | "back"
                | "shoulders"
                | "arms"
                | "legs"
                | "core",
              { shouldValidate: true }
            )
          }
        >
          <SelectTrigger className={errors.muscleGroup ? "border-red-500" : ""}>
            <SelectValue placeholder="Select muscle group" />
          </SelectTrigger>
          <SelectContent>
            {muscleGroupOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.muscleGroup && (
          <p className="text-sm text-red-500">{errors.muscleGroup.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="equipment">Equipment (Optional)</Label>
        <Input
          id="equipment"
          {...register("equipment")}
          placeholder="e.g., Barbell, Dumbbells, Machine"
          className={errors.equipment ? "border-red-500" : ""}
        />
        {errors.equipment && (
          <p className="text-sm text-red-500">{errors.equipment.message}</p>
        )}
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button type="submit" disabled={isSubmitting} className="min-w-[100px]">
          {isSubmitting ? "Updating..." : "Update Exercise"}
        </Button>
      </div>
    </form>
  );
}
