"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type SetEditorMode = "Reps" | "Duration" | string;
export interface SetResultEditorProps {
  mode: SetEditorMode;
  externalLoadKg?: number | null;
  actualReps?: number | null;
  actualSeconds?: number | null;
  rpe?: number | null;
  prior?: { externalLoadKg?: number | null; actualReps?: number | null; actualSeconds?: number | null } | null;
  repsMin?: number | null;
  repsMax?: number | null;
  targetSeconds?: number | null;
  disabled?: boolean;
  readOnly?: boolean;
  onSave?: (result: { externalLoadKg: number; actualReps?: number; actualSeconds?: number; rpe: number | null }) => void | Promise<void>;
  onClear?: () => void;
}

export function SetResultEditor({
  mode,
  externalLoadKg,
  actualReps,
  actualSeconds,
  rpe,
  prior,
  disabled = false,
  readOnly = false,
  onSave,
  onClear,
}: SetResultEditorProps) {
  const [load, setLoad] = useState(String(externalLoadKg ?? prior?.externalLoadKg ?? 0));
  const [value, setValue] = useState(String(mode === "Duration" ? actualSeconds ?? prior?.actualSeconds ?? "" : actualReps ?? prior?.actualReps ?? ""));
  const [effort, setEffort] = useState(rpe == null ? "" : String(rpe));

  useEffect(() => {
    setLoad(String(externalLoadKg ?? prior?.externalLoadKg ?? 0));
    setValue(String(mode === "Duration" ? actualSeconds ?? prior?.actualSeconds ?? "" : actualReps ?? prior?.actualReps ?? ""));
    setEffort(rpe == null ? "" : String(rpe));
  }, [actualReps, actualSeconds, externalLoadKg, mode, prior, rpe]);

  const parsed = Number(value);
  const save = async () => {
    const loadValue = Number(load);
    if (!Number.isFinite(loadValue) || loadValue < 0 || loadValue > 1000 || !Number.isInteger(parsed) || parsed < 1 || (mode === "Duration" ? parsed > 3600 : parsed > 100)) return;
    const effortValue = effort === "" ? null : Number(effort);
    if (effortValue != null && (!Number.isInteger(effortValue) || effortValue < 6 || effortValue > 10)) return;
    await onSave?.(mode === "Duration" ? { externalLoadKg: loadValue, actualSeconds: parsed, rpe: effortValue } : { externalLoadKg: loadValue, actualReps: parsed, rpe: effortValue });
  };

  if (readOnly) {
    return <div className="space-y-1 text-sm"><p>{externalLoadKg ?? 0} kg · {mode === "Duration" ? `${actualSeconds ?? "—"} sec` : `${actualReps ?? "—"} reps`}</p>{rpe != null && <p className="text-muted-foreground">RPE {rpe}</p>}</div>;
  }

  return (
    <div className="grid gap-3 rounded-lg border p-4 sm:grid-cols-4" data-testid="set-result-editor">
      <div><Label htmlFor="external-load">External load (kg)</Label><Input id="external-load" type="number" min="0" max="1000" step="0.1" value={load} disabled={disabled} onChange={(e) => setLoad(e.target.value)} /></div>
      <div><Label htmlFor="actual-value">{mode === "Duration" ? "Actual seconds" : "Actual reps"}</Label><Input id="actual-value" type="number" min="1" max={mode === "Duration" ? 3600 : 100} step="1" value={value} disabled={disabled} onChange={(e) => setValue(e.target.value)} /></div>
      <div><Label htmlFor="rpe">RPE (6-10)</Label><Input id="rpe" type="number" min="6" max="10" step="1" placeholder="Optional" value={effort} disabled={disabled} onChange={(e) => setEffort(e.target.value)} /></div>
      <div className="flex items-end gap-2"><Button type="button" onClick={save} disabled={disabled || value === ""}>Save</Button>{onClear && <Button type="button" variant="outline" onClick={onClear} disabled={disabled}>Clear</Button>}</div>
    </div>
  );
}
