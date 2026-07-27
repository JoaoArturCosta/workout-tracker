"use client";

import { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Item, ItemActions, ItemContent, ItemDescription, ItemFooter, ItemMedia, ItemTitle } from "@/components/ui/item";
import type { PriorSetValues } from "@/lib/types";

export type ChecklistSetStatus = "Pending" | "Completed" | "Skipped" | string;

export interface SetChecklistResult {
  externalLoadKg: number;
  actualReps?: number;
  actualSeconds?: number;
  rpe: number | null;
}

export interface SetChecklistRowProps {
  setId: string;
  exerciseName: string;
  setNumber: number;
  mode: "Reps" | "Duration" | string;
  status: ChecklistSetStatus;
  current: boolean;
  selected?: boolean;
  readOnly?: boolean;
  actualReps?: number | null;
  actualSeconds?: number | null;
  externalLoadKg?: number | null;
  rpe?: number | null;
  prior?: PriorSetValues | null;
  repsMin?: number | null;
  repsMax?: number | null;
  targetSeconds?: number | null;
  disabled?: boolean;
  onComplete?: () => void;
  onSkip?: () => void;
  onSave?: (result: SetChecklistResult) => void | Promise<void>;
  onSelect?: () => void;
}

export function SetChecklistRow({
  setId,
  exerciseName,
  setNumber,
  mode,
  status,
  current,
  selected = false,
  readOnly = false,
  actualReps,
  actualSeconds,
  externalLoadKg,
  rpe,
  prior,
  repsMin,
  repsMax,
  targetSeconds,
  disabled = false,
  onComplete,
  onSkip,
  onSelect,
  onSave,
}: SetChecklistRowProps) {
  const completed = status === "Completed";
  const skipped = status === "Skipped";
  const value = mode === "Duration" ? actualSeconds : actualReps;
  const target = mode === "Duration" ? (targetSeconds ? `${targetSeconds}s` : "") : repsMin && repsMax ? `${repsMin}-${repsMax}` : "";
  const hasOwnResult = completed || value != null;
  const priorLoad = !hasOwnResult ? prior?.externalLoadKg : undefined;
  const priorValue = !hasOwnResult ? (mode === "Duration" ? prior?.actualSeconds : prior?.actualReps) : undefined;
  const priorEffort = !hasOwnResult ? prior?.rpe : undefined;
  const [load, setLoad] = useState(String(hasOwnResult ? externalLoadKg ?? 0 : priorLoad ?? externalLoadKg ?? 0));
  const [actualValue, setActualValue] = useState(String(value ?? priorValue ?? ""));
  const [effort, setEffort] = useState(String(hasOwnResult ? rpe ?? "" : priorEffort ?? rpe ?? ""));
  const submittedRef = useRef(false);
  const dirtyRef = useRef(false);
  // Editing follows selection. SaveSet handles pending, completed, and skipped
  // rows while the completion checkbox and skip menu stay current-only.
  const editable = !readOnly && selected;

  useEffect(() => {
    // Prior values arrive after the row mounts. Keep anything the user has
    // typed while the set still has no saved result.
    if (dirtyRef.current && !hasOwnResult) return;

    setLoad(String(hasOwnResult ? externalLoadKg ?? 0 : priorLoad ?? externalLoadKg ?? 0));
    setActualValue(String(value ?? priorValue ?? ""));
    setEffort(String(hasOwnResult ? rpe ?? "" : priorEffort ?? rpe ?? ""));
    dirtyRef.current = false;
    submittedRef.current = false;
  }, [externalLoadKg, hasOwnResult, mode, priorEffort, priorLoad, priorValue, rpe, value]);

  const saveIfReady = (nextLoad: string, nextActualValue: string, nextEffort: string) => {
    if (!onSave || submittedRef.current || !dirtyRef.current) return;

    const loadValue = Number(nextLoad);
    const parsed = Number(nextActualValue);
    if (!Number.isFinite(loadValue) || loadValue < 0 || loadValue > 1000 || nextLoad.trim() === "" || nextActualValue.trim() === "" || !Number.isInteger(parsed) || parsed < 1 || (mode === "Duration" ? parsed > 3600 : parsed > 100)) return;

    const effortValue = nextEffort.trim() === "" ? null : Number(nextEffort);
    if (effortValue != null && (!Number.isInteger(effortValue) || effortValue < 6 || effortValue > 10)) return;

    submittedRef.current = true;
    void onSave(mode === "Duration" ? { externalLoadKg: loadValue, actualSeconds: parsed, rpe: effortValue } : { externalLoadKg: loadValue, actualReps: parsed, rpe: effortValue });
  };

  return (
    <Item
      variant="outline"
      size="sm"
      className={cn(
        "gap-3 rounded-lg p-3",
        current && "border-primary bg-primary/5",
        selected && "ring-2 ring-primary ring-offset-1",
        completed && "bg-muted/50",
        skipped && "bg-muted/40",
      )}
      data-testid={`set-row-${setNumber}`}
      data-selected={selected ? "true" : undefined}
    >
      <ItemMedia className="size-7">
        {!readOnly && <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label={`${exerciseName} set ${setNumber} options`}
              disabled={disabled || !current || completed || skipped || !onSkip}
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuGroup>
              <DropdownMenuItem onSelect={onSkip}>Skip set</DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>}
      </ItemMedia>
      <ItemContent
        className="min-w-0 gap-0"
        role={onSelect ? "button" : undefined}
        tabIndex={onSelect ? 0 : undefined}
        aria-pressed={onSelect ? selected : undefined}
        aria-current={selected ? "true" : undefined}
        onClick={onSelect}
        onKeyDown={(event) => {
          if (!onSelect) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelect();
          }
        }}
      >
        <ItemTitle className="flex-wrap gap-2">
          <span>Set {setNumber}</span>
          <Badge variant="outline">{mode}</Badge>
          {target && <span className="text-xs text-muted-foreground">Target {target}</span>}
        </ItemTitle>
        <ItemDescription>
          {completed ? `${externalLoadKg ?? 0} kg · ${value ?? "—"} ${mode === "Duration" ? "sec" : "reps"}${rpe != null ? ` · RPE ${rpe}` : ""}` : skipped ? "Skipped" : current ? "Current" : "Waiting"}
        </ItemDescription>
      </ItemContent>
      <ItemActions className="ml-auto">
        <Checkbox
          aria-label={`Complete ${exerciseName} set ${setNumber}`}
          checked={completed}
          disabled={disabled || readOnly || !current || completed || skipped || !onComplete}
          onCheckedChange={(checked) => { if (checked === true) onComplete?.(); }}
        />
      </ItemActions>
      {editable && <ItemFooter className="pt-1" data-testid="set-inline-editor">
        <FieldGroup className="grid gap-3 sm:grid-cols-3">
          <Field data-disabled={disabled || undefined}>
            <FieldLabel htmlFor={`set-${setId}-external-load`}>Weight</FieldLabel>
            <Input id={`set-${setId}-external-load`} type="number" min="0" max="1000" step="0.1" value={load} disabled={disabled} onChange={(event) => {
              const nextLoad = event.target.value;
              dirtyRef.current = true;
              setLoad(nextLoad);
            }} onBlur={() => saveIfReady(load, actualValue, effort)} />
          </Field>
          <Field data-disabled={disabled || undefined}>
            <FieldLabel htmlFor={`set-${setId}-actual-value`}>{mode === "Duration" ? "Seconds" : "Reps"}</FieldLabel>
            <Input id={`set-${setId}-actual-value`} type="number" min="1" max={mode === "Duration" ? 3600 : 100} step="1" value={actualValue} disabled={disabled} onChange={(event) => {
              const nextActualValue = event.target.value;
              dirtyRef.current = true;
              setActualValue(nextActualValue);
            }} onBlur={() => saveIfReady(load, actualValue, effort)} />
          </Field>
          <Field data-disabled={disabled || undefined}>
            <FieldLabel htmlFor={`set-${setId}-rpe`}>RPE</FieldLabel>
            <Input id={`set-${setId}-rpe`} type="number" min="6" max="10" step="1" placeholder="Optional" value={effort} disabled={disabled} onChange={(event) => {
              const nextEffort = event.target.value;
              dirtyRef.current = true;
              setEffort(nextEffort);
            }} onBlur={() => saveIfReady(load, actualValue, effort)} />
          </Field>
        </FieldGroup>
      </ItemFooter>}
    </Item>
  );
}
