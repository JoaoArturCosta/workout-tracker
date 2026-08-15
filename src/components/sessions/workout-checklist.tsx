"use client";

import { useEffect, useRef, useState } from "react";
import { findCurrentSet } from "@/lib/workouts/current-set";
import { Check } from "lucide-react";
import { SetChecklistRow, type ChecklistSetStatus, type SetChecklistResult } from "@/components/sessions/set-checklist-row";
import { Button } from "@/components/ui/button";
import { ItemGroup } from "@/components/ui/item";
import type { PriorSetValues } from "@/lib/types";

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
    completedAt?: Date | string | null;
    completed?: boolean;
    skipped?: boolean;
    actualReps?: number | null;
    actualSeconds?: number | null;
    externalLoadKg?: number | null;
    rpe?: number | null;
  }>;
}

export interface WorkoutChecklistProps {
  exercises: ChecklistExercise[];
  prior?: PriorSetValues | null;
  priorSelection?: { exerciseId: string; setId: string } | null;
  readOnly?: boolean;
  disabled?: boolean;
  onSelectionChange?: (selection: { exerciseId: string; setId: string }) => void;
  onCompleteSet?: (setId: string, result: SetChecklistResult) => boolean | void;
  onUncompleteSet?: (setId: string) => void;
  onSkipSet?: (setId: string) => void;
  onSaveSet?: (setId: string, result: SetChecklistResult) => void | Promise<void>;
}

function getSetStatus(set: ChecklistExercise["sets"][number]): ChecklistSetStatus {
  return set.status ?? (set.completed ? "Completed" : set.skipped ? "Skipped" : "Pending");
}

function isExerciseComplete(exercise: ChecklistExercise) {
  return exercise.sets.length > 0 && exercise.sets.every((set) => {
    const status = getSetStatus(set);
    return status === "Completed" || status === "Skipped";
  });
}

function getPreferredSetId(exercise: ChecklistExercise | undefined) {
  if (!exercise) return null;
  return exercise.sets.find((set) => getSetStatus(set) === "Pending")?.id ?? exercise.sets[0]?.id ?? null;
}

