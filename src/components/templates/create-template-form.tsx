"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- template router output changes with the expanded contract. */

import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExerciseSelectionDialog } from "@/components/templates/exercise-selection-dialog";
import { Plus, Trash2, Dumbbell } from "lucide-react";
import { toast } from "sonner";

const ExerciseInput = z.object({
  exerciseId: z.string().uuid(), orderIndex: z.number().int().min(0), sets: z.number().int().min(1).max(20), mode: z.enum(["Reps", "Duration"]), repsMin: z.number().int().min(1).max(100).nullable().optional(), repsMax: z.number().int().min(1).max(100).nullable().optional(), targetSeconds: z.number().int().min(1).max(3600).nullable().optional(), rpeTarget: z.number().int().min(6).max(10).nullable().optional(), restTimeSeconds: z.number().int().min(0).max(3600), });
const FormSchema = z.object({ name: z.string().min(1).max(50), dayNumber: z.number().int().min(1).max(7), exercises: z.array(ExerciseInput) });
type FormData = z.infer<typeof FormSchema>;

export function CreateTemplateForm({ onSuccess, selectedDay = 1 }: { onSuccess: () => void; selectedDay?: number }) {
  const { register, control, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(FormSchema), defaultValues: { name: "", dayNumber: selectedDay, exercises: [] } });
  const { fields, append, remove } = useFieldArray({ control, name: "exercises" });
  const { data: allExercises = [] } = api.exercise.getAll.useQuery({});
  const templateApi = api.template as any;
  const mutation = templateApi.create.useMutation({ onSuccess: () => { toast.success("Template created"); onSuccess(); }, onError: (error: Error) => toast.error(error.message) });

  const addExercise = (exercise: { id: string }) => append({ exerciseId: exercise.id, orderIndex: fields.length, sets: 3, mode: "Reps", repsMin: 8, repsMax: 12, targetSeconds: null, rpeTarget: null, restTimeSeconds: 120 });
  const mode = (index: number) => watch(`exercises.${index}.mode`);

  return <form className="space-y-6" onSubmit={handleSubmit((data) => mutation.mutate(data))}>
    <div className="grid gap-4 sm:grid-cols-2">
      <div><Label htmlFor="template-name">Template name</Label><Input id="template-name" {...register("name")} />{errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}</div>
      <div><Label>Day</Label><Select value={String(watch("dayNumber"))} onValueChange={(value) => setValue("dayNumber", Number(value))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Array.from({ length: 7 }, (_, i) => <SelectItem key={i + 1} value={String(i + 1)}>Day {i + 1}</SelectItem>)}</SelectContent></Select></div>
    </div>
    <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Exercise occurrences</h2><ExerciseSelectionDialog trigger={<Button type="button" variant="outline"><Plus className="h-4 w-4" />Add exercise</Button>} onExerciseSelect={addExercise} title="Add exercise" /></div>
    {fields.length === 0 && <Card className="border-dashed"><CardContent className="p-8 text-center text-sm text-muted-foreground"><Dumbbell className="mx-auto mb-2" />Add your first exercise occurrence.</CardContent></Card>}
    <div className="space-y-3">{fields.map((field, index) => { const exercise = allExercises.find((item) => item.id === field.exerciseId); const currentMode = mode(index); return <Card key={field.id}><CardHeader className="flex-row items-center justify-between space-y-0"><CardTitle className="text-base">{index + 1}. {exercise?.name ?? "Exercise"}</CardTitle><Button type="button" size="icon" variant="ghost" onClick={() => remove(index)} aria-label="Remove exercise"><Trash2 className="h-4 w-4" /></Button></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div><Label>Mode</Label><Select value={currentMode} onValueChange={(value: "Reps" | "Duration") => { setValue(`exercises.${index}.mode`, value); if (value === "Reps") setValue(`exercises.${index}.targetSeconds`, null); else { setValue(`exercises.${index}.repsMin`, null); setValue(`exercises.${index}.repsMax`, null); } }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Reps">Reps</SelectItem><SelectItem value="Duration">Duration</SelectItem></SelectContent></Select></div><div><Label>Sets</Label><Input type="number" min="1" max="20" {...register(`exercises.${index}.sets`, { valueAsNumber: true })} /></div>{currentMode === "Duration" ? <div><Label>Target seconds</Label><Input type="number" min="1" max="3600" {...register(`exercises.${index}.targetSeconds`, { valueAsNumber: true })} /></div> : <><div><Label>Rep min</Label><Input type="number" min="1" max="100" {...register(`exercises.${index}.repsMin`, { valueAsNumber: true })} /></div><div><Label>Rep max</Label><Input type="number" min="1" max="100" {...register(`exercises.${index}.repsMax`, { valueAsNumber: true })} /></div></>}<div><Label>Rest seconds</Label><Input type="number" min="0" max="3600" {...register(`exercises.${index}.restTimeSeconds`, { valueAsNumber: true })} /></div><div><Label>RPE target</Label><Input type="number" min="6" max="10" {...register(`exercises.${index}.rpeTarget`, { valueAsNumber: true })} /></div><Badge variant="outline" className="self-end">{currentMode === "Duration" ? "Seconds count only" : "Volume and 1RM"}</Badge></CardContent></Card>; })}</div>
    <Button type="submit" disabled={isSubmitting || mutation.isPending}>{mutation.isPending ? "Saving…" : "Create template"}</Button>
  </form>;
}
