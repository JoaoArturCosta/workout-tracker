"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Circle, Plus, Save } from "lucide-react";
import { api } from "@/lib/trpc";
import { toast } from "sonner";

interface SessionSet {
  id: string;
  sessionExerciseId: string;
  setNumber: number;
  weight: string;
  reps: number;
  rpe?: number | null;
  completed: boolean;
}

interface SessionExercise {
  id: string;
  session_id: string;
  exercise_id: string;
  order_index: number;
  exercises?: {
    id: string;
    name: string;
    muscle_group: string;
    equipment?: string | null;
  } | null;
  session_sets: SessionSet[];
}

interface LiveSetLoggerProps {
  sessionExercise: SessionExercise;
  onSetComplete?: () => void;
}

export function LiveSetLogger({
  sessionExercise,
  onSetComplete,
}: LiveSetLoggerProps) {
  const [editingSet, setEditingSet] = useState<string | null>(null);
  const [tempValues, setTempValues] = useState<{
    weight: string;
    reps: string;
    rpe: string;
  }>({
    weight: "",
    reps: "",
    rpe: "",
  });

  const updateSetMutation = api.session.updateSet.useMutation({
    onSuccess: () => {
      setEditingSet(null);
      toast.success("Set logged successfully!");
      onSetComplete?.();
    },
    onError: (error) => {
      toast.error("Failed to log set: " + error.message);
    },
  });

  const handleEditSet = (set: SessionSet) => {
    setEditingSet(set.id);
    setTempValues({
      weight: set.weight || "",
      reps: set.reps.toString(),
      rpe: set.rpe?.toString() || "",
    });
  };

  const handleSaveSet = async (setId: string) => {
    const weight = parseFloat(tempValues.weight) || 0;
    const reps = parseInt(tempValues.reps) || 0;
    const rpe = tempValues.rpe ? parseInt(tempValues.rpe) : undefined;

    if (weight <= 0) {
      toast.error("Please enter a valid weight");
      return;
    }

    if (reps <= 0) {
      toast.error("Please enter a valid number of reps");
      return;
    }

    if (
      tempValues.rpe &&
      (parseInt(tempValues.rpe) < 6 || parseInt(tempValues.rpe) > 10)
    ) {
      toast.error("RPE must be between 6 and 10");
      return;
    }

    try {
      await updateSetMutation.mutateAsync({
        id: setId,
        weight,
        reps,
        rpe,
        completed: true,
      });
    } catch (error) {
      console.error("Failed to update set:", error);
    }
  };

  const handleCancelEdit = () => {
    setEditingSet(null);
    setTempValues({ weight: "", reps: "", rpe: "" });
  };

  const sortedSets =
    sessionExercise.session_sets?.sort((a, b) => a.setNumber - b.setNumber) ||
    [];

  return (
    <div className="space-y-4">
      <div className="grid gap-3">
        {sortedSets.map((set) => (
          <div
            key={set.id}
            className={`p-4 border rounded-lg transition-colors ${
              set.completed ? "border-green-200 bg-green-50" : "border-gray-200"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {set.completed ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <Circle className="h-5 w-5 text-gray-400" />
                )}
                <span className="font-medium">Set {set.setNumber}</span>
              </div>

              {editingSet === set.id ? (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCancelEdit}
                    disabled={updateSetMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleSaveSet(set.id)}
                    disabled={updateSetMutation.isPending}
                  >
                    <Save className="h-3 w-3 mr-1" />
                    {updateSetMutation.isPending ? "Saving..." : "Save"}
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleEditSet(set)}
                  disabled={updateSetMutation.isPending}
                >
                  {set.completed ? "Edit" : "Log"}
                </Button>
              )}
            </div>

            {editingSet === set.id ? (
              <div className="mt-3 grid grid-cols-3 gap-3">
                <div>
                  <Label htmlFor={`weight-${set.id}`} className="text-xs">
                    Weight (kg)
                  </Label>
                  <Input
                    id={`weight-${set.id}`}
                    type="number"
                    step="0.25"
                    min="0"
                    placeholder="0"
                    value={tempValues.weight}
                    onChange={(e) =>
                      setTempValues((prev) => ({
                        ...prev,
                        weight: e.target.value,
                      }))
                    }
                    className="mt-1"
                    autoFocus
                  />
                </div>
                <div>
                  <Label htmlFor={`reps-${set.id}`} className="text-xs">
                    Reps
                  </Label>
                  <Input
                    id={`reps-${set.id}`}
                    type="number"
                    min="1"
                    max="100"
                    placeholder="0"
                    value={tempValues.reps}
                    onChange={(e) =>
                      setTempValues((prev) => ({
                        ...prev,
                        reps: e.target.value,
                      }))
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor={`rpe-${set.id}`} className="text-xs">
                    RPE (6-10)
                  </Label>
                  <Input
                    id={`rpe-${set.id}`}
                    type="number"
                    min="6"
                    max="10"
                    step="0.5"
                    placeholder="Optional"
                    value={tempValues.rpe}
                    onChange={(e) =>
                      setTempValues((prev) => ({
                        ...prev,
                        rpe: e.target.value,
                      }))
                    }
                    className="mt-1"
                  />
                </div>
              </div>
            ) : (
              <div className="mt-2 grid grid-cols-3 gap-4 text-sm text-muted-foreground">
                <div>
                  <span className="font-medium">
                    {set.weight ? `${set.weight} kg` : "- kg"}
                  </span>
                </div>
                <div>
                  <span className="font-medium">{set.reps || "-"} reps</span>
                </div>
                <div>
                  <span className="font-medium">
                    {set.rpe ? `RPE ${set.rpe}` : "No RPE"}
                  </span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {sortedSets.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Circle className="h-8 w-8 mx-auto mb-2" />
          <p>No sets configured for this exercise</p>
        </div>
      )}
    </div>
  );
}
