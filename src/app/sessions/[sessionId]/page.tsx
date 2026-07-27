"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/trpc";
import type { SessionWithExercises } from "@/lib/types";
import type { SetResult } from "@/lib/workouts/contracts";
import { getDeviceId } from "@/lib/offline-workouts/db";
import { applyOptimisticWorkoutCommand } from "@/lib/offline-workouts/optimistic";
import { useActiveWorkout } from "@/hooks/use-active-workout";
import type { OfflineWorkoutSnapshot, OutboxEntry, SyncResponse } from "@/lib/offline-workouts/models";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkoutHeader } from "@/components/sessions/workout-header";
import { WorkoutChecklist, type ChecklistExercise } from "@/components/sessions/workout-checklist";
import { SetResultEditor } from "@/components/sessions/set-result-editor";
import { WorkoutActions } from "@/components/sessions/workout-actions";
import { RestTimer } from "@/components/sessions/rest-timer";
import { DurationSetTimer } from "@/components/sessions/duration-set-timer";
import { PreviousSessionValues } from "@/components/sessions/previous-session-values";
import { ControllerControls } from "@/components/sessions/controller-controls";
import { SyncConflictDialog } from "@/components/sessions/sync-conflict-dialog";
import { SyncStatus } from "@/components/sessions/sync-status";
import { WorkoutAlertSetup } from "@/components/push/workout-alert-setup";
import { toast } from "sonner";

interface SessionPageProps { params: Promise<{ sessionId: string }> }
function resultFromSet(set: SessionWithExercises["occurrences"][number]["sets"][number]): SetResult | null {
  return set.mode === "Duration"
    ? set.actualSeconds == null ? null : { mode: "Duration", externalLoadKg: set.externalLoadKg, actualSeconds: set.actualSeconds, actualReps: null, rpe: set.rpe }
    : set.actualReps == null ? null : { mode: "Reps", externalLoadKg: set.externalLoadKg, actualReps: set.actualReps, actualSeconds: null, rpe: set.rpe };
}

