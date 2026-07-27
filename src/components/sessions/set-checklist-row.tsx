"use client";

import { Check, Circle, SkipForward } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export type ChecklistSetStatus = "Pending" | "Completed" | "Skipped" | string;

export interface SetChecklistRowProps {
  exerciseName: string;
  setNumber: number;
  mode: "Reps" | "Duration" | string;
  status: ChecklistSetStatus;
  current: boolean;
  readOnly?: boolean;
  actualReps?: number | null;
  actualSeconds?: number | null;
  externalLoadKg?: number | null;
  repsMin?: number | null;
  repsMax?: number | null;
  targetSeconds?: number | null;
  onComplete?: () => void;
  onSelect?: () => void;
}

export function SetChecklistRow({
  exerciseName,
  setNumber,
  mode,
  status,
  current,
  readOnly = false,
  actualReps,
  actualSeconds,
  externalLoadKg,
  repsMin,
  repsMax,
  targetSeconds,
  onComplete,
  onSelect,
}: SetChecklistRowProps) {
  const completed = status === "Completed";
  const skipped = status === "Skipped";
  const value = mode === "Duration" ? actualSeconds : actualReps;
  const target = mode === "Duration" ? (targetSeconds ? `${targetSeconds}s` : "") : repsMin && repsMax ? `${repsMin}-${repsMax}` : "";
  const targetMiss = completed && value != null && (mode === "Duration" ? targetSeconds != null && value !== targetSeconds : repsMin != null && repsMax != null && (value < repsMin || value > repsMax));

  return (
    <div className={cn("flex items-center gap-3 rounded-lg border p-3", current && "border-primary bg-primary/5", completed && "border-green-200 bg-green-50", skipped && "border-muted bg-muted/40")} data-testid={`set-row-${setNumber}`}>
      <input
        type="checkbox"
        aria-label={`${exerciseName} set ${setNumber}`}
        checked={completed}
        disabled={readOnly || !current || completed || skipped}
        onChange={() => onComplete?.()}
        className="h-5 w-5"
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">Set {setNumber}</span>
          <Badge variant="outline">{mode}</Badge>
          {target && <span className="text-xs text-muted-foreground">Target {target}</span>}
          {targetMiss && <Badge variant="destructive">Outside target</Badge>}
        </div>
        <div className="text-xs text-muted-foreground">
          {completed ? `${externalLoadKg ?? 0} kg · ${value ?? "—"} ${mode === "Duration" ? "sec" : "reps"}` : skipped ? "Skipped" : current ? "Current" : "Waiting"}
        </div>
      </div>
      {skipped && <SkipForward className="h-4 w-4 text-muted-foreground" aria-label="Skipped" />}
      {completed && <Check className="h-4 w-4 text-green-600" aria-label="Completed" />}
      {!completed && !skipped && <Circle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
      {onSelect && !readOnly && <button type="button" className="sr-only" onClick={onSelect}>Select set</button>}
    </div>
  );
}
