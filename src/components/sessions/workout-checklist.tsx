"use client";

import { SetChecklistRow, type ChecklistSetStatus } from "@/components/sessions/set-checklist-row";

export interface ChecklistExercise {
  id: string;
  exerciseName: string;
  mode: "Reps" | "Duration" | string;
  repsMin?: number | null;
  repsMax?: number | null;
  targetSeconds?: number | null;
  sets: Array<{
    id: string;
    setNumber: number;
    status?: ChecklistSetStatus;
    completed?: boolean;
    skipped?: boolean;
    actualReps?: number | null;
    actualSeconds?: number | null;
    externalLoadKg?: number | null;
  }>;
}

export interface WorkoutChecklistProps {
  exercises: ChecklistExercise[];
  readOnly?: boolean;
  onCompleteSet?: (setId: string) => void;
}

export function WorkoutChecklist({ exercises, readOnly = false, onCompleteSet }: WorkoutChecklistProps) {
  const rows = exercises.flatMap((exercise) => exercise.sets.map((set) => ({ exercise, set })));
  const currentId = rows.find(({ set }) => {
    const status = set.status ?? (set.completed ? "Completed" : set.skipped ? "Skipped" : "Pending");
    return status === "Pending";
  })?.set.id;

  if (rows.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">No sets in this workout.</p>;

  return (
    <div className="space-y-2" data-testid="workout-checklist">
      {rows.map(({ exercise, set }) => {
        const status = set.status ?? (set.completed ? "Completed" : set.skipped ? "Skipped" : "Pending");
        return (
          <SetChecklistRow
            key={set.id}
            exerciseName={exercise.exerciseName}
            setNumber={set.setNumber}
            mode={exercise.mode}
            status={status}
            current={set.id === currentId}
            readOnly={readOnly}
            actualReps={set.actualReps}
            actualSeconds={set.actualSeconds}
            externalLoadKg={set.externalLoadKg}
            repsMin={exercise.repsMin}
            repsMax={exercise.repsMax}
            targetSeconds={exercise.targetSeconds}
            onComplete={() => onCompleteSet?.(set.id)}
          />
        );
      })}
    </div>
  );
}