export default function SessionPage({ params }: SessionPageProps) {
  const { sessionId } = use(params);
  const query = api.session.getById.useQuery({ sessionId });
  const session = query.data as SessionWithExercises | undefined;
  const commandMutation = api.session.command.useMutation({ onError: (error) => toast.error(error.message) });
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);
  useEffect(() => { let cancelled = false; void getDeviceId().then((id) => { if (!cancelled) setDeviceId(id); }).catch((error: Error) => toast.error(error.message)); return () => { cancelled = true; }; }, []);
  const controllerQuery = api.device.getControllerState.useQuery({ sessionId, deviceId: deviceId ?? "00000000-0000-0000-0000-000000000000" }, { enabled: !!deviceId });
  const handoffMutation = api.device.handoff.useMutation({ onSuccess: () => { toast.success("Controller handed off"); void controllerQuery.refetch(); }, onError: (error) => toast.error(error.message) });
  const replaceMutation = api.device.replaceLostDevice.useMutation({ onSuccess: () => { toast.success("This device now controls the workout"); void controllerQuery.refetch(); void query.refetch(); }, onError: (error) => toast.error(error.message) });

  const initialSnapshot = useMemo<OfflineWorkoutSnapshot<SessionWithExercises> | null>(() => session && deviceId ? { sessionId, revision: session.revision, controllerEpoch: session.controllerEpoch, controllerDeviceId: session.controllerDeviceId ?? deviceId, status: session.status, data: session, updatedAt: Date.now() } : null, [deviceId, session, sessionId]);
  const sendQueuedCommand = useCallback(async (entry: OutboxEntry): Promise<SyncResponse<SessionWithExercises>> => {
    const response = await commandMutation.mutateAsync(entry.envelope);
    const refreshed = await query.refetch();
    const next = refreshed.data as SessionWithExercises | undefined;
    return { revision: response.result.revision, snapshot: next && { sessionId, revision: response.result.revision, controllerEpoch: response.result.controllerEpoch, controllerDeviceId: entry.envelope.deviceId, status: response.result.status, data: next, updatedAt: Date.now() } };
  }, [commandMutation, query, sessionId]);
  const active = useActiveWorkout<SessionWithExercises>({ sessionId, initialSnapshot, sendCommand: sendQueuedCommand, optimisticUpdate: applyOptimisticWorkoutCommand });
  const workout = active.snapshot?.data ?? session;
  const status = active.snapshot?.status ?? workout?.status;
  const readOnly = active.isReadOnly || status !== "Active" || !controllerQuery.data || controllerQuery.data.controllerState === "ReadOnly";
  const exercises = useMemo<ChecklistExercise[]>(() => workout?.occurrences.map((occurrence) => ({ id: occurrence.id, exerciseName: occurrence.exerciseName, mode: occurrence.mode, repsMin: occurrence.repsMin, repsMax: occurrence.repsMax, targetSeconds: occurrence.targetSeconds, sets: occurrence.sets.map((set) => ({ id: set.id, setNumber: set.setNumber, status: set.status, actualReps: set.actualReps, actualSeconds: set.actualSeconds, externalLoadKg: set.externalLoadKg })) })) ?? [], [workout]);
  const flatSets = exercises.flatMap((exercise) => exercise.sets.map((set) => ({ exercise, set })));
  const current = flatSets.find(({ set }) => set.status === "Pending");
  const selected = flatSets.find(({ set }) => set.id === selectedSetId) ?? current;
  const selectedOccurrence = workout?.occurrences.find((occurrence) => occurrence.id === selected?.exercise.id);
  const allSets = flatSets.length;
  const completedSets = flatSets.filter(({ set }) => set.status === "Completed").length;
  const rest = workout?.rest;

  if (!workout) return <div className="container mx-auto p-6"><p>Loading workout…</p></div>;

  const completeSet = (setId: string, result: SetResult) => {
    const finalSet = flatSets.filter(({ set }) => set.status === "Pending").length === 1;
    if (finalSet && !window.confirm("Finish this workout?")) return;
    if (finalSet) return active.finish({ type: "Finish", sessionSetId: setId, result });
    return active.completeSet({ type: "CompleteSet", sessionSetId: setId, result });
  };
  const finishWorkout = () => { const last = [...flatSets].reverse().find(({ set }) => set.status === "Completed"); const source = last && workout.occurrences.flatMap((occurrence) => occurrence.sets).find((set) => set.id === last.set.id); const result = source && resultFromSet(source); if (source && result) void active.finish({ type: "Finish", sessionSetId: source.id, result }); };

  return <main className="container mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
    <WorkoutHeader name={workout.templateName} status={status ?? workout.status} completedSets={completedSets} totalSets={allSets} startedAt={String(workout.startTime)} onEnd={readOnly ? undefined : () => void active.end()} />
    <SyncStatus state={active.syncState} pendingCount={active.outbox.length} errorMessage={active.error?.message} />
    {deviceId && <ControllerControls controllerState={controllerQuery.data?.controllerState ?? "ReadOnly"} controllerDeviceId={controllerQuery.data?.controllerDeviceId ?? workout.controllerDeviceId} controllerEpoch={controllerQuery.data?.controllerEpoch ?? workout.controllerEpoch} acknowledgedRevision={controllerQuery.data?.revision ?? workout.revision} pendingOperationCount={active.outbox.length} disabled={handoffMutation.isPending || replaceMutation.isPending} onHandoff={(nextDeviceId) => handoffMutation.mutate({ sessionId, currentDeviceId: deviceId, nextDeviceId, controllerEpoch: controllerQuery.data?.controllerEpoch ?? workout.controllerEpoch, acknowledgedRevision: controllerQuery.data?.revision ?? workout.revision, pendingOperationCount: active.outbox.length })} onReplaceLostDevice={() => { if (window.confirm("Replace the lost controller? Unsynced changes may be lost.")) replaceMutation.mutate({ sessionId, nextDeviceId: deviceId, controllerEpoch: controllerQuery.data?.controllerEpoch ?? workout.controllerEpoch, confirmUnsyncedDataLoss: true }); }} />}
    {!readOnly && deviceId && <WorkoutAlertSetup deviceId={deviceId} />}
    {!readOnly && <WorkoutActions canSkip={!!current} canUndo={completedSets > 0} canFinish={completedSets === allSets && allSets > 0} onSkip={() => current && void active.skipSet({ type: "SkipSet", sessionSetId: current.set.id })} onUndo={() => { const last = [...flatSets].reverse().find(({ set }) => set.status === "Completed"); if (last) void active.undoSet({ type: "Undo", sessionSetId: last.set.id }); }} onFinish={finishWorkout} onEnd={() => void active.end()} onDiscard={() => void active.discard()} />}
    {rest && !readOnly && <RestTimer startedAt={rest.startedAt} dueAt={rest.dueAt} onSkip={() => void active.queueCommand({ type: "SkipRest" })} />}
    <Card><CardHeader><CardTitle>Set checklist</CardTitle></CardHeader><CardContent><WorkoutChecklist exercises={exercises} readOnly={readOnly} onCompleteSet={setSelectedSetId} /></CardContent></Card>
    {selected && !readOnly && <Card><CardHeader><CardTitle>{selected.exercise.exerciseName} · Set {selected.set.setNumber}</CardTitle></CardHeader><CardContent className="space-y-3">{selected.exercise.mode === "Duration" && selected.set.id === current?.set.id && <DurationSetTimer targetSeconds={selected.exercise.targetSeconds ?? 1} onStop={setDurationSeconds} />}<SetResultEditor mode={selected.exercise.mode} repsMin={selected.exercise.repsMin} repsMax={selected.exercise.repsMax} targetSeconds={selected.exercise.targetSeconds} externalLoadKg={selected.set.externalLoadKg} actualReps={selected.set.actualReps} actualSeconds={durationSeconds ?? selected.set.actualSeconds} onSave={(result) => { const normalized: SetResult = selected.exercise.mode === "Duration" ? { mode: "Duration", externalLoadKg: result.externalLoadKg, actualSeconds: durationSeconds ?? result.actualSeconds ?? 1, actualReps: null, rpe: result.rpe } : { mode: "Reps", externalLoadKg: result.externalLoadKg, actualReps: result.actualReps ?? 1, actualSeconds: null, rpe: result.rpe }; void completeSet(selected.set.id, normalized); }} onClear={() => { setSelectedSetId(null); setDurationSeconds(null); }} /></CardContent></Card>}
    {selectedOccurrence && selected && <PreviousSessionValues exerciseId={selectedOccurrence.exerciseId} mode={selectedOccurrence.mode} setNumber={selected.set.setNumber} />}
    {active.syncState === "sync-conflicted" && active.snapshot && initialSnapshot && <SyncConflictDialog sessionId={sessionId} snapshot={active.snapshot} serverSnapshot={initialSnapshot} onResolved={async () => { await active.refresh(); await query.refetch(); }} />}
  </main>;
}