export function WorkoutChecklist({ exercises, prior, priorSelection, readOnly = false, disabled = false, onSelectionChange, onCompleteSet, onUncompleteSet, onSkipSet, onSaveSet }: WorkoutChecklistProps) {
  const rows = exercises.flatMap((exercise) => exercise.sets.map((set) => ({ exercise, set })));
  // Any pending row can be completed directly; the Current set follows the
  // most recently completed exercise occurrence.
  const currentId = findCurrentSet(rows.map(({ exercise, set }) => ({ id: set.id, exerciseOccurrenceId: exercise.id, status: getSetStatus(set), completedAt: set.completedAt })))?.id;
  const current = rows.find(({ set }) => set.id === currentId);
  const initialSelection = current ?? rows.find(({ exercise }) => exercise.id === exercises[0]?.id);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(() => initialSelection?.exercise.id ?? null);
  const [selectedSetId, setSelectedSetId] = useState<string | null>(() => initialSelection?.set.id ?? null);
  const [focusSetId, setFocusSetId] = useState<string | null>(null);
  const completionRef = useRef(new Map(exercises.map((exercise) => [exercise.id, isExerciseComplete(exercise)])));

  const selectedExercise = exercises.find((exercise) => exercise.id === selectedExerciseId) ?? exercises[0];

  useEffect(() => {
    const completion = new Map(exercises.map((exercise) => [exercise.id, isExerciseComplete(exercise)]));
    if (!selectedExercise) {
      completionRef.current = completion;
      return;
    }

    const wasComplete = completionRef.current.get(selectedExercise.id) ?? false;

    if (wasComplete === false && completion.get(selectedExercise.id) === true) {
      const nextExercise = exercises.find((exercise) => !completion.get(exercise.id));
      if (nextExercise && nextExercise.id !== selectedExercise.id) setSelectedExerciseId(nextExercise.id);
    }

    if (!exercises.some((exercise) => exercise.id === selectedExerciseId)) {
      setSelectedExerciseId(exercises[0]?.id ?? null);
    }
    if (!selectedExercise?.sets.some((set) => set.id === selectedSetId)) {
      setSelectedSetId(getPreferredSetId(selectedExercise));
    }
    completionRef.current = completion;
  }, [exercises, selectedExercise, selectedExerciseId, selectedSetId]);

  useEffect(() => {
    if (!selectedExercise || !selectedSetId || !selectedExercise.sets.some((set) => set.id === selectedSetId)) return;
    onSelectionChange?.({ exerciseId: selectedExercise.id, setId: selectedSetId });
  }, [onSelectionChange, selectedExercise, selectedSetId]);

  if (rows.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">No sets in this workout.</p>;

  const selectedSets = selectedExercise?.sets ?? [];
  const selectedComplete = selectedExercise ? isExerciseComplete(selectedExercise) : false;
  const completedSetCount = selectedSets.filter((set) => {
    const status = getSetStatus(set);
    return status === "Completed" || status === "Skipped";
  }).length;
  const currentSet = selectedSets.find((set) => getSetStatus(set) === "Pending") ?? selectedSets[selectedSets.length - 1];

  const selectRow = (exerciseId: string, setId: string, focusInput = false) => {
    setSelectedExerciseId(exerciseId);
    setSelectedSetId(setId);
    setFocusSetId(focusInput ? setId : null);
  };

  const completeAndAdvance = (setId: string, result: SetChecklistResult) => {
    if (onCompleteSet?.(setId, result) === false) return false;
    const completed = rows.find(({ set }) => set.id === setId);
    // Advance within the completed set's exercise first so focus follows the
    // exercise the athlete is working on; otherwise continue in sequence.
    const sameExercise = completed ? rows.find(({ exercise, set }) => exercise.id === completed.exercise.id && set.id !== setId && getSetStatus(set) === "Pending") : undefined;
    const index = rows.findIndex(({ set }) => set.id === setId);
    const remainingRows = index < 0 ? rows : [...rows.slice(index + 1), ...rows.slice(0, index)];
    const next = sameExercise ?? remainingRows.find(({ set }) => getSetStatus(set) === "Pending" && set.id !== setId);

    if (next) selectRow(next.exercise.id, next.set.id, true);
    else setFocusSetId(null);
    return true;
  };

  return <div className="flex flex-col gap-4" data-testid="workout-checklist">
    <div
      className="grid w-full gap-2"
      style={{ gridTemplateColumns: `repeat(${exercises.length}, minmax(0, 1fr))` }}
      aria-label="Exercises"
    >
      {exercises.map((exercise) => {
        const complete = isExerciseComplete(exercise);
        const selected = exercise.id === selectedExercise?.id;

        return <div
          key={exercise.id}
          data-testid={`exercise-tile-${exercise.id}`}
          className="relative min-w-0"
        >
          <Button
            type="button"
            variant={selected ? "default" : "outline"}
            aria-pressed={selected}
            aria-label={`${exercise.exerciseName}${complete ? " (complete)" : ""}`}
            title={exercise.exerciseName}
            onClick={() => {
              const setId = getPreferredSetId(exercise);
              if (setId) selectRow(exercise.id, setId);
            }}
            className="relative aspect-square h-auto w-full min-w-0 flex-col overflow-hidden rounded-lg p-2 text-center"
          >
            <span className="block w-full truncate text-xs" data-exercise-label>
              {exercise.exerciseName}
            </span>
            {complete && <span className="mt-1 inline-flex items-center gap-1 text-xs" data-testid={`exercise-complete-${exercise.id}`}>
              <Check data-icon="inline-start" aria-hidden="true" />
              <span className="sr-only">Complete</span>
            </span>}
          </Button>
        </div>;
      })}
    </div>

    {selectedExercise && <section className="flex flex-col gap-3" aria-labelledby={`exercise-heading-${selectedExercise.id}`}>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h3 id={`exercise-heading-${selectedExercise.id}`} className="text-lg font-semibold">{selectedExercise.exerciseName}</h3>
          <p className="text-sm text-muted-foreground">
            {selectedComplete ? `${completedSetCount} of ${selectedSets.length} sets complete` : `Set ${currentSet?.setNumber ?? 0} of ${selectedSets.length}`}
          </p>
        </div>
      </div>
      <ItemGroup className="gap-2" aria-labelledby={`exercise-heading-${selectedExercise.id}`}>
        {selectedSets.map((set) => {
          const status = getSetStatus(set);
          return <SetChecklistRow
            key={set.id}
            setId={set.id}
            exerciseName={selectedExercise.exerciseName}
            setNumber={set.setNumber}
            mode={selectedExercise.mode}
            status={status}
            current={set.id === currentId}
            readOnly={readOnly}
            disabled={disabled}
            actualReps={set.actualReps}
            actualSeconds={set.actualSeconds}
            externalLoadKg={set.externalLoadKg}
            rpe={set.rpe}
            prior={priorSelection?.exerciseId === selectedExercise.id && priorSelection.setId === set.id ? prior : undefined}
            repsMin={selectedExercise.repsMin}
            repsMax={selectedExercise.repsMax}
            targetSeconds={selectedExercise.targetSeconds}
            selected={set.id === selectedSetId}
            focusInput={set.id === focusSetId}
            onFocusHandled={() => setFocusSetId((focusedSetId) => focusedSetId === set.id ? null : focusedSetId)}
            onSelect={() => selectRow(selectedExercise.id, set.id)}
            onComplete={onCompleteSet ? (result) => completeAndAdvance(set.id, result) : undefined}
            onUncomplete={onUncompleteSet ? () => {
              onUncompleteSet(set.id);
              selectRow(selectedExercise.id, set.id, true);
            } : undefined}
            onSkip={onSkipSet ? () => onSkipSet(set.id) : undefined}
            onSave={onSaveSet ? (result) => onSaveSet(set.id, result) : undefined}
          />;
        })}
      </ItemGroup>
    </section>}
  </div>;
}
